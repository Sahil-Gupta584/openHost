import { ApiError, badRequest, handle } from '@/lib/api/http';
import { z } from 'zod';
import {
  deleteGithubToken,
  maskToken,
  saveGithubToken,
  storedGithubToken,
  testToken,
  tokenIdentity,
} from '@/lib/services/github';

export const dynamic = 'force-dynamic';

/** GET /api/settings/github — connected account + masked status (never the raw token). */
export async function GET() {
  return handle(async () => {
    const stored = await storedGithubToken();
    const active = stored ?? process.env.GITHUB_TOKEN ?? null;

    if (!active) {
      return {
        connected: false,
        source: 'none' as const,
        masked: null,
        login: null,
        name: null,
        avatarUrl: null,
      };
    }

    const identity = await tokenIdentity(active);
    return {
      connected: Boolean(identity),
      source: stored ? ('database' as const) : ('env' as const),
      masked: maskToken(active),
      login: identity?.login ?? null,
      name: identity?.name ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
    };
  });
}

const saveSchema = z.object({
  token: z.string().min(20).max(255),
});

/** PUT /api/settings/github — validate against api.github.com, then store. */
export async function PUT(req: Request) {
  return handle(async () => {
    let parsed: { token: string };
    try {
      parsed = saveSchema.parse(await req.json());
    } catch {
      throw badRequest('Token must be between 20 and 255 characters');
    }

    const who = await testToken(parsed.token);
    if (!who) {
      throw new ApiError('GitHub rejected this token (expired or missing scopes)', 400);
    }

    await saveGithubToken(parsed.token.trim());

    return { connected: true, login: who.login, masked: maskToken(parsed.token.trim()) };
  });
}

/** DELETE /api/settings/github — remove the stored token. */
export async function DELETE() {
  return handle(async () => {
    await deleteGithubToken();
    const envToken = process.env.GITHUB_TOKEN;
    return {
      connected: Boolean(envToken),
      source: envToken ? 'env' : 'none',
      masked: envToken ? maskToken(envToken) : null,
    };
  });
}
