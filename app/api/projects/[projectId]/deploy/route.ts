import { badRequest, handle, notFound, param } from '@/lib/api/http';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import { startDeployment } from '@/lib/services/deploy-runner';
import { getLatestDeployment } from '@/lib/supabase/queries/deployments';

export const dynamic = 'force-dynamic';
// The orchestrator waits for the builder to finish (up to ~14 min for the
// ephemeral build sandbox). 300s = Hobby plan max; long builds still complete
// inside the builder itself — only the finalize step would need a re-run.
export const maxDuration = 300;

type Ctx = { params: { projectId: string } };

/** POST /api/projects/:projectId/deploy — starts a build + deploy run. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');
    if (!project.repo) throw badRequest('Project has no repository configured yet');

    const latest = await getLatestDeployment(id);
    if (latest?.status === 'building') {
      throw badRequest('A deployment is already running — watch its progress page instead');
    }

    const deploymentId = await startDeployment({ projectId: id });
    return { deploymentId };
  });
}
