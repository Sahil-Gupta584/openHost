import { spawn } from 'child_process';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Process-layer helpers used by the build pipeline. Everything a deployed
 * command prints becomes a log line (streamed to the deploy log UI).
 */

export type LogLevel = 'info' | 'success' | 'error';

export interface LogSink {
  (level: LogLevel, text: string): void;
}

const QUIET_STDOUT = ['npm'];

/** Run a command, streaming output lines into `log`. Rejects on non-zero exit. */
export function runCommand(
  command: string,
  args: string[],
  opts: { cwd: string; log: LogSink; caption: string; timeoutMs?: number; /** Shown in logs instead of the raw command (hides secrets). */ commandLabel?: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    opts.log('info', `${opts.caption}: ${opts.commandLabel ?? `${command} ${args.join(' ')}`}`);

    const child = spawn(command, args, {
      cwd: opts.cwd,
      shell: true, // windows .cmd shims (npm, npx, git)
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
    });

    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill();
    }, opts.timeoutMs ?? 15 * 60_000);

    const onLine = (level: LogLevel) => (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        const text = line.trimEnd();
        if (!text) continue;
        if (QUIET_STDOUT.includes(command) && text.startsWith('\u001b')) continue;
        opts.log(level, text);
      }
    };

    child.stdout?.on('data', onLine('info'));
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      // npm writes progress tables to stderr; only real errors are worth surfacing.
      const isNoise = text.includes('funding') || text.includes('vulnerabilities');
      opts.log(isNoise ? 'info' : 'error', text.trimEnd());
    });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new Error(`${command} timed out`));
      if (code === 0) return resolve();
      reject(new Error(`${opts.caption} exited with code ${code}`));
    });
  });
}

/** Create a fresh build workspace. */
export async function makeBuildDir(id: string): Promise<string> {
  const root = path.join(tmpdir(), 'openhost-builds');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, `${id.replace(/[^a-z0-9-]/gi, '')}-`));
  return dir;
}

/** Best-effort cleanup of a workspace. */
export async function cleanupDir(dir: string) {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
