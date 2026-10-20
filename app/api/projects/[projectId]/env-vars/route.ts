import { handle, notFound, param } from '@/lib/api/http';
import { addEnvVarSchema, parseBody } from '@/lib/validation/schemas';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import * as envVarsRepo from '@/lib/supabase/queries/env-vars';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string } };

/** GET /api/projects/:projectId/env-vars */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');
    return envVarsRepo.listEnvVars(id);
  });
}

/** POST /api/projects/:projectId/env-vars — upsert { key, value, isSecret }. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');

    const input = await parseBody(req, addEnvVarSchema);
    return envVarsRepo.upsertEnvVar({
      projectId: id,
      key: input.key,
      value: input.value,
      isSecret: input.isSecret,
    });
  });
}
