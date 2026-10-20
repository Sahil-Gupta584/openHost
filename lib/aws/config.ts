/**
 * AWS credential resolution for OpenHost.
 *
 * Two modes are supported:
 *  1. "platform" — OpenHost's own credentials from env vars (default for now,
 *     so the app works end-to-end before per-user AWS connections exist).
 *  2. "byoc"     — Bring-your-own-account: credentials stored per user/project
 *     in Supabase (added in a later milestone). Wrapped into temporary role
 *     assumption for least-privilege access.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}

export const DEFAULT_REGION = process.env.AWS_REGION ?? 'us-east-1';

/**
 * Resolve credentials for a deployment. Later this will look up the user's
 * AWS connection from Supabase and optionally `sts.AssumeRole` into it.
 */
export async function resolveCredentials(
  opts: { region?: string; roleArn?: string } = {}
): Promise<AwsCredentials & { roleArn?: string }> {
  const region = opts.region ?? DEFAULT_REGION;

  // Placeholder for BYOC: when a connection is stored, we assume its role.
  if (opts.roleArn) {
    throw new Error('Per-user AWS connections are not wired up yet (pass-role trust still pending).');
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (platform mode).'
    );
  }

  return { accessKeyId, secretAccessKey, region, sessionToken: process.env.AWS_SESSION_TOKEN };
}

export const OPENHOST_STACK_TAGS = {
  ManagedBy: 'OpenHost',
} as const;
