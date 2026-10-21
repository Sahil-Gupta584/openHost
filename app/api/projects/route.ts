import { handle } from '@/lib/api/http';
import { createProjectSchema, parseBody } from '@/lib/validation/schemas';
import { slugifyProjectName } from '@/lib/utils/repo';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import { attachRepoWebhook, resolveGithubToken } from '@/lib/services/github';

export const dynamic = 'force-dynamic';

/** GET /api/projects — list all projects with derived status. */
export async function GET() {
  return handle(async () => projectsRepo.listProjectsWithStatus());
}

/** POST /api/projects — register a project (draft; first deploy happens in M3). */
export async function POST(req: Request) {
  return handle(async () => {
    const input = await parseBody(req, createProjectSchema);
    const project = await projectsRepo.createProject({
      repo: input.repo,
      name: input.name ?? slugifyProjectName(input.repo.split('/')[1] ?? ''),
      branch: input.branch,
      region: input.region,
    });

    // Best-effort: attach a push webhook so future commits auto-deploy.
    // Failure is non-fatal — the project still deploys manually.
    let webhookAttached = false;
    const token = await resolveGithubToken();
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (token && secret) {
      const origin = new URL(req.url).origin;
      webhookAttached = await attachRepoWebhook({
        token,
        repo: input.repo,
        targetUrl: `${origin}/api/webhooks/github`,
        secret,
      });
    }

    return { ...project, webhookAttached };
  });
}
