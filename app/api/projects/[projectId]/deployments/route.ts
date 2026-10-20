import { handle, notFound, param } from '@/lib/api/http';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import * as deploymentsRepo from '@/lib/supabase/queries/deployments';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string } };

/** GET /api/projects/:projectId/deployments — newest first. */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');
    return {
      deployments: await deploymentsRepo.listDeployments(id),
      latest: await deploymentsRepo.getLatestDeployment(id),
    };
  });
}
