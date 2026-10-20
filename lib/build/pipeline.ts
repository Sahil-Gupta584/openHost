import fs from 'fs/promises';
import path from 'path';
import * as archiver from 'archiver';
import { runCommand, makeBuildDir, cleanupDir, type LogSink } from './process';

/**
 * Build pipeline for a git repository (public repos via token auth in M4):
 *
 *   clone → detect Next.js → install → patch config → next build → package
 *
 * Two modes:
 *   - "ssr"    Next.js app → force `output: "standalone"`, package the
 *              standalone server + static bundles into a Lambda-ready zip
 *              (AWS Lambda Web Adapter layer boots `node server.js`).
 *   - "static" plain site / explicit `output: "export"` → upload out/**.
 */

export type BuildMode = 'ssr' | 'static';

export interface BuildResult {
  mode: BuildMode;
  workdir: string;
  /** static mode: relative path → file contents (out/**) */
  files: Record<string, Buffer>;
  /** ssr mode: lambda deployment zip (standalone + adapter bootstrap script) */
  lambdaZip: Buffer;
  commitHash: string;
  commitMessage: string | null;
  author: string | null;
  npmDurationMs: number;
  buildDurationMs: number;
  packageDurationMs: number;
}

export interface BuildOpts {
  repo: string; // owner/name
  branch: string;
  log: LogSink;
  /** GitHub token — private repos. */
  token?: string | null;
}

const COMMIT_RE = /^[0-9a-f]{40}$/i;

/** HTTPS clone URL; authenticated form never appears in logs. */
function cloneUrl(repo: string, token?: string | null) {
  return token
    ? `https://x-access-token:${token}@github.com/${repo}.git`
    : `https://github.com/${repo}.git`;
}

export async function buildRepo(opts: BuildOpts): Promise<BuildResult> {
  const workdir = await makeBuildDir(opts.repo.split('/')[1] ?? 'app');
  const started = Date.now();
  const secs = () => `${Math.round((Date.now() - started) / 1000)}s`;

  const empty: BuildResult = {
    mode: 'static',
    workdir,
    files: {},
    lambdaZip: Buffer.alloc(0),
    commitHash: 'unknown',
    commitMessage: null,
    author: null,
    npmDurationMs: 0,
    buildDurationMs: 0,
    packageDurationMs: 0,
  };

  try {
    // ---- source fetch -------------------------------------------------------
    // Lambda sandbox runtimes ship no git → tarball download + pure-JS untar.
    const sandbox = process.env.OPENHOST_SANDBOX === 'lambda';
    const cloneStart = Date.now();
    let commitHash: string;
    let commitMessage: string | null;
    let author: string | null;

    if (sandbox) {
      const facts = await downloadSource(workdir, opts);
      commitHash = facts.commitHash;
      commitMessage = facts.commitMessage;
      author = facts.author;
      if (!COMMIT_RE.test(commitHash)) {
        throw new Error(`Branch "${opts.branch}" not found (no commit resolved)`);
      }
    } else {
      await runCommand(
        'git',
        ['clone', '--depth', '1', '--branch', opts.branch, cloneUrl(opts.repo, opts.token), '.'],
        {
          cwd: workdir,
          log: opts.log,
          caption: `Cloning ${opts.repo}`,
          commandLabel: `git clone --depth 1 --branch ${opts.branch} https://github.com/${opts.repo}.git`,
          timeoutMs: 5 * 60_000,
        }
      );
      commitHash = await gitRev(workdir, 'HEAD');
      if (!COMMIT_RE.test(commitHash)) {
        throw new Error(`Branch "${opts.branch}" not found (clone produced no commit)`);
      }
      commitMessage = await gitLog(workdir, '%s');
      author = await gitLog(workdir, '%an');
    }
    opts.log(
      'success',
      `Cloned ${opts.repo}@${commitHash.slice(0, 7)} (${commitMessage ?? 'no message'}) in ${secs()}`
    );

    // ---- project detection ----------------------------------------------
    const isNext = await detectNext(workdir, opts.log);
    const wantsStatic = isNext && (await repoDeclaresExport(workdir));
    const mode: BuildMode = isNext && !wantsStatic ? 'ssr' : 'static';
    if (isNext) {
      opts.log(
        'info',
        wantsStatic
          ? 'Repo opts into `output: "export"` → static-site mode'
          : 'SSR mode → forcing `output: "standalone"` and building for Lambda'
      );
    } else {
      opts.log('info', 'No Next.js detected → static site mode (out/ expected)');
    }

    await ensureBuildScript(workdir, isNext, opts.log);

    // ---- install ----------------------------------------------------------
    const npmStart = Date.now();
    const lockfile = await fileExists(['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'], workdir);
    const sandboxMode = process.env.OPENHOST_SANDBOX === 'lambda';
    const install =
      lockfile === 'pnpm-lock.yaml'
        ? sandboxMode
          ? // Lambda runtimes ship no pnpm/npm-global tooling — fetch it via npx.
            { cmd: 'npx', args: ['--yes', 'pnpm@9', 'install', '--frozen-lockfile'] }
          : { cmd: 'pnpm', args: ['install', '--frozen-lockfile'] }
        : lockfile === 'yarn.lock'
          ? sandbox
            ? { cmd: 'npx', args: ['--yes', 'yarn@1.22', 'install', '--frozen-lockfile'] }
            : { cmd: 'yarn', args: ['install', '--frozen-lockfile'] }
          : lockfile
            ? { cmd: 'npm', args: ['ci'] }
            : { cmd: 'npm', args: ['install'] };
    if (!lockfile) opts.log('info', 'No lockfile found → resolving against latest registry');
    try {
      await runCommand(install.cmd, install.args, {
        cwd: workdir,
        log: opts.log,
        caption: 'Installing dependencies',
        timeoutMs: 10 * 60_000,
      });
    } catch (e) {
      // Locked installs fail on repos whose lockfile drifted from
      // package.json — fall back to a resolving install before giving up.
      if (install.cmd === 'npm' && install.args[0] === 'ci') {
        opts.log('info', 'npm ci failed (package-lock.json out of sync?) → falling back to npm install');
        await runCommand('npm', ['install', '--no-audit', '--no-fund'], {
          cwd: workdir,
          log: opts.log,
          caption: 'Installing dependencies (resolving)',
          timeoutMs: 10 * 60_000,
        });
      } else {
        throw e;
      }
    }
    const npmDurationMs = Date.now() - npmStart;

    // ---- build --------------------------------------------------------------
    const buildStart = Date.now();
    if (isNext) {
      if (mode === 'ssr') {
        if (sandboxMode) await disableInstrumentationHook(workdir, opts.log);
        await forceStandalone(workdir, opts.log);
      }
      await runCommand('npx', ['next', 'build'], {
        cwd: workdir,
        log: opts.log,
        caption: 'Compiling Next.js',
        timeoutMs: 15 * 60_000,
      });
    } else {
      await runCommand('npm', ['run', 'build'], {
        cwd: workdir,
        log: opts.log,
        caption: 'Running npm build',
        timeoutMs: 15 * 60_000,
      });
    }
    const buildDurationMs = Date.now() - buildStart;

    // ---- package -------------------------------------------------------------
    const packageStart = Date.now();

    if (mode === 'ssr') {
      const lambdaZip = await packageSsrFunction(workdir, opts.log);
      const result: BuildResult = { ...empty, mode, commitHash, commitMessage, author, npmDurationMs, buildDurationMs, lambdaZip, packageDurationMs: Date.now() - packageStart };
      return result;
    }

    // static: prefer repo-provided export; run `next export` ourselves otherwise
    const outDir = path.join(workdir, 'out');
    if (isNext && !(await pathExists(outDir))) {
      opts.log('info', 'No out/ directory → running `next export`');
      await runCommand('npx', ['next', 'export', '-o', 'out'], {
        cwd: workdir,
        log: opts.log,
        caption: 'Exporting static site',
        timeoutMs: 10 * 60_000,
      });
    }
    const files = await collectStaticFiles(outDir, opts.log);
    opts.log('success', `Site built ✓ (${Object.keys(files).length} files, ${size(files)})`);
    return {
      ...empty,
      mode,
      commitHash,
      commitMessage,
      author,
      npmDurationMs,
      buildDurationMs,
      files,
      packageDurationMs: Date.now() - packageStart,
    };
  } catch (e) {
    await cleanupDir(workdir);
    throw e;
  }
}

// ---- mode helpers --------------------------------------------------------------

/**
 * Lambda sandboxes ship no git → download the branch tarball from GitHub and
 * untar it (pure JS). Works for private repos via the PAT; the resolved
 * commit/message/author come from the commits API.
 */
async function downloadSource(
  workdir: string,
  opts: BuildOpts
): Promise<{ commitHash: string; commitMessage: string | null; author: string | null }> {
  const ghHeaders: Record<string, string> = {
    'user-agent': 'openhost-builder',
    accept: 'application/vnd.github+json',
    ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
  };
  const ghFetch = (globalThis as unknown as { fetch: (...a: any[]) => Promise<any> }).fetch;

  const metaRes = await ghFetch(`https://api.github.com/repos/${opts.repo}/commits/${opts.branch}`, {
    headers: ghHeaders,
  });
  if (!metaRes.ok) {
    throw new Error(`GitHub commit lookup failed (${metaRes.status}) for ${opts.repo}@${opts.branch}`);
  }
  const meta = await metaRes.json();
  const commitHash = String(meta.sha ?? '');
  const commitMessage = meta?.commit?.message ?? null;
  const author = meta?.commit?.author?.name ?? null;

  // codeload serves the tarball directly for open repos; private repos need
  // the authenticated API redirect (Authorization must be re-attached).
  let tarballUrl = `https://codeload.github.com/${opts.repo}/tar.gz/refs/heads/${opts.branch}`;
  if (opts.token) {
    const proxyRes = await ghFetch(`https://api.github.com/repos/${opts.repo}/tarball/${opts.branch}`, {
      headers: ghHeaders,
      redirect: 'manual',
    });
    const loc = proxyRes?.headers?.get?.('location');
    if (loc) tarballUrl = loc;
  }
  const tarRes = await ghFetch(tarballUrl, { headers: ghHeaders });
  if (!tarRes.ok) {
    throw new Error(`Tarball download failed (${tarRes.status}) for ${opts.repo}@${opts.branch}`);
  }
  const tarGz = Buffer.from(await tarRes.arrayBuffer());

  // Extract with tar-fs (maps away the `<owner>-<repo>-<sha>/` top folder),
  // then move the contents up into the workdir root.
  const nestDir = path.join(workdir, '_src');
  await fs.mkdir(nestDir, { recursive: true });
  const tarPath = path.join(nestDir, 'src.tar.gz');
  await fs.writeFile(tarPath, tarGz);

  const tar = (await import('tar-fs')).default as unknown as {
    extract: (dir: string, opts?: Record<string, unknown>) => import('stream').Writable;
  };
  const { createReadStream } = await import('fs');
  const { createGunzip } = await import('zlib');
  const { pipeline } = await import('stream');
  await new Promise<void>((resolve, reject) => {
    pipeline(
      createReadStream(tarPath),
      createGunzip(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tar.extract(nestDir, {
        // strip the single top-level directory
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map: (header: any) => {
          // strip the single top-level directory ('.' → no-op for its dir entry)
          const stripped = header.name.split('/').slice(1).join('/');
          header.name = stripped || '.';
          return header;
        },
      }),
      (err: unknown) => (err ? reject(err) : resolve())
    );
  });
  await fs.rm(tarPath, { force: true });

  for (const e of await fs.readdir(nestDir, { withFileTypes: true })) {
    if (e.name === 'src.tar.gz') continue;
    await fs.rename(path.join(nestDir, e.name), path.join(workdir, e.name));
  }
  await fs.rm(nestDir, { recursive: true, force: true });
  opts.log('info', `Unpacked source (${(tarGz.length / 1024 / 1024).toFixed(1)} MB tarball)`);
  return { commitHash, commitMessage, author };
}

async function detectNext(workdir: string, log: LogSink): Promise<boolean> {
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    if (await pathExists(path.join(workdir, f))) {
      log('info', `Detected Next.js project (${f})`);
      return true;
    }
  }
  return false;
}

const EXPORT_RE = /output\s*:\s*['"]export['"]/;

/** Original config sets `output: "export"` → respect static mode. */
async function repoDeclaresExport(workdir: string): Promise<boolean> {
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const p = path.join(workdir, f);
    if (await pathExists(p)) {
      return EXPORT_RE.test(await fs.readFile(p, 'utf8'));
    }
  }
  return false;
}

/**
 * Rename the repo's own config aside and inject a wrapper that adds
 * `output: "standalone"` (+ unoptimized images, no sharp needed on Lambda).
 */
/**
 * The instrumentation hook (usually OpenTelemetry auto-instrumentations using
 * `require-in-the-middle`) breaks the Lambda standalone server: Turbopack
 * externalizes its loader into hashed module chunks that the standalone
 * output never ships, and the server never binds its port. Disabled only for
 * the Lambda sandbox build; local builds keep it.
 */
async function disableInstrumentationHook(workdir: string, log: LogSink): Promise<boolean> {
  const bases = ['.', 'src', 'app'];
  for (const base of bases) {
    for (const f of ['instrumentation.ts', 'instrumentation.js', 'instrumentation.mjs']) {
      const p = path.join(workdir, base === '.' ? f : path.join(base, f));
      if (await pathExists(p)) {
        await fs.rename(p, path.join(workdir, base, `.openhost-${f}.disabled`));
        log('info', `Disabled ${base === '.' ? '' : `${base}/`}${f} (OpenTelemetry hook is incompatible with the Lambda standalone runtime)`);
        return true;
      }
    }
  }
  return false;
}

async function forceStandalone(workdir: string, log: LogSink) {  const js = path.join(workdir, 'next.config.js');
  const mjs = path.join(workdir, 'next.config.mjs');
  const ts = path.join(workdir, 'next.config.ts');

  if (await pathExists(js)) {
    await fs.rename(js, path.join(workdir, 'next.config.origin.js'));
    await fs.writeFile(
      js,
      [
        '// generated by openhost — original config moved to next.config.origin.js',
        'const orig = require("./next.config.origin.js");',
        'const c = typeof orig === "function" ? orig() : orig;',
        'module.exports = {',
        '  ...c,',
        '  output: "standalone",',
        '  images: { ...(c.images || {}), unoptimized: true },',
        '};',
      ].join('\n')
    );
    log('info', 'Wrapped next.config.js → standalone output');
    return;
  }

  if (await pathExists(mjs)) {
    await fs.rename(mjs, path.join(workdir, 'next.config.origin.mjs'));
    await fs.writeFile(
      mjs,
      [
        '// generated by openhost — original config moved to next.config.origin.mjs',
        'import orig from "./next.config.origin.mjs";',
        'const c = typeof orig === "function" ? await orig() : orig;',
        'export default {',
        '  ...c,',
        '  output: "standalone",',
        '  images: { ...(c.images || {}), unoptimized: true },',
        '};',
      ].join('\n')
    );
    log('info', 'Wrapped next.config.mjs → standalone output');
    return;
  }

  if (await pathExists(ts)) {
    // Next 16-style TypeScript configs are loaded by Next itself — same wrap.
    await fs.rename(ts, path.join(workdir, 'next.config.origin.ts'));
    await fs.writeFile(
      ts,
      [
        '// generated by openhost — original config moved to next.config.origin.ts',
        "import orig from './next.config.origin';",
        '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
        'const c = typeof orig === "function" ? await (orig as any)() : orig;',
        'export default {',
        '  ...(c as object),',
        '  output: "standalone",',
        '  images: { ...(typeof c === "object" && (c as any).images ? (c as any).images : {}), unoptimized: true },',
        '};',
      ].join('\n')
    );
    log('info', 'Wrapped next.config.ts → standalone output');
    return;
  }

  // No config at all → write a minimal one.
  await fs.writeFile(
    js,
    'module.exports = { output: "standalone", images: { unoptimized: true } };'
  );
  log('info', 'Wrote next.config.js with standalone output');
}

function runSh() {
  return [
    '#!/bin/bash',
    '[ ! -d /tmp/cache ] && mkdir -p /tmp/cache',
    'if [ ! -e .next/cache ]; then ln -s /tmp/cache .next/cache 2>/dev/null || true; fi',
    'HOSTNAME=0.0.0.0 exec node server.js',
    '',
  ].join('\n');
}

/** Official LWA nextjs-zip packaging flow, mirrored from awslabs example. */
async function packageSsrFunction(workdir: string, log: LogSink): Promise<Buffer> {
  const standalone = path.join(workdir, '.next', 'standalone');
  if (!(await pathExists(standalone))) {
    throw new Error(
      'Build did not produce .next/standalone — repo may be too old for SSR packaging or has non-standard config'
    );
  }

  // Static bundles must live inside the standalone tree: server portable.
  const publicDir = path.join(workdir, 'public');
  if (await pathExists(publicDir)) {
    await fs.cp(publicDir, path.join(standalone, 'public'), { recursive: true });
  }
  await fs.cp(
    path.join(workdir, '.next', 'static'),
    path.join(standalone, '.next', 'static'),
    { recursive: true }
  );

  // Copy to a clean package root and add the launcher script.
  const pkg = await makeBuildDir('pkg');
  await fs.cp(standalone, pkg, { recursive: true });
  const runsh = path.join(pkg, 'run.sh');
  await fs.writeFile(runsh, runSh());
  await fs.chmod(runsh, 0o755);

  log('info', 'Packaged standalone server + route handlers for Lambda (Lambda Web Adapter)');
  const zip = await zipDir(pkg);
  await cleanupDir(pkg);
  const mb = zip.length / 1024 / 1024;
  log('success', `Lambda bundle ready (${mb.toFixed(1)} MB zip)`);
  if (mb > 50) {
    throw new Error(`Lambda zip is ${mb.toFixed(1)} MB > 50 MB limit — app has too many large assets`);
  }
  return zip;
}

async function zipDir(dir: string): Promise<Buffer> {
  const zip = new archiver.ZipArchive({ forceLocalTime: true, zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  zip.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    zip.on('end', resolve);
    zip.on('error', reject);
    zip.on('warning', (err: archiver.ArchiverError) => {
      if (err.code !== 'ENOENT') reject(err);
    });
  });
  zip.directory(dir, false);
  await zip.finalize();
  await done;
  return Buffer.concat(chunks);
}

/** Static micro-sites without a build script still need one. */
async function ensureBuildScript(workdir: string, isNext: boolean, log: LogSink) {
  const pkgPath = path.join(workdir, 'package.json');
  const pkg = await fs
    .readFile(pkgPath, 'utf8')
    .then((t) => JSON.parse(t) as Record<string, any>)
    .catch(() => null);

  if (pkg?.scripts?.build) return;

  if (isNext) {
    log('info', 'No build script found → using `next build`');
    const base = pkg ?? pkgFallback();
    base.scripts = { ...(base.scripts ?? {}), build: 'next build' };
    await fs.writeFile(pkgPath, JSON.stringify(base, null, 2));
    return;
  }

  log('info', 'No Next.js detected → falling back to static site (out/ expected in repo)');
  if (!pkg) {
    await fs.writeFile(pkgPath, JSON.stringify(pkgFallback(), null, 2));
  }
}

function pkgFallback() {
  return {
    name: 'openhost-site',
    private: true,
    scripts: { build: 'echo static site; exit 0' },
  };
}

// ---- small helpers -----------------------------------------------------------

async function gitRev(cwd: string, ref: string) {
  const { stdout } = await execGit(cwd, ['rev-parse', ref]);
  return stdout.trim();
}

async function gitLog(cwd: string, format: string) {
  const { stdout } = await execGit(cwd, ['log', '-1', `--pretty=${format}`]);
  return stdout.trim() || null;
}

function execGit(cwd: string, args: string[]) {
  const { execFile } = require('child_process') as typeof import('child_process');
  return new Promise<{ stdout: string }>((resolve, reject) =>
    execFile('git', args, { cwd, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve({ stdout: String(stdout) })
    )
  );
}

async function fileExists(names: string[], dir: string) {
  for (const n of names) {
    if (await pathExists(path.join(dir, n))) return n;
  }
  return null;
}

async function pathExists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function collectStaticFiles(
  root: string,
  log: LogSink
): Promise<Record<string, Buffer>> {
  if (!(await pathExists(root))) throw new Error('No build output produced (out/ missing)');
  const files: Record<string, Buffer> = {};

  const walk = async (dir: string, prefix: string) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile()) files[rel] = await fs.readFile(abs);
    }
  };

  await walk(root, '');
  log('info', `Picked up ${Object.keys(files).length} static files from out/`);
  return files;
}

function size(files: Record<string, Buffer>): string {
  const bytes = Object.values(files).reduce((sum, b) => sum + b.length, 0);
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
