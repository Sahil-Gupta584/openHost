import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fsSync from 'fs';
import { execFileSync } from 'child_process';
import { buildRepo, type BuildMode } from './pipeline';

/**
 * openhost-builder — the Lambda build sandbox.
 *
 * Runs INSIDE the user's AWS account as a single ephemeral invocation:
 *   clone → install → next build → package → upload artifacts to S3.
 * Progress lines stream into s3://<bucket>/openhost-builds/<runId>/status.json
 * (runner tails it to feed the live deploy UI); the final outcome with the
 * [openhost] facts lands in result.json.
 */

export interface BuilderPayload {
  repo: string; // owner/name
  branch: string;
  bucket: string;
  runId: string;
  /** GitHub token for private repos (never stored in artifact paths). */
  token?: string | null;
}

interface BuildLine {
  i: number;
  level: 'info' | 'success' | 'error';
  text: string;
}

interface BuilderResult {
  status: 'succeeded' | 'failed';
  mode?: BuildMode;
  commitHash?: string;
  commitMessage?: string | null;
  author?: string | null;
  versionKey?: string;
  error?: string;
}

const MAX_LINES = 400;

// Minimal content-type mapping (fixed by s3.ts on the control plane).
const TEXT_MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  map: 'application/json',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function contentTypeFor(key: string) {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'ico') return 'image/x-icon';
  return TEXT_MIME[ext] ?? 'application/octet-stream';
}

function cacheControlFor(key: string) {
  return /\.html?$/i.test(key) ? 'public, max-age=0, must-revalidate' : 'public, max-age=31536000, immutable';
}

export async function handler(event: BuilderPayload) {
  const { repo, branch, token, bucket, runId } = event;
  const s3 = new S3Client({});
  const statusKey = `openhost-builds/${runId}/status.json`;
  const resultKey = `openhost-builds/${runId}/result.json`;

  // Signals lib/build/pipeline to use no-git source fetch + npx-based tooling.
  process.env.OPENHOST_SANDBOX = 'lambda';
  // Lambda containers run without HOME — npm/pnpm refuse to run without one.
  process.env.HOME = '/tmp';
  process.env.npm_config_cache = '/tmp/.npm';

  const lines: BuildLine[] = [];
  let dirty = false;
  let seq = 0;

  const log: (level: 'info' | 'success' | 'error', text: string) => void = (level, text) => {
    lines.push({ i: seq++, level, text: text.slice(0, 500) });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    dirty = true;
  };

  const flush = async (final = false) => {
    if (!dirty && !final) return;
    dirty = false;
    await new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: statusKey,
        Body: Buffer.from(JSON.stringify({ seq, lines, done: final }), 'utf8'),
        ContentType: 'application/json',
      },
    }).done();
  };

  // Heartbeat flusher so the control plane sees progress even for very
  // chatty smokers (e.g. npm install).
  const timer = setInterval(() => {
    void flush().catch(() => undefined);
  }, 2000);
  timer.unref?.();

  try {
    // ---- environment self-check (visible in the deploy log) ----------------
    log('info', `[openhost] Builder region=${process.env.AWS_REGION ?? 'us-east-1'} — ephemeral Lambda sandbox (this is not a dev machine)`);
    log('info', `[openhost] env: HOME=${process.env.HOME ?? '(unset)'} PATH=${process.env.PATH}`);
    for (const dir of ['/var/lang/bin', '/bin', '/usr/bin']) {
      try {
        const names = fsSync.readdirSync(dir);
        log('info', `[openhost] ${dir}: ${names.filter((n) => /^(node|npm|npx|pnpm|yarn|git|tar|zip|unzip|bash|sh)$/.test(n)).join(',')}`);
      } catch (e: unknown) {
        log('info', `[openhost] ${dir}: unreadable (${String((e as { code?: string }).code ?? e)})`);
      }
    }
    const probes: Array<[string, string[]]> = [
      ['node', ['-v']],
      ['npm', ['-v']],
      ['npx', ['--version']],
      ['pnpm', ['--version']],
      ['git', ['--version']],
    ];
    for (const [bin, args] of probes) {
      try {
        const out = execFileSync(bin, args, { encoding: 'utf8' });
        log('info', `[openhost] ${bin} ${args.join(' ')} → ${out.trim().split('\n')[0]}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
        log('error', `[openhost] ${bin}: ${msg}`);
      }
    }

    const build = await buildRepo({ repo, branch, log, token: token ?? null });

    let versionKey: string | undefined;
    if (build.mode === 'ssr') {
      versionKey = `versions/${build.commitHash}.zip`;
      await new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: versionKey,
          Body: build.lambdaZip,
          ContentType: 'application/zip',
          CacheControl: 'public, max-age=31536000, immutable',
        },
      }).done();
      log('success', `Function bundle uploaded → s3://${bucket}/${versionKey} (${(build.lambdaZip.length / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      let uploaded = 0;
      const entries = Object.entries(build.files);
      for (const [rel, body] of entries) {
        const key = `static/${rel.replace(/\\/g, '/')}`;
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentTypeFor(key),
          CacheControl: cacheControlFor(key),
        }));
        uploaded++;
      }
      log('success', `Static upload complete: ${uploaded} files → s3://${bucket}/static/`);
    }

    const result: BuilderResult = {
      status: 'succeeded',
      mode: build.mode,
      commitHash: build.commitHash,
      commitMessage: build.commitMessage,
      author: build.author,
      versionKey,
    };
    log('success', `[openhost] MODE=${result.mode!} COMMIT=${result.commitHash?.slice(0, 7)} AUTHOR=${result.author ?? 'unknown'}`);
    await flush(true);
    await new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: resultKey,
        Body: Buffer.from(JSON.stringify(result), 'utf8'),
        ContentType: 'application/json',
      },
    }).done();
    return result;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    log('error', err);
    const result: BuilderResult = { status: 'failed', error: err };
    await flush(true);
    await new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: resultKey,
        Body: Buffer.from(JSON.stringify(result), 'utf8'),
        ContentType: 'application/json',
      },
    }).done();
    return result;
  } finally {
    clearInterval(timer);
  }
}
