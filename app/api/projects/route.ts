import { handle } from '@/lib/api/http';
import { createProjectSchema, parseBody } from '@/lib/validation/schemas';
import { slugifyProjectName } from '@/lib/utils/repo';
import * as projectsRepo from '@/lib/supabase/queries/projects';

export const dynamic = 'force-dynamic';

/** GET /api/projects — list all projects with derived status. */
export async function GET() {
  return handle(async () => projectsRepo.listProjectsWithStatus());
}

/** POST /api/projects — register a project (draft; first deploy happens in M3). */
export async function POST(req: Request) {
  return handle(async () => {
    const input = await parseBody(req, createProjectSchema);
    return projectsRepo.createProject({
      repo: input.repo,
      name: input.name ?? slugifyProjectName(input.repo.split('/')[1] ?? ''),
      branch: input.branch,
      region: input.region,
    });
  });
}
