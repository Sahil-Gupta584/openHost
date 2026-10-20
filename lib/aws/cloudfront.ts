import {
  CreateDistributionWithTagsCommand,
  UpdateDistributionCommand,
  CreateInvalidationCommand,
  GetInvalidationCommand,
  type DistributionConfig,
  type Origin,
  type DefaultCacheBehavior,
  type CacheBehaviors,
  type Method,
  type SslProtocol,
} from '@aws-sdk/client-cloudfront';
import {
  ListDistributionsCommand,
  GetDistributionCommand,
} from '@aws-sdk/client-cloudfront';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { cloudFrontClient } from './client';

/**
 * Per project: one distribution with two behaviours
 *   default behaviour  → Lambda function URL (SSR, App Router / route handlers)
 *   `/static/*`        → S3 origin (immutable build assets)
 * The Comment carries a machine-readable tag so we can look the
 * distribution up later without storing extra state.
 */

export function cfComment(projectId: string) {
  return `openhost:project=${projectId}`;
}

export async function getDistributionByProject(creds: AwsCredentials, projectId: string) {
  const cf = cloudFrontClient(creds);
  const res = await cf.send(new ListDistributionsCommand({}));
  const match = (res.DistributionList?.Items ?? []).find(
    (d) => d.Comment === cfComment(projectId)
  );
  if (!match) return null;
  // List gives no ETag; fetch the full config for updates/invalidation.
  const full = await cf.send(new GetDistributionCommand({ Id: match.Id! }));
  return {
    id: match.Id!,
    domain: match.DomainName!,
    etag: full.ETag!,
    distribution: full.Distribution!.DistributionConfig!,
  };
}

const HEADERS_BOTH: Method[] = ['HEAD', 'GET'];
const ALL_METHODS: Method[] = ['HEAD', 'GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];
const SSL_PROTOCOLS: SslProtocol[] = ['TLSv1.2'];

function s3Origin(bucket: string): Origin {
  return {
    Id: 's3-assets',
    DomainName: `${bucket}.s3.amazonaws.com`,
    S3OriginConfig: { OriginAccessIdentity: '' },
  };
}

function lambdaOrigin(functionUrl: string): Origin {
  return {
    Id: 'lambda-ssr',
    DomainName: new URL(functionUrl).hostname,
    CustomOriginConfig: {
      OriginProtocolPolicy: 'https-only',
      HTTPSPort: 443,
      HTTPPort: 80,
      OriginSslProtocols: { Quantity: SSL_PROTOCOLS.length, Items: SSL_PROTOCOLS },
    },
  };
}

function origins(bucket: string, lambdaFunctionUrl: string): Origin[] {
  return [s3Origin(bucket), lambdaOrigin(lambdaFunctionUrl)];
}

function defaultBehavior(): DefaultCacheBehavior {
  return {
    TargetOriginId: 'lambda-ssr',
    ViewerProtocolPolicy: 'redirect-to-https',
    CachePolicyId: '4135ea2d-6df8-44a3-9df3-4cb5479ff26d', // Managed-CachingOptimized
    AllowedMethods: {
      Quantity: ALL_METHODS.length,
      Items: ALL_METHODS,
    },
    Compress: true,
  };
}

function staticBehavior(): CacheBehaviors {
  return {
    Quantity: 1,
    Items: [
      {
        PathPattern: 'static/*',
        TargetOriginId: 's3-assets',
        ViewerProtocolPolicy: 'redirect-to-https',
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e49f6', // Managed-CachingOptimizedForUncompressedObjects
        AllowedMethods: { Quantity: HEADERS_BOTH.length, Items: HEADERS_BOTH },
        Compress: true,
      },
    ],
  };
}

function baseConfig(
  bucket: string,
  lambdaFunctionUrl: string | undefined,
  alias?: string
): DistributionConfig {
  const hasSsr = Boolean(lambdaFunctionUrl);
  const behavior: DefaultCacheBehavior = hasSsr
    ? defaultBehavior()
    : {
        TargetOriginId: 's3-assets',
        ViewerProtocolPolicy: 'redirect-to-https',
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e49f6',
        AllowedMethods: { Quantity: HEADERS_BOTH.length, Items: HEADERS_BOTH },
        Compress: true,
      };

  return {
    CallerReference: new Date().toISOString(),
    Origins: hasSsr
      ? { Quantity: 2, Items: origins(bucket, lambdaFunctionUrl!) }
      : { Quantity: 1, Items: [s3Origin(bucket)] },
    DefaultCacheBehavior: behavior,
    CacheBehaviors: staticBehavior(),
    Enabled: true,
    HttpVersion: 'http2and3',
    Aliases: alias ? { Quantity: 1, Items: [alias] } : { Quantity: 0, Items: [] },
    Comment: '', // overwritten by callers
    DefaultRootObject: 'index.html',
  };
}

export async function ensureDistribution(
  creds: AwsCredentials,
  opts: {
    projectId: string;
    bucket: string;
    /** Omit for static-only deployments (no SSR function yet). */
    lambdaFunctionUrl?: string;
    alias?: string;
  }
) {
  const cf = cloudFrontClient(creds);
  const existing = await getDistributionByProject(creds, opts.projectId);

  if (existing) {
    // Keep the existing aliases; only the Lambda URL can change on redeploy.
    const fresh = baseConfig(opts.bucket, opts.lambdaFunctionUrl);
    const updated = await cf.send(
      new UpdateDistributionCommand({
        Id: existing.id,
        IfMatch: existing.etag,
        DistributionConfig: {
          ...existing.distribution,
          Comment: cfComment(opts.projectId),
          Origins: fresh.Origins,
          DefaultCacheBehavior: fresh.DefaultCacheBehavior,
          CacheBehaviors: fresh.CacheBehaviors,
        },
      })
    );
    return {
      refreshed: true as const,
      id: existing.id,
      domain: existing.domain,
      etag: updated.ETag!,
    };
  }

  const config = baseConfig(opts.bucket, opts.lambdaFunctionUrl, opts.alias);
  config.Comment = cfComment(opts.projectId);

  const res = await cf.send(
    new CreateDistributionWithTagsCommand({
      DistributionConfigWithTags: {
        DistributionConfig: config,
        Tags: {
          Items: Object.entries(OPENHOST_STACK_TAGS).map(([Key, Value]) => ({ Key, Value })),
        },
      },
    })
  );

  return {
    refreshed: false as const,
    id: res.Distribution!.Id!,
    domain: res.Distribution!.DomainName!,
    etag: res.ETag!,
  };
}

/** Invalidate HTML paths after a build so visitors get the new page. */
export async function invalidatePaths(
  creds: AwsCredentials,
  distributionId: string,
  paths: string[] = ['/*']
) {
  const cf = cloudFrontClient(creds);
  const res = await cf.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    })
  );

  return {
    invalidationId: res.Invalidation!.Id!,
    status: res.Invalidation!.Status!,
  };
}

export async function waitForInvalidation(
  creds: AwsCredentials,
  distributionId: string,
  invalidationId: string
) {
  const cf = cloudFrontClient(creds);
  for (;;) {
    const res = await cf.send(
      new GetInvalidationCommand({ DistributionId: distributionId, Id: invalidationId })
    );
    if (res.Invalidation!.Status === 'Completed') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
