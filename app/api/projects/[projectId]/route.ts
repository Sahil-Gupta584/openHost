import { handle, notFound, param } from '@/lib/api/http';
import { parseBody, updateProjectSchema } from '@/lib/validation/schemas';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import * as deployService from '@/lib/services/deploy';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string } };

/** GET /api/projects/:projectId */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');
    return project;
  });
}

/** PATCH /api/projects/:projectId — rename, change branch or region. */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const patch = await parseBody(req, updateProjectSchema);
    const updated = await projectsRepo.updateProject(id, patch);
    if (!updated) throw notFound('Project');
    return updated;
  });
}

/** DELETE /api/projects/:projectId — DB row + best-effort AWS teardown. */
export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');

    await deployService.destroyProject(id);
    await projectsRepo.deleteProject(id);
    return { deleted: true };
  });
}
