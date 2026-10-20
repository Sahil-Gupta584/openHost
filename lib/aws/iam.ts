import {
  GetRoleCommand,
  CreateRoleCommand,
  PutRolePolicyCommand,
} from '@aws-sdk/client-iam';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { iamClient } from './client';

const TRUST_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

const SITE_FUNCTION_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: 'arn:aws:logs:*:*:*',
    },
    {
      Effect: 'Allow',
      Action: ['s3:GetObject', 's3:HeadObject'],
      Resource: 'arn:aws:s3:::openhost-*/*', // project asset buckets
    },
  ],
};

/**
 * One shared execution role for all OpenHost site functions.
 * Name is passed in from lib/aws/lambda.ts.
 */
export async function basicRoleArn(creds: AwsCredentials, name: string): Promise<string> {
  const iam = iamClient(creds);

  try {
    const res = await iam.send(new GetRoleCommand({ RoleName: name }));
    return res.Role!.Arn!;
  } catch (e: unknown) {
    // SDK v3 surfaces IAM "not found" as NoSuchEntityException (CLI legacy: NoSuchEntity)
    const code = String(
      (e as { name?: string; Code?: string })?.name ?? (e as { Code?: string })?.Code ?? ''
    );
    if (!code.includes('NoSuchEntity')) throw e;
  }

  await iam.send(
    new CreateRoleCommand({
      RoleName: name,
      AssumeRolePolicyDocument: JSON.stringify(TRUST_POLICY),
      Tags: Object.entries(OPENHOST_STACK_TAGS).map(([Key, Value]) => ({ Key, Value })),
    })
  );

  await iam.send(
    new PutRolePolicyCommand({
      RoleName: name,
      PolicyName: 'openhost-site-basic',
      PolicyDocument: JSON.stringify(SITE_FUNCTION_POLICY),
    })
  );

  return `arn:aws:iam::${await callerAccount(creds)}:role/${name}`;
}

const CODEBUILD_TRUST_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'codebuild.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

/** The build container may push artifacts only — no secrets, no SDK surface. */
const CODEBUILD_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
      Resource: ['arn:aws:s3:::openhost-*', 'arn:aws:s3:::openhost-*/*'],
    },
    {
      Effect: 'Allow',
      Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: 'arn:aws:logs:*:*:log-group:/openhost/codebuild*',
    },
  ],
};

/** One shared role for all OpenHost CodeBuild containers. */
export async function codeBuildRoleArn(
  creds: AwsCredentials
): Promise<{ arn: string; created: boolean }> {
  const iam = iamClient(creds);
  const name = 'openhost-codebuild-role';

  try {
    const res = await iam.send(new GetRoleCommand({ RoleName: name }));
    return { arn: res.Role!.Arn!, created: false };
  } catch (e: unknown) {
    // SDK v3 surfaces IAM "not found" as NoSuchEntityException (CLI legacy: NoSuchEntity)
    const code = String(
      (e as { name?: string; Code?: string })?.name ?? (e as { Code?: string })?.Code ?? ''
    );
    if (!code.includes('NoSuchEntity')) throw e;
  }

  await iam.send(
    new CreateRoleCommand({
      RoleName: name,
      AssumeRolePolicyDocument: JSON.stringify(CODEBUILD_TRUST_POLICY),
      Tags: Object.entries(OPENHOST_STACK_TAGS).map(([Key, Value]) => ({ Key, Value })),
    })
  );

  await iam.send(
    new PutRolePolicyCommand({
      RoleName: name,
      PolicyName: 'openhost-codebuild-basic',
      PolicyDocument: JSON.stringify(CODEBUILD_POLICY),
    })
  );

  return { arn: `arn:aws:iam::${await callerAccount(creds)}:role/${name}`, created: true };
}

/** The Lambda build sandbox may push artifacts + build-run status files. */
export async function builderRoleArn(creds: AwsCredentials): Promise<string> {
  const iam = iamClient(creds);
  const name = 'openhost-builder-role';

  try {
    const res = await iam.send(new GetRoleCommand({ RoleName: name }));
    return res.Role!.Arn!;
  } catch (e: unknown) {
    const code = String(
      (e as { name?: string; Code?: string })?.name ?? (e as { Code?: string })?.Code ?? ''
    );
    if (!code.includes('NoSuchEntity')) throw e;
  }

  await iam.send(
    new CreateRoleCommand({
      RoleName: name,
      AssumeRolePolicyDocument: JSON.stringify(TRUST_POLICY),
      Tags: Object.entries(OPENHOST_STACK_TAGS).map(([Key, Value]) => ({ Key, Value })),
    })
  );

  await iam.send(
    new PutRolePolicyCommand({
      RoleName: name,
      PolicyName: 'openhost-builder-basic',
      PolicyDocument: JSON.stringify(CODEBUILD_POLICY),
    })
  );

  return `arn:aws:iam::${await callerAccount(creds)}:role/${name}`;
}

// Account id is required to build the ARN for a freshly created role.
let cachedAccount: string | null = null;
async function callerAccount(creds: AwsCredentials): Promise<string> {
  if (cachedAccount) return cachedAccount;
  const { stsClient } = await import('./client');
  const { GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
  const res = await stsClient(creds).send(new GetCallerIdentityCommand({}));
  cachedAccount = res.Account!;
  return cachedAccount;
}
