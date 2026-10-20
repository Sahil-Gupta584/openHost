import { handle, notFound, param } from '@/lib/api/http';
import * as deploymentsRepo from '@/lib/supabase/queries/deployments';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string; deploymentId: string } };

/** GET /api/projects/:projectId/deployments/:deploymentId */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    param(params, 'projectId', 'Project');
    const id = param(params, 'deploymentId', 'Deployment');
    const deployment = await deploymentsRepo.getDeployment(id);
    if (!deployment) throw notFound('Deployment');
    return deployment;
  });
}
