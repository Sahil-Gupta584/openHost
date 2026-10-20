import {
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand,
  PutBucketTaggingCommand,
  PutBucketCorsCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { AwsCredentials } from './config';
import { OPENHOST_STACK_TAGS } from './config';
import { s3Client } from './client';
import type { BucketLocationConstraint } from '@aws-sdk/client-s3';

/**
 * One bucket per project, holding static assets + Lambda deployment zips:
 *   s3://openhost-<projectId>-assets/
 *     static/…              ← public build output (served via CloudFront)
 *     versions/<hash>.zip   ← SSR bundle for Lambda
 */

export function assetsBucketName(projectId: string) {
  return `openhost-${projectId}-assets`.toLowerCase();
}

export async function bucketExists(creds: AwsCredentials, bucket: string) {
  try {
    await s3Client(creds).send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

export async function ensureBucket(creds: AwsCredentials, bucket: string) {
  const s3 = s3Client(creds);
  if (await bucketExists(creds, bucket)) return { bucket, created: false };

  // us-east-1 must create buckets without a LocationConstraint.
  const createInput =
    creds.region === 'us-east-1'
      ? { Bucket: bucket }
      : {
          Bucket: bucket,
          CreateBucketConfiguration: {
            LocationConstraint: creds.region as BucketLocationConstraint,
          },
        };

  await s3.send(new CreateBucketCommand(createInput));

  // Private bucket — CloudFront accesses via Origin Access Control later.
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
  );

  await s3.send(
    new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: { Status: 'Enabled' }, // enables instant rollback
    })
  );

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['HEAD', 'GET'],
            AllowedOrigins: ['*'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  );

  await s3.send(
    new PutBucketTaggingCommand({
      Bucket: bucket,
      Tagging: {
        TagSet: Object.entries(OPENHOST_STACK_TAGS).map(([Key, Value]) => ({ Key, Value })),
      },
    })
  );

  return { bucket, created: true };
}

const TEXT_EXT = /\.(?:html|js|mjs|css|json|txt|svg|xml|map|csv)$/i;
const TEXT_MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  csv: 'text/csv; charset=utf-8',
};

const COMMON_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
};

const HTML_EXT = /\.html?$/i;

/** Cache policy per artifact: HTML is revalidated, everything else immutable. */
function cacheControlFor(key: string) {
  if (HTML_EXT.test(key)) return 'public, max-age=0, must-revalidate';
  return 'public, max-age=31536000, immutable';
}

function contentTypeFor(key: string) {
  const ext = key.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';
  if (TEXT_MIME[ext]) return TEXT_MIME[ext];
  if (COMMON_MIME[ext]) return COMMON_MIME[ext];
  return TEXT_EXT.test(key) ? 'text/plain; charset=utf-8' : 'application/octet-stream';
}

export interface UploadAssetsResult {
  uploaded: number;
  prefix: string;
}

/**
 * Upload a tree of build output files to the bucket as immutable assets.
 * `files` maps relative path → Buffer (populated by the build pipeline later).
 */
export async function deployStaticAssets(
  creds: AwsCredentials,
  bucket: string,
  files: Record<string, Buffer>,
  prefix = 'static'
): Promise<UploadAssetsResult> {
  const s3 = s3Client(creds);
  let uploaded = 0;

  for (const [relPath, body] of Object.entries(files)) {
    const key = `${prefix}/${relPath.replace(/\\/g, '/')}`;
    await new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(key),
        CacheControl: cacheControlFor(key),
      },
    }).done();
    uploaded++;
  }

  return { uploaded, prefix };
}

/** Remove every object under a prefix (used on delete + redeploy of HTML). */
export async function purgePrefix(creds: AwsCredentials, bucket: string, prefix: string) {
  const s3 = s3Client(creds);
  let token: string | undefined;
  let deleted = 0;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
    );
    const objs = (res.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objs.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objs } }));
      deleted += objs.length;
    }
    token = res.NextContinuationToken;
  } while (token);

  return { deleted };
}

export async function uploadVersion(
  creds: AwsCredentials,
  bucket: string,
  key: string,
  body: Buffer
): Promise<{ key: string; sizeBytes: number }> {
  await new Upload({
    client: s3Client(creds),
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/zip',
      CacheControl: 'public, max-age=31536000, immutable',
    },
  }).done();
  return { key, sizeBytes: body.length };
}

export async function deleteBucket(creds: AwsCredentials, bucket: string) {
  await purgePrefix(creds, bucket, '');
  await s3Client(creds).send(new DeleteBucketCommand({ Bucket: bucket }));
}
