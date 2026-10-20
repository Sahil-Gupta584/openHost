import { ListLayerVersionsCommand, GetLayerVersionCommand } from '@aws-sdk/client-lambda';
import type { AwsCredentials } from './config';
import { lambdaClient } from './client';

/**
 * The aws-lambda-web-adapter project publishes a prebuilt public Lambda
 * layer. We resolve the latest version at deploy time so every deployment
 * uses the current adapter without pinning an ARN forever.
 */

const PUBLISHER_ACCOUNT = '753240598075'; // aws-lambda-web-adapter official layers

export type AdapterArch = 'x86_64' | 'arm64';

/** Layer ARNs are region/arch specific but effectively immutable per version —
 *  cache a resolved ARN for the process lifetime to skip probing every deploy. */
const resolved = new Map<string, string>();

export async function lambdaWebAdapterLayer(
  creds: AwsCredentials,
  arch: AdapterArch = 'x86_64'
): Promise<string> {
  const cacheKey = `${creds.region}:${arch}`;
  const cached = resolved.get(cacheKey);
  if (cached) return cached;

  const layerName = arch === 'x86_64' ? 'LambdaAdapterLayerX86' : 'LambdaAdapterLayerArm64';
  const layerRef = `arn:aws:lambda:${creds.region}:${PUBLISHER_ACCOUNT}:layer:${layerName}`;

  // Fresh discovery first — some accounts can't use ListLayerVersions on the
  // publisher's layer (no resource policy surfaces it) → probe pinned
  // versions via GetLayerVersion instead (public layers always allow it).
  try {
    const res = await lambdaClient(creds).send(
      new ListLayerVersionsCommand({ LayerName: layerRef, MaxItems: 1 })
    );
    const latest = res.LayerVersions?.[0]?.LayerVersionArn;
    if (latest) {
      resolved.set(cacheKey, latest);
      return latest;
    }
  } catch {
    /* fall through to the probing path */
  }

  for (let v = 90; v >= 1; v--) {
    try {
      await lambdaClient(creds).send(
        new GetLayerVersionCommand({ LayerName: layerRef, VersionNumber: v })
      );
      const arn = `${layerRef}:${v}`;
      resolved.set(cacheKey, arn);
      return arn;
    } catch {
      /* try the next older version */
    }
  }
  throw new Error(`Lambda Web Adapter layer not found for region ${creds.region} (${arch})`);
}
