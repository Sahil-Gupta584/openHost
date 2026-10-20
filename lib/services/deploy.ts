import { resolveCredentials } from '../aws/config';
import { assetsBucketName, ensureBucket, deployStaticAssets, deleteBucket } from '../aws/s3';
import { deploySiteFunction, deleteSiteFunction, siteFunctionName } from '../aws/lambda';
import { ensureDistribution, invalidatePaths, getDistributionByProject } from '../aws/cloudfront';
import { pointDomainAtDistribution, removeDomainRecord } from '../aws/domains';
import * as deploymentsRepo from '../supabase/queries/deployments';
import * as domainsRepo from '../supabase/queries/domains';
import * as envVarsRepo from '../supabase/queries/env-vars';

/**
 * Deploy service — orchestrates the AWS wrapper pieces into a full
 * deployment pipeline:
 *
 *   1. Resolve AWS credentials (platform mode for now).
 *   2. Ensure the project's asset bucket exists.
 *   3. Upload the build output (files are produced by the build pipeline, M3).
 *   4. Create/update the SSR Lambda from the zip + publish a version + alias.
 *   5. Create/update the CloudFront distribution wired to both origins.
 *   6. Invalidate CDN cache, wire custom domains in Route 53.
 *   7. Record the deployment in Supabase.
 *
 * Everything is idempotent — the same call either creates or updates.
 */

export interface DeployInput {
  projectId: string;
  projectName: string;
  branch: string;
  commitHash: string;
  commitMessage?: string;
  author?: string;
  region?: string;
  /** relative path → file contents for static/immutable assets */
  staticFiles: Record<string, Buffer>;
  /** key = the SSR bundle zip inside the asset bucket */
  lambdaZip: { key: string; env?: Record<string, string> };
}

export interface DeployResult {
  deploymentId: string;
  bucket: string;
  function: string;
  lambdaVersion: string;
  distributionId: string;
  distributionDomain: string;
  uploadedAssets: number;
  durationMs: number;
}

export async function deployProject(input: DeployInput): Promise<DeployResult> {
  const started = Date.now();
  const creds = await resolveCredentials({ region: input.region });
  const bucket = assetsBucketName(input.projectId);

  await ensureBucket(creds, bucket);

  const uploaded = await deployStaticAssets(creds, bucket, input.staticFiles);
  const fn = await deploySiteFunction(creds, input.projectId, {
    s3Bucket: bucket,
    s3Key: input.lambdaZip.key,
    env: input.lambdaZip.env ?? (await envVarsRepo.envVarsForProject(input.projectId)),
  });

  // Function URL so CloudFront's SSR behaviour can reach the Lambda.
  const functionUrl = await getFunctionUrl(creds, siteFunctionName(input.projectId));

  const dist = await ensureDistribution(creds, {
    projectId: input.projectId,
    bucket,
    lambdaFunctionUrl: functionUrl,
  });

  await invalidatePaths(creds, dist.id, ['/*']);

  // Wire custom domains that are already recorded for this project.
  const wiredDomains = await wireCustomDomains(creds, input.projectId, dist.domain);

  const durationMs = Date.now() - started;
  const deployment = await deploymentsRepo.createDeployment({
    projectId: input.projectId,
    commitHash: input.commitHash,
    branch: input.branch,
    commitMessage: input.commitMessage,
    author: input.author,
    status: 'ready',
    durationMs,
    lambdaVersion: fn.aliasVersion,
    buildLogs: buildLogText(input, {
      bucket,
      lambdaVersion: fn.aliasVersion,
      distributionId: dist.id,
      durationMs,
      wiredDomains,
      uploadedAssets: uploaded.uploaded,
    }),
  });

  return {
    deploymentId: deployment.id,
    bucket,
    function: siteFunctionName(input.projectId),
    lambdaVersion: fn.aliasVersion,
    distributionId: dist.id,
    distributionDomain: dist.domain,
    uploadedAssets: uploaded.uploaded,
    durationMs,
  };
}

function buildLogText(
  input: DeployInput,
  ctx: {
    bucket: string;
    lambdaVersion: string;
    distributionId: string;
    durationMs: number;
    wiredDomains: string[];
    uploadedAssets: number;
  }
) {
  return [
    `Deploying ${input.projectName}@${input.branch} (commit ${input.commitHash.slice(0, 7)})`,
    `Static assets uploaded → s3://${ctx.bucket}/static/ (${ctx.uploadedAssets} files)`,
    `Lambda version published: ${ctx.lambdaVersion}`,
    `Distribution: ${ctx.distributionId}`,
    ctx.wiredDomains.length ? `Custom domains wired: ${ctx.wiredDomains.join(', ')}` : undefined,
    `Deploy completed in ${Math.round(ctx.durationMs / 1000)}s`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function getFunctionUrl(creds: Awaited<ReturnType<typeof resolveCredentials>>, name: string) {
  const { lambdaClient } = await import('../aws/client');
  const { GetFunctionUrlConfigCommand } = await import('@aws-sdk/client-lambda');
  const res = await lambdaClient(creds).send(new GetFunctionUrlConfigCommand({ FunctionName: name }));
  return res.FunctionUrl!;
}

async function wireCustomDomains(
  creds: Awaited<ReturnType<typeof resolveCredentials>>,
  projectId: string,
  distributionDomain: string
) {
  const domains = await domainsRepo.listDomains(projectId);
  const custom = domains.filter((d) => d.type === 'custom');

  const wired: string[] = [];
  for (const d of custom) {
    const result = await pointDomainAtDistribution(creds, d.domain, distributionDomain);
    if (result.delegated && result.changed) {
      await domainsRepo.updateDomain(d.id, { status: 'active' });
    }
    if (result.delegated) wired.push(d.domain);
  }
  return wired;
}

/** Tear everything down for a project: function, distribution, bucket, domains. */
export async function destroyProject(projectId: string) {
  const creds = await resolveCredentials();
  const failures: string[] = [];

  await deleteSiteFunction(creds, projectId).catch((e) => failures.push(`lambda: ${e}`));

  const dist = await getDistributionByProject(creds, projectId);
  if (dist) {
    const { cloudFrontClient } = await import('../aws/client');
    const { UpdateDistributionCommand } = await import('@aws-sdk/client-cloudfront');
    try {
      // Distributions must be disabled then deleted (propagation ~5m).
      await cloudFrontClient(creds).send(
        new UpdateDistributionCommand({
          Id: dist.id,
          IfMatch: dist.etag,
          DistributionConfig: { ...dist.distribution, Enabled: false },
        })
      );
    } catch (e) {
      failures.push(`distribution: ${e}`);
    }
  }

  await deleteBucket(creds, assetsBucketName(projectId)).catch((e) =>
    failures.push(`bucket: ${e}`)
  );

  return { failures };
}

/** Remove a custom domain: Route 53 records first, then the DB row. */
export async function detachCustomDomain(projectId: string, domain: string) {
  const creds = await resolveCredentials();
  const removed = await removeDomainRecord(creds, domain);
  await domainsRepo.deleteDomain(projectId, domain);
  return removed;
}
