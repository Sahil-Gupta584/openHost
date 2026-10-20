import * as crypto from 'crypto';
import * as settingsRepo from '../supabase/queries/settings';

/**
 * GitHub integration helpers:
 *  - token resolution (DB row, falling back to env — either grants private repo clone)
 *  - webhook signature verification + push payload parsing
 */

export const GITHUB_KEY = 'github';

/** Decode the stored/acting token for this host. Priority: env > DB. */
export async function resolveGithubToken(): Promise<string | null> {
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;
  try {
    return await settingsRepo.getSetting(GITHUB_KEY);
  } catch {
    return null;
  }
}

/** Never render or log the full token — last four chars only. */
export function maskToken(token: string): string {
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 3)}••••••••${token.slice(-4)}`;
}

export async function saveGithubToken(token: string) {
  await settingsRepo.upsertSetting(GITHUB_KEY, token.trim());
}

export async function deleteGithubToken() {
  await settingsRepo.deleteSetting(GITHUB_KEY);
}

export async function storedGithubToken(): Promise<string | null> {
  return settingsRepo.getSetting(GITHUB_KEY);
}

/** Validates a token by asking GitHub who it belongs to. */
export async function testToken(token: string): Promise<{ login: string } | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'openhost',
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as { login: string };
}

// ---- webhooks -----------------------------------------------------------------

/** Constant-time HMAC check of GitHub's x-hub-signature-256 header. */
export function verifyWebhookSignature(rawBody: string, signature256: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false; // not configured → reject
  if (!signature256?.startsWith('sha256=')) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature256);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface PushPayload {
  repo: string; // owner/name
  branch: string;
  commitHash: string;
  commitMessage: string | null;
  author: string | null;
}

/** Extracts deploy inputs from a push webhook body. */
export function parsePushPayload(body: unknown): PushPayload | null {
  const b = body as {
    ref?: string;
    after?: string;
    head_commit?: { id?: string; message?: string; author?: { name?: string } };
    repository?: { full_name?: string };
  };

  if (typeof b.repository?.full_name !== 'string') return null;
  const ref = b.ref ?? '';
  const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : null;
  if (!branch) return null; // tags / other events don't deploy

  return {
    repo: b.repository.full_name,
    branch,
    commitHash: b.head_commit?.id ?? b.after ?? 'unknown',
    commitMessage: b.head_commit?.message ?? null,
    author: b.head_commit?.author?.name ?? null,
  };
}
