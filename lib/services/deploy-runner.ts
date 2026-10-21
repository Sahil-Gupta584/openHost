import { resolveCredentials } from '../aws/config';
import { assetsBucketName, ensureBucket, deployStaticAssets, uploadVersion } from '../aws/s3';
import { lambdaWebAdapterLayer } from '../aws/layers';
import { deploySiteFunction, deleteSiteFunction, siteFunctionName } from '../aws/lambda';
import { ensureBuilder, startBuilderRun, waitForCodeBuild } from '../aws/codebuild';
import { ensureHttpGateway } from '../aws/apigw';
import { ensureDistribution, invalidatePaths, getDistributionByProject } from '../aws/cloudfront';
import { resolveGithubToken } from './github';
import { generateOpenHostBuildspec } from '../build/buildspec';
import { runLambdaBuilder } from '../build/lambda-builder';
import { buildRepo, type BuildResult } from '../build/pipeline';
import { cleanupDir } from '../build/process';
import { lambdaClient } from '../aws/client';
import * as deploymentsRepo from '../supabase/queries/deployments';
import * as deployBus from './deploy-bus';
import * as envVarsRepo from '../supabase/queries/env-vars';

/**
 * Deployment runner — the live version of lib/services/deploy.
 * Emits Vercel-style progress events (building → packaging → CDN) while real
 * work happens, then records the final deployment row in Supabase.
 *
 * Build executors:
 *   codebuild (default) — ephemeral container in the user's AWS account;
 *                         logs relayed from CloudWatch into our SSE stream.
 *   local               — in-process child processes (dev fallback).
 *
 * Runs fire-and-forget from POST /deploy; the deploy detail page watches
 * the SSE stream. In-flight guard prevents double-starting a project.
 */

type BuildExecutor = 'codebuild' | 'lambda' | 'local';

/**
 * Pick the off-host build executor per deploy:
 *   Lambda      — ephemeral build sandbox in the user's account (default)
 *   codebuild   — only when explicitly forced via OPENHOST_BUILD_MODE
 *   local       — dev fallback when no AWS creds exist (builds on this machine)
 *
 * We auto-preferred CodeBuild while the account's concurrent-build quota case
 * was pending, but the Service Quotas probe can report the default value before
 * AWS actually accepts StartBuild — parking deployments on a false positive.
 * Until that quota case lands, builds skip CodeBuild entirely.
 */
async function decideBuildExecutor(): Promise<BuildExecutor> {
  const explicit = process.env.OPENHOST_BUILD_MODE;
  if (explicit === 'codebuild' || explicit === 'lambda' || explicit === 'local') return explicit;
  if (!process.env.AWS_ACCESS_KEY_ID) return 'local';
  return 'lambda';
}

const buildingUserspace = new Set<string>();

export interface StartDeployInput {
  projectId: string;
}

export async function startDeployment(input: StartDeployInput): Promise<string> {
  const { getProjectById } = await import('../supabase/queries/projects');
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error('Project not found');

  if (buildingUserspace.has(project.id)) {
    throw new Error('A deployment is already running for this project');
  }

  const executor = await decideBuildExecutor();
  const deployment = await deploymentsRepo.createDeployment({
    projectId: project.id,
    commitHash: 'pending',
    branch: project.branch,
    // Lambda starts building within the pipeline's first lines — record it as
    // building so the deploy log never shows the CodeBuild parking line.
    status: executor === 'codebuild' ? 'queued' : 'building',
    buildLogs: '',
  });

  buildingUserspace.add(project.id);
  void runPipeline(project, deployment.id, executor)
    .catch((e) => console.error('[openhost] runner crashed', e))
    .finally(() => buildingUserspace.delete(project.id));

  return deployment.id;
}

async function runPipeline(
  project: { id: string; name: string; repo: string; branch: string; region: string },
  deploymentId: string,
  executor: BuildExecutor
) {
  const started = Date.now();
  const log = makeLogger(deploymentId);

  let status: 'ready' | 'error' = 'error';
  let errorMessage: string | null = null;
  let productionUrl: string | null = null;
  let localBuild: BuildResult | null = null;

  // ---- deployment facts (filled by either executor) ------------------------
  let mode: 'ssr' | 'static' = 'ssr';
  let commitHash = 'unknown';
  let commitMessage: string | null = null;
  let author: string | null = null;
  /** Executor already pushed artifacts to the bucket → skip duplicate upload. */
  let artifactsInBucket = false;

  try {
    // ---- AWS: bucket first (the builder pushes artifacts into it) ---------
    const creds = await resolveCredentials({ region: project.region });
    const bucket = assetsBucketName(project.id);
    await ensureBucket(creds, bucket);

    if (executor === 'codebuild') {
      // ---- build in an ephemeral container inside the user's AWS account --
      log('info', `Deploying ${project.repo} at "${project.branch}"`);
      log('info', 'Build executor: AWS CodeBuild (ephemeral container, not this machine)');
      const githubToken = await resolveGithubToken();
      const buildspec = generateOpenHostBuildspec({ bucket });

      const builder = await ensureBuilder(creds, project.id, {
        repo: project.repo,
        branch: project.branch,
        buildspec,
        token: githubToken,
      });
      log('success', `Builder "${builder}" ready (create-or-update)`);

      const env: Record<string, string> = {
        BUCKET: bucket,
        ...(await envVarsRepo.envVarsForProject(project.id)),
      };

      // CodeBuild may still refuse StartBuild while the account's
      // concurrent-build quota case is pending. Never park: run the Lambda
      // builder instead — same pipeline, artifacts land in the same bucket.
      let buildId: string | null = null;
      try {
        buildId = await startBuilderRun(creds, project.id, env);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const capacity =
          /AccountLimitExceededException|Cannot have more than 0 builds in queue|is not supported for projects with environment type/.test(
            msg
          );
        if (!capacity) throw e;
        log(
          'info',
          'AWS CodeBuild not accepting builds yet (quota case pending) — switching to the Lambda builder, no waiting'
        );
        await deploymentsRepo
          .updateDeployment(deploymentId, { status: 'building' })
          .catch(() => undefined);
        const build = await runLambdaBuilder(deploymentId, project, creds, bucket, githubToken, log);
        mode = build.mode;
        commitHash = build.commitHash;
        commitMessage = build.commitMessage;
        author = build.author;
        artifactsInBucket = true;
        void localBuild; // nothing to clean up — container was ephemeral
      }
      if (buildId) {
        log('success', `Build queued: ${buildId}`);

        const outcome = await waitForCodeBuild(creds, buildId, log, async (cbStatus) => {
          // CodeBuild queue → we stay 'queued'; first real execution → 'building'
          if (cbStatus === 'IN_PROGRESS') {
            await deploymentsRepo
              .updateDeployment(deploymentId, { status: 'building' })
              .catch(() => undefined);
          }
        });
        if (outcome.status !== 'SUCCEEDED') {
          throw new Error(`CodeBuild finish status: ${outcome.status} (see log above)`);
        }
        log(
          'success',
          `CodeBuild ${outcome.status} in ${ms(outcome.durationMs)} — ${
            outcome.mode === 'static' ? 'static assets' : 'SSR bundle'
          } in s3://${bucket}/`
        );

        mode = outcome.mode ?? 'ssr';
        commitHash = outcome.commitHash ?? 'unknown';
        commitMessage = outcome.commitMessage;
        author = outcome.author;
        artifactsInBucket = true;
        void localBuild; // nothing to clean up — container was ephemeral
      }
    } else if (executor === 'lambda') {
      // ---- build in an ephemeral Lambda sandbox inside the user's account --
      log('info', `Deploying ${project.repo} at "${project.branch}"`);
      const githubToken = await resolveGithubToken();
      // Reflect the build as "building" from the moment the sandbox starts —
      // the whole build happens inside runLambdaBuilder.
      await deploymentsRepo
        .updateDeployment(deploymentId, { status: 'building' })
        .catch(() => undefined);
      const build = await runLambdaBuilder(deploymentId, project, creds, bucket, githubToken, log);

      mode = build.mode;
      commitHash = build.commitHash;
      commitMessage = build.commitMessage;
      author = build.author;
      artifactsInBucket = true;
      void localBuild; // nothing to clean up — container was ephemeral
    } else {
      // ---- build locally (dev fallback) ------------------------------------
      log('info', `Deploying ${project.repo} at "${project.branch}"`);
      log('info', `Build executor: local (set OPENHOST_BUILD_MODE=codebuild to offload)`);
      const githubToken = await resolveGithubToken();
      localBuild = await buildRepo({
        repo: project.repo,
        branch: project.branch,
        log,
        token: githubToken,
      });
      mode = localBuild.mode;
      commitHash = localBuild.commitHash;
      commitMessage = localBuild.commitMessage;
      author = localBuild.author;
    }

    await deploymentsRepo.updateDeployment(deploymentId, {
      commit_hash: commitHash,
      commit_message: commitMessage ?? undefined,
      author: author ?? undefined,
    });

    // ---- mode-specific package push + SSR Lambda --------------------------
    let lambdaFunctionUrl: string | undefined;

    if (mode === 'ssr') {
      const versionKey = `versions/${commitHash}.zip`;

      if (!artifactsInBucket) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const zip = localBuild!.lambdaZip;
        const version = await uploadVersion(creds, bucket, versionKey, zip);
        log(
          'success',
          `Function bundle uploaded → s3://${bucket}/${versionKey} (${(version.sizeBytes / 1024 / 1024).toFixed(1)} MB)`
        );
      } else {
        log('success', `Function bundle in place → s3://${bucket}/${versionKey}`);
      }

      log('info', 'Resolving Lambda Web Adapter layer (public ARN)');
      const adapterLayer = await lambdaWebAdapterLayer(creds, 'x86_64');

      log('info', 'Deploying SSR Lambda — standalone Next server booted by run.sh');
      await deploySiteFunction(creds, project.id, {
        s3Bucket: bucket,
        s3Key: versionKey,
        env: {
          ...(await envVarsRepo.envVarsForProject(project.id)),
          PORT: '8000',
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
          AWS_LWA_ENABLE_COMPRESSION: 'true',
        },
        handler: 'run.sh',
        runtime: 'nodejs20.x',
        architectures: ['x86_64'],
        layers: [adapterLayer],
        // Next 16 standalone cold start on 1 vCPU can exceed 30s — headroom.
        memoryMb: 2048,
        timeoutSec: 60,
      });
      log('success', 'SSR Lambda published + live alias updated');

      // Serve everything through the function (static ships inside the lambda).
      lambdaFunctionUrl = await getFunctionUrl(creds, siteFunctionName(project.id));
      log('success', 'SSR function URL ready');
    } else {
      if (!artifactsInBucket) {
        const upload = await deployStaticAssets(creds, bucket, localBuild?.files ?? {});
        log('success', `Uploaded ${upload.uploaded} files → s3://${bucket}/static/`);
      } else {
        log('success', `Static assets in place → s3://${bucket}/static/`);
      }
    }

    // ---- AWS: CDN ---------------------------------------------------------
    try {
      const dist = await getDistributionByProject(creds, project.id);
      if (!dist) {
        log('info', 'Creating CloudFront distribution');
      }
      const ensured = await ensureDistribution(creds, {
        projectId: project.id,
        bucket,
        lambdaFunctionUrl, // undefined in static mode → S3 default origin
      });
      log(
        'success',
        `${ensured.refreshed ? 'Updated' : 'Created'} distribution ${ensured.domain}${mode === 'ssr' ? ' → SSR via Lambda' : ''}`
      );

      log('info', 'Invalidating CDN cache (/*)');
      await invalidatePaths(creds, ensured.id, ['/*']);
      log('success', 'Cache invalidated');

      // Honest URL for now: the real CloudFront distribution. A vanity domain
      // on openhost.app requires owning it + Route 53 (custom-domains milestone).
      productionUrl = `https://${ensured.domain}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const verifyGate = /must be verified/i.test(msg);
      if (!verifyGate || !lambdaFunctionUrl) throw e;

      // New AWS accounts need a Support-issued account verification before
      // CloudFront accepts new resources (API can't bypass it). Until AWS
      // clears it, production traffic goes through an API Gateway HTTP API
      // ($default proxy → the SSR Lambda — real public HTTPS in this account).
      log(
        'error',
        'CloudFront is blocked: this AWS account must be verified by AWS Support before adding new CloudFront resources (a support case is needed — no API can bypass it).'
      );
      const gateway = await ensureHttpGateway(creds, {
        projectId: project.id,
        functionName: siteFunctionName(project.id),
      });
      productionUrl = gateway.endpoint;
      log(
        'success',
        `Live now → ${gateway.endpoint} (API Gateway → SSR Lambda in your AWS account; same app CloudFront fronts once the account verification clears — no rebuild needed)`
      );
    }

    status = 'ready';

    await deploymentsRepo.updateDeployment(deploymentId, {
      status: 'ready',
      duration_ms: Date.now() - started,
      build_logs: logText(deploymentId),
      production_url: productionUrl, // AWS origin — the /~/ proxy fronts it
    });
    log('success', `Deployed → ${productionUrl} (live) in ${ms(Date.now() - started)}`);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    // Translate raw AWS noise into something actionable.
    if (/Cannot have more than 0 builds in queue/.test(errorMessage)) {
      errorMessage =
        'AWS CodeBuild capacity is not provisioned yet (new AWS accounts start at 0 concurrent builds). ' +
        'A quota-increase case is open with AWS — this deploy is retried automatically as soon as capacity is granted.';
    } else if (/is not supported for projects with environment type/.test(errorMessage)) {
      errorMessage =
        'AWS CodeBuild build environment is not available yet in this account (image catalog still empty while the ' +
        'quota case is pending). This deploy is retried automatically once the capacity quota is approved.';
    }
    log('error', errorMessage);

    await deploymentsRepo
      .updateDeployment(deploymentId, {
        status: 'error',
        duration_ms: Date.now() - started,
        build_logs: logText(deploymentId),
      })
      .catch(() => undefined);
  } finally {
    // Sync the tail of the log that arrived after the terminal row write,
    // then stop the incremental flusher.
    log.stop();
    await deploymentsRepo
      .updateDeployment(deploymentId, { build_logs: logText(deploymentId) })
      .catch(() => undefined);
    deployBus.publishEvent(deploymentId, {
      type: 'status',
      status,
      ...(productionUrl ? { url: productionUrl } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
      durationMs: Date.now() - started,
    });
    if (localBuild) await cleanupDir(localBuild.workdir);
  }
}

// ---- log glue -----------------------------------------------------------------

type LogEmit = (level: 'info' | 'success' | 'error', text: string) => void;

interface LoggerHandle extends LogEmit {
  /** Stop the incremental DB flusher (terminal row write takes over). */
  stop: () => void;
}

/**
 * Logs go to the in-memory SSE bus (same-instance replay) AND flush to
 * Supabase every 500ms — on Vercel the deploy orchestrator and the /stream
 * route are DIFFERENT Lambda instances, so the DB is the only reliable
 * channel across them. Flushing incrementally (not just at terminal
 * transitions) is what makes the live build log work off-process.
 */
function makeLogger(deploymentId: string): LoggerHandle {
  let timer: ReturnType<typeof setInterval> | null = setInterval(
    () =>
      deploymentsRepo
        .updateDeployment(deploymentId, { build_logs: logText(deploymentId) })
        .catch(() => undefined), // stream still works same-instance; final row holds last write
    500
  );

  const emit = ((level: 'info' | 'success' | 'error', text: string) => {
    deployBus.publishEvent(deploymentId, { type: 'log', level, text });
    if (deployBus.history(deploymentId).length >= 400) emit.stop(); // cap DB churn on pathological logs
  }) as LoggerHandle;

  emit.stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  return emit;
}

/** Full log so far — persisted to Supabase at status transitions. */
function logText(deploymentId: string): string {
  const lines: string[] = [];
  for (const e of deployBus.history(deploymentId)) {
    if (e.type === 'log') lines.push(e.text);
  }
  return lines.join('\n');
}

function ms(n: number) {
  return `${Math.round(n / 1000)}s`;
}

/** Ensure the Lambda Function URL exists (auth NONE) — used as a CloudFront origin. */
async function getFunctionUrl(creds: Awaited<ReturnType<typeof resolveCredentials>>, name: string) {
  const { GetFunctionUrlConfigCommand, CreateFunctionUrlConfigCommand } = await import(
    '@aws-sdk/client-lambda'
  );
  try {
    const res = await lambdaClient(creds).send(new GetFunctionUrlConfigCommand({ FunctionName: name }));
    if (res?.FunctionUrl) return res.FunctionUrl!;
  } catch {
    /* not configured yet → create below */
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const created = await lambdaClient(creds).send(
        new CreateFunctionUrlConfigCommand({ FunctionName: name, AuthType: 'NONE' })
      );
      await new Promise((r) => setTimeout(r, 500));
      return created.FunctionUrl!;
    } catch (e) {
      const msg = String((e as Error).message ?? '');
      if (/already exists/i.test(msg)) {
        const res = await lambdaClient(creds).send(
          new GetFunctionUrlConfigCommand({ FunctionName: name })
        );
        return res.FunctionUrl!;
      }
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  throw new Error('Could not create or fetch the Lambda Function URL');
}
