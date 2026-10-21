import {
  CreateFunctionCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  CreateAliasCommand,
  UpdateAliasCommand,
  GetAliasCommand,
  PublishVersionCommand,
  type Architecture,
  type Runtime,
} from '@aws-sdk/client-lambda';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { lambdaClient } from './client';
import { basicRoleArn } from './iam';

/**
 * SSR/host functions follow the naming scheme:
 *   openhost-<projectId>-site
 * Each deployment updates the function's code and points the "live" alias
 * at it — CloudFront reads the alias, so rollbacks are atomic (alias switch).
 */

export function siteFunctionName(projectId: string) {
  return `openhost-${projectId}-site`.toLowerCase();
}

const LIVE_ALIAS = 'live';

export async function functionExists(creds: AwsCredentials, name: string) {
  try {
    await lambdaClient(creds).send(new GetFunctionCommand({ FunctionName: name }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create or update the SSR/host function for a project with a package
 * stored in S3. The "live" alias always points at the new published
 * version — CloudFront reads the alias, so rollbacks are atomic.
 */
export async function deploySiteFunction(
  creds: AwsCredentials,
  projectId: string,
  opts: {
    /** S3 URI of the deployment package, e.g. s3://bucket/versions/a12.zip */
    s3Bucket: string;
    s3Key: string;
    env: Record<string, string>;
    handler?: string;
    runtime?: Runtime;
    architectures?: Architecture[];
    layers?: string[];
    memoryMb?: number;
    timeoutSec?: number;
  }
) {
  const lambda = lambdaClient(creds);
  const name = siteFunctionName(projectId);
  const exists = await functionExists(creds, name);
  const runtime = opts.runtime ?? 'nodejs20.x';
  const handler = opts.handler ?? 'index.handler';
  const architectures = opts.architectures ?? (['arm64'] as Architecture[]);

  if (!exists) {
    const roleArn = await basicRoleArn(creds, 'openhost-lambda-site-role');
    // A freshly created role takes seconds to propagate — Lambda validates
    // trust on create, so retry through the assume-role window.
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await lambda.send(
          new CreateFunctionCommand({
            FunctionName: name,
            Role: roleArn,
            Runtime: runtime,
            Handler: handler,
            Code: { S3Bucket: opts.s3Bucket, S3Key: opts.s3Key },
            Timeout: opts.timeoutSec ?? 10,
            MemorySize: opts.memoryMb ?? 1769,
            Environment: { Variables: opts.env },
            Layers: opts.layers ?? [],
            Architectures: architectures,
            Tags: { ...OPENHOST_STACK_TAGS },
          })
        );
        break;
      } catch (e: unknown) {
        const msg = String((e as Error).message ?? '');
        const notAssumable = /cannot be assumed by Lambda|not authorized to perform: iam:PassRole/.test(msg);
        if (!notAssumable || attempt === 5) throw e;
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }
  } else {
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: name,
        Environment: { Variables: opts.env },
        Handler: handler,
        Timeout: opts.timeoutSec ?? 10,
        MemorySize: opts.memoryMb ?? 1769,
        ...(opts.layers ? { Layers: opts.layers } : {}),
      })
    );
  // Configuration updates are async; code uploads need the update to settle.
  await waitForFunctionUpdate(creds, name);
  await lambda.send(
    new UpdateFunctionCodeCommand({
      FunctionName: name,
      S3Bucket: opts.s3Bucket,
      S3Key: opts.s3Key,
      Architectures: architectures,
    })
  );
  }

  // Publish/alias flips require State=Active (fresh functions start Pending).
  await waitForFunctionUpdate(creds, name);
  await publishAndPointAlias(creds, name, LIVE_ALIAS);
  const live = await getAliasVersion(creds, name, LIVE_ALIAS);

  return { function: name, aliasVersion: live };
}

async function waitForFunctionUpdate(creds: AwsCredentials, name: string) {
  const lambda = lambdaClient(creds);
  for (let i = 0; i < 60; i++) {
    const res = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
    const state = res.Configuration?.State;
    const status = res.Configuration?.LastUpdateStatus;
    // Fresh functions report State=Pending; invokes during that window fail.
    if (state === 'Active' && (!status || status === 'Successful')) return;
    if (status === 'Failed') throw new Error(`Lambda function update failed for ${name}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for Lambda update of ${name}`);
}

async function publishAndPointAlias(creds: AwsCredentials, name: string, alias: string) {
  const lambda = lambdaClient(creds);
  const { PublishVersionCommand } = await import('@aws-sdk/client-lambda');
  const version = await lambda.send(
    new PublishVersionCommand({ FunctionName: name })
  );
  const versionNum = version.Version!;

  try {
    await lambda.send(new GetAliasCommand({ FunctionName: name, Name: alias }));
    await lambda.send(new UpdateAliasCommand({ FunctionName: name, Name: alias, FunctionVersion: versionNum }));
  } catch {
    await lambda.send(
      new CreateAliasCommand({ FunctionName: name, Name: alias, FunctionVersion: versionNum })
    );
  }

  await new Promise((r) => setTimeout(r, 500));
}

async function getAliasVersion(creds: AwsCredentials, name: string, alias: string) {
  const a = await lambdaClient(creds).send(new GetAliasCommand({ FunctionName: name, Name: alias }));
  return a.FunctionVersion ?? '$LATEST';
}

/**
 * The Lambda build sandbox: one shared function that clones the repo, builds
 * it and pushes artifacts to the project bucket — everything the CodeBuild
 * container does, running as a single ephemeral invocation (10GB /tmp, 14.5
 * min cap). Its JS bundle is regenerated per deploy so pipeline changes land
 * without infrastructure churn.
 */
export function builderFunctionName() {
  return 'openhost-builder';
}

export async function ensureBuilderFunction(
  creds: AwsCredentials,
  pkg: { s3Bucket: string; s3Key: string }
) {
  const lambda = lambdaClient(creds);
  const name = builderFunctionName();
  const exists = await functionExists(creds, name);
  const { builderRoleArn } = await import('./iam');

  if (!exists) {
    const roleArn = await builderRoleArn(creds);
    // A freshly created role takes seconds to propagate — Lambda validates
    // trust on create, so retry through the assume-role window (same deal as
    // deploySiteFunction below).
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await lambda.send(
          new CreateFunctionCommand({
            FunctionName: name,
            Role: roleArn,
            Runtime: 'nodejs20.x',
            Handler: 'index.handler',
            Code: { S3Bucket: pkg.s3Bucket, S3Key: pkg.s3Key },
            Timeout: 870,
            MemorySize: 3008,
            EphemeralStorage: { Size: 8192 },
            Tags: { ...OPENHOST_STACK_TAGS },
          })
        );
        break;
      } catch (e: unknown) {
        const msg = String((e as Error).message ?? '');
        const notAssumable = /cannot be assumed by Lambda|not authorized to perform: iam:PassRole/.test(msg);
        if (!notAssumable || attempt === 5) throw e;
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }
  } else {
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: name,
        Handler: 'index.handler',
        Timeout: 870,
        MemorySize: 3008,
        EphemeralStorage: { Size: 8192 },
      })
    );
    await waitForFunctionUpdate(creds, name);
    await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: name,
        S3Bucket: pkg.s3Bucket,
        S3Key: pkg.s3Key,
      })
    );
  }
  await waitForFunctionUpdate(creds, name);
  return name;
}

export async function deleteSiteFunction(creds: AwsCredentials, projectId: string) {  const lambda = lambdaClient(creds);
  const name = siteFunctionName(projectId);
  if (!(await functionExists(creds, name))) return;

  const { DeleteAliasCommand, ListVersionsByFunctionCommand, DeleteFunctionCommand } =
    await import('@aws-sdk/client-lambda');

  try {
    await lambda.send(new DeleteAliasCommand({ FunctionName: name, Name: LIVE_ALIAS }));
  } catch {
    /* alias may not exist */
  }

  // Lambda requires deleting all versions before deleting the function.
  let marker: string | undefined;
  do {
    const res = await lambda.send(
      new ListVersionsByFunctionCommand({ FunctionName: name, Marker: marker, MaxItems: 100 })
    );
    for (const v of res.Versions ?? []) {
      if (v.Version === '$LATEST') continue;
      await lambda.send(
        new DeleteFunctionCommand({ FunctionName: name, Qualifier: v.Version! })
      );
    }
    marker = res.NextMarker;
  } while (marker);

  await lambda.send(new DeleteFunctionCommand({ FunctionName: name }));
}
