import path from 'path';
import fs from 'fs';
import * as archiver from 'archiver';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Lambda-builder executor — the build runs as one ephemeral Lambda invocation
 * inside the user's AWS account (same role the site functions use, no extra
 * infrastructure). Orchestrates:
 *
 *   bundle pipeline → create-or-update openhost-builder → async invoke →
 *   tail s3://<bucket>/openhost-builds/<runId>/status.json into the SSE log →
 *   read result.json → hand the artifact facts ("versions/<hash>.zip" is
 *   already in place) back to the deploy runner.
 */

import type { AwsCredentials } from '../aws/config';
import { s3Client } from '../aws/client';
import { uploadVersion } from '../aws/s3';
import { lambdaClient } from '../aws/client';
import { ensureBuilderFunction } from '../aws/lambda';
import type { LogSink } from './process';

export interface LambdaBuildOutcome {
  mode: 'ssr' | 'static';
  commitHash: string;
  commitMessage: string | null;
  author: string | null;
  versionKey: string | null;
}

/** Max concurrent builds this account may run in CodeBuild (0 = unavailable). */
export async function codeBuildCapacity(creds: AwsCredentials): Promise<number> {
  const { ServiceQuotasClient, GetServiceQuotaCommand } = await import('@aws-sdk/client-service-quotas');
  const q = new ServiceQuotasClient({ region: creds.region, credentials: creds });
  let capacity = 0;
  for (const code of ['L-9D07B6EF', 'L-1DFDD5F9']) {
    try {
      const res = await q.send(new GetServiceQuotaCommand({ ServiceCode: 'codebuild', QuotaCode: code }));
      capacity = Math.max(capacity, res.Quota?.Value ?? 0);
    } catch {
      /* quota API hiccup → treat as unavailable */
    }
  }
  return capacity;
}

/** Compile our TypeScript pipeline into the single JS file Lambda runs. */
async function bundleBuilder(): Promise<Buffer> {
  const esbuild = (await import('esbuild')) as typeof import('esbuild');
  const { tmpdir } = await import('os');
  const out = path.join(fs.realpathSync(tmpdir()), 'openhost-builder-bundle.js');
  await esbuild.build({
    entryPoints: [path.resolve(process.cwd(), 'lib/build/builder-entry.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: out,
    logLevel: 'silent',
  });
  const js = await fs.promises.readFile(out);
  fs.promises.rm(out, { force: true }).catch(() => undefined);

  // One entry file: index.js inside the deployment zip.
  const zip = new archiver.ZipArchive({ forceLocalTime: true, zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  zip.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    zip.on('end', resolve);
    zip.on('error', reject);
  });
  zip.append(js, { name: 'index.js' });
  await zip.finalize();
  await done;
  return Buffer.concat(chunks);
}

interface StatusFile {
  seq: number;
  lines: Array<{ i: number; level: 'info' | 'success' | 'error'; text: string }>;
  done: boolean;
}

interface ResultFile {
  status: 'succeeded' | 'failed';
  mode?: 'ssr' | 'static';
  commitHash?: string;
  commitMessage?: string | null;
  author?: string | null;
  versionKey?: string;
  error?: string;
}

async function gunzipJson<T>(creds: AwsCredentials, bucket: string, key: string): Promise<T | null> {
  try {
    const res = await s3Client(creds).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await res.Body!.transformToString('utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Run the build in the Lambda sandbox and return build facts. Artifacts are
 * already in the bucket when this returns (runner skips re-upload).
 */
export async function runLambdaBuilder(
  deploymentId: string,
  project: { repo: string; branch: string },
  creds: AwsCredentials,
  bucket: string,
  githubToken: string | null,
  log: LogSink
): Promise<LambdaBuildOutcome> {
  log('info', 'Build executor: AWS Lambda builder (ephemeral sandbox inside your account)');

  // ---------- 1. bundle + ship the builder -----------------------------------
  const zipBuf = await bundleBuilder();
  await uploadVersion(creds, bucket, 'openhost-builder/bundle.zip', zipBuf);
  log('success', `Builder bundle ready (${(zipBuf.length / 1024).toFixed(0)} KB)`);

  // ---------- 2. create-or-update + invoke -----------------------------------
  await ensureBuilderFunction(creds, { s3Bucket: bucket, s3Key: 'openhost-builder/bundle.zip' });
  log('success', 'Builder function "openhost-builder" ready (create-or-update)');

  const payload = {
    repo: project.repo,
    branch: project.branch,
    bucket,
    runId: deploymentId,
    token: githubToken,
  };
  const { InvokeCommand } = await import('@aws-sdk/client-lambda');
  await lambdaClient(creds).send(
    new InvokeCommand({
      FunctionName: 'openhost-builder',
      InvocationType: 'Event',
      Payload: JSON.stringify(payload),
    })
  );
  log('info', 'Build invoked — container starting in your account…');

  // ---------- 3. tail status / await result ----------------------------------
  const statusKey = `openhost-builds/${deploymentId}/status.json`;
  const resultKey = `openhost-builds/${deploymentId}/result.json`;
  const deadline = Date.now() + 14 * 60_000;
  let lastEmitted = -1;
  let sawFirstStatus = false;
  const firstStatusDeadline = Date.now() + 45_000;

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error('Builder sandbox exceeded 14 minutes without finishing (hard Lambda limit approaching)');
    }

    // Status first, result second: the builder flushes its final log lines to
    // status.json *before* writing result.json, so reading status first keeps
    // the tail of the build log in the SSE stream.
    const status: StatusFile | null = await gunzipJson(creds, bucket, statusKey);
    if (status) {
      sawFirstStatus = true;
      for (const line of status.lines) {
        if (line.i > lastEmitted) {
          lastEmitted = line.i;
          log(line.level, line.text);
        }
      }
    } else if (!sawFirstStatus && Date.now() > firstStatusDeadline) {
      throw new Error(
        'Builder sandbox did not start (no status within 45s) — likely function init failure; check Lambda logs for openhost-builder'
      );
    }

    const result: ResultFile | null = await gunzipJson(creds, bucket, resultKey);
    if (result) {
      if (result.status === 'failed') throw new Error(result.error ?? 'Lambda builder failed');
      return {
        mode: result.mode ?? 'ssr',
        commitHash: result.commitHash ?? 'unknown',
        commitMessage: result.commitMessage ?? null,
        author: result.author ?? null,
        versionKey: result.versionKey ?? null,
      };
    }

    await new Promise((r) => setTimeout(r, 2500));
  }
}
