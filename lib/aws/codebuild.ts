import {
  BatchGetBuildsCommand,
  BatchGetProjectsCommand,
  CodeBuildClient,
  CreateProjectCommand,
  StartBuildCommand,
  UpdateProjectCommand,
  type EnvironmentVariable,
} from '@aws-sdk/client-codebuild';
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { codeBuildRoleArn } from './iam';

/**
 * CodeBuild executor wiring — builds run in an ephemeral container in the
 * user's AWS account instead of the OpenHost host machine (see
 * lib/build/buildspec.ts for the build script itself).
 *
 * One build project per OpenHost project: `openhost-<projectId>-builder`.
 * It is created once and *updated* per deploy (repo / branch / inline
 * buildspec), so nothing idles or costs anything between builds.
 */

const LOG_GROUP = '/openhost/codebuild';
/**
 * Classic EC2 build environment: the only combo that validates on brand-new
 * accounts (the Lambda curated images are rejected there until the image
 * catalog is populated) and the only one with guaranteed internet + prebuilt
 * awscli/zip. Config: LINUX_CONTAINER + aws/codebuild/standard:7.0 +
 * BUILD_GENERAL1_SMALL; Node 20 self-installed by the buildspec via nvm.
 */
const BUILDER_ENV_TYPE = 'LINUX_CONTAINER' as const;
const BUILDER_COMPUTE = 'BUILD_GENERAL1_SMALL' as const;
const BUILDER_IMAGE = 'aws/codebuild/standard:7.0';

function codeBuildClient(creds: AwsCredentials): CodeBuildClient {
  return new CodeBuildClient({ region: creds.region, credentials: creds });
}

function codeBuildLogsClient(creds: AwsCredentials): CloudWatchLogsClient {
  return new CloudWatchLogsClient({ region: creds.region, credentials: creds });
}

export function builderName(projectId: string): string {
  return `openhost-${projectId}-builder`;
}

export interface BuilderOpts {
  repo: string;
  branch: string;
  /** Inline buildspec (lib/build/buildspec.ts). */
  buildspec: string;
  /** GitHub token for private repos (personal access token auth). */
  token?: string | null;
}

/** Create-or-update the per-project builder and return its name. */
export async function ensureBuilder(
  creds: AwsCredentials,
  projectId: string,
  opts: BuilderOpts
): Promise<string> {
  const cb = codeBuildClient(creds);
  const name = builderName(projectId);
  const serviceRoleInfo = await codeBuildRoleArn(creds);

  // A freshly created role takes a few seconds to propagate — CodeBuild
  // validates the trust policy the moment a project/build references it
  // and fails with "sts:AssumeRole ... not authorized" otherwise.
  if (serviceRoleInfo.created) {
    await sleep(5_000);
  }
  const serviceRole = serviceRoleInfo.arn;

  const project = {
    name,
    description: 'OpenHost ephemeral Next.js builder (created automatically)',
    source: {
      type: 'GITHUB' as const,
      location: `https://github.com/${opts.repo}.git`,
      gitCloneDepth: 1,
      buildspec: opts.buildspec,
      ...(opts.token
        ? // GitHub PAT is stored as an OAUTH-type source auth
          { auth: { type: 'OAUTH' as const, resource: opts.token } }
        : {}),
    },
    artifacts: { type: 'NO_ARTIFACTS' as const }, // buildspec uploads to S3 directly
    environment: {
      type: BUILDER_ENV_TYPE,
      image: BUILDER_IMAGE,
      computeType: BUILDER_COMPUTE,
      imagePullCredentialsType: 'CODEBUILD' as const,
    },
    serviceRole,
    timeoutInMinutes: 40,
    queuedTimeoutInMinutes: 10,
    logsConfig: {
      cloudWatchLogs: {
        status: 'ENABLED' as const,
        groupName: LOG_GROUP,
      },
    },
    tags: Object.entries(OPENHOST_STACK_TAGS).map(([key, value]) => ({ key, value })),
  };

  const existing = await cb.send(new BatchGetProjectsCommand({ names: [name] }));
  if (existing.projects && existing.projects.length > 0) {
    await cb.send(new UpdateProjectCommand(project));
  } else {
    await cb.send(new CreateProjectCommand(project));
  }
  return name;
}

/**
 * Kick off a build run. Bucket name + AWS region + the project's env vars
 * arrive as overrides; the buildspec shells into them ($BUCKET etc).
 */
export async function startBuilderRun(
  creds: AwsCredentials,
  projectId: string,
  env: Record<string, string>
): Promise<string /* buildId */> {
  const overrides = envVarsToSdk({
    BUCKET: env.BUCKET ?? '',
    AWS_DEFAULT_REGION: creds.region,
    ...env,
  });

  const input = {
    projectName: builderName(projectId),
    environmentVariablesOverride: overrides,
  };

  // IAM trust propagation races are real: retry the assume-role window.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await codeBuildClient(creds).send(new StartBuildCommand(input));
      const id = res.build?.id;
      if (!id) throw new Error('CodeBuild did not return a build id');
      return id;
    } catch (e: unknown) {
      const message = String((e as Error).message ?? '');
      const assumable =
        message.includes('AssumeRole') || message.includes('not authorized to perform: sts');
      if (!assumable || attempt === 5) throw e;
      await sleep(4_000);
    }
  }
  throw new Error('unreachable');
}

function envVarsToSdk(env: Record<string, string>): EnvironmentVariable[] {
  const vars: EnvironmentVariable[] = [];
  const entries: Array<[string, string]> = [];
  for (const key of Object.keys(env)) {
    if (env[key] !== '') entries.push([key, env[key]]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [name, value] of entries) {
    vars.push({ name, value, type: 'PLAINTEXT' });
  }
  return vars;
}

const FINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'FAULT', 'TIMED_OUT', 'STOPPED'];

const PHASE_LABELS: Record<string, string> = {
  PROVISIONING: 'Provisioning build container',
  DOWNLOAD_SOURCE: 'Fetching source from GitHub',
  INSTALL: 'Preparing environment',
  PRE_BUILD: 'Preparing project configuration',
  BUILD: 'Building application',
  POST_BUILD: 'Packaging artifacts',
};

const MARKER_RE = /^.*\[openhost\] (MODE|COMMIT_MSG|AUTHOR)=(.*)$/;

export interface CodeBuildOutcome {
  status: string;
  commitHash: string | null;
  mode: 'ssr' | 'static' | null;
  commitMessage: string | null;
  author: string | null;
  durationMs: number;
}

/**
 * Watches a build until it finishes, relaying CloudWatch log lines (`[openhost]`
 * markers included) into the provided log sink — this is what makes the
 * dashboard deploy stream show the container build live.
 */
export async function waitForCodeBuild(
  creds: AwsCredentials,
  buildId: string,
  log: (level: 'info' | 'success' | 'error', text: string) => void,
  /** Invoked whenever the top-level CodeBuild status changes. */
  onStatusChange?: (status: string) => void | Promise<void>
): Promise<CodeBuildOutcome> {
  const cb = codeBuildClient(creds);
  const cw = codeBuildLogsClient(creds);
  const startedAt = Date.now();

  let nextToken: string | undefined;
  let lastPhase = '';
  let lastStatus = '';
  let mode: 'ssr' | 'static' | null = null;
  let commitMessage: string | null = null;
  let author: string | null = null;

  for (;;) {
    // ---- relay log tail --------------------------------------------------
    try {
      const res = await cw.send(
        new GetLogEventsCommand({
          logGroupName: LOG_GROUP,
          logStreamName: buildId,
          startFromHead: true,
          ...(nextToken ? { nextToken } : {}),
        })
      );
      const events = res.events ?? [];
      for (const ev of events) {
        const text = (ev.message ?? '').replace(/\s+$/, '');
        if (!text) continue;
        const marker = MARKER_RE.exec(text);
        if (marker) {
          const key = marker[1];
          const value = marker[2];
          if (key === 'MODE' && (value === 'ssr' || value === 'static')) {
            mode = value;
          } else if (key === 'COMMIT_MSG') {
            commitMessage = value;
          } else if (key === 'AUTHOR') {
            author = value;
          }
        }
        log('info', text);
      }
      if (res.nextForwardToken) nextToken = res.nextForwardToken;
    } catch (e: unknown) {
      // Stream appears a few seconds into provisioning — fine while polling.
      const code = (e as { name?: string })?.name ?? (e as { Code?: string })?.Code;
      if (code !== 'ResourceNotFoundException') {
        log('info', `log-tail unavailable (${String(code)}) — continuing`);
      }
    }

    // ---- status / phases --------------------------------------------------
    let build: Awaited<ReturnType<typeof fetchBuild>> | null = null;
    try {
      build = await fetchBuild(cb, buildId);
    } catch {
      // transient describe failures shouldn't kill the watcher
    }

    if (build) {
      const phase = build.currentPhase ?? '';
      if (phase && phase !== lastPhase) {
        lastPhase = phase;
        const label = PHASE_LABELS[phase];
        if (label) log('info', label);
        if (phase === 'QUEUED') {
          log('info', 'Build is in the CodeBuild queue (waiting for build capacity)');
          await onStatusChange?.('QUEUED');
        } else if (FINAL_STATUSES.indexOf(build.buildStatus ?? 'IN_PROGRESS') === -1) {
          // first phase past the queue → the build is actually running now
          await onStatusChange?.('IN_PROGRESS');
        }
      }
    }

    if (FINAL_STATUSES.indexOf(status) !== -1) {
      return {
        status,
        commitHash: build?.resolvedSourceVersion ?? null,
        mode,
        commitMessage,
        author,
        durationMs: Date.now() - startedAt,
      };
    }

    if (Date.now() - startedAt > 40 * 60_000) {
      throw new Error('CodeBuild did not finish within 40 minutes');
    }

    await sleep(1_500);
  }
}

async function fetchBuild(cb: CodeBuildClient, buildId: string) {
  const res = await cb.send(new BatchGetBuildsCommand({ ids: [buildId] }));
  return res.builds?.[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deleteBuilder(creds: AwsCredentials, projectId: string): Promise<void> {
  const { DeleteProjectCommand } = await import('@aws-sdk/client-codebuild');
  await codeBuildClient(creds)
    .send(new DeleteProjectCommand({ name: builderName(projectId) }))
    .catch(() => undefined);
}
