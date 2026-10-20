import { handle, notFound, param } from '@/lib/api/http';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import * as envVarsRepo from '@/lib/supabase/queries/env-vars';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string; key: string } };

/** DELETE /api/projects/:projectId/env-vars/:key */
export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const projectId = param(params, 'projectId', 'Project');
    const key = param(params, 'key', 'Variable');
    const project = await projectsRepo.getProjectById(projectId);
    if (!project) throw notFound('Project');

    await envVarsRepo.deleteEnvVar(projectId, decodeURIComponent(key));
    return { deleted: true };
  });
}
