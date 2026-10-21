import { badRequest, handle } from '@/lib/api/http';
import { listUserRepos, resolveGithubToken, tokenIdentity } from '@/lib/services/github';

export const dynamic = 'force-dynamic';

/** GET /api/settings/github/repos — connected user's repos, newest push first. */
export async function GET() {
  return handle(async () => {
    const token = await resolveGithubToken();
    if (!token) {
      throw badRequest('Connect your GitHub account first.');
    }
    const repos = await listUserRepos(token);
    if (repos.length === 0 && !(await tokenIdentity(token))) {
      // Empty list could mean a genuine zero or a dead token — disambiguate.
      throw badRequest('GitHub rejected this token — reconnect the account.');
    }
    return { repos };
  });
}
