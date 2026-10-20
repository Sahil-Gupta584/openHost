import { badRequest, handle, notFound, param } from '@/lib/api/http';
import { addDomainSchema, parseBody } from '@/lib/validation/schemas';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import * as domainsRepo from '@/lib/supabase/queries/domains';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string } };

/** GET /api/projects/:projectId/domains */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');
    return {
      // No fabricated vanity domain — the production URL is /~/<projectId>.
      defaultDomain: null,
      domains: await domainsRepo.listDomains(id),
    };
  });
}

/** POST /api/projects/:projectId/domains — attach a custom domain (M5 wires AWS). */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const project = await projectsRepo.getProjectById(id);
    if (!project) throw notFound('Project');

    const { domain } = await parseBody(req, addDomainSchema);
    const existing = await domainsRepo.getDomain(id, domain);
    if (existing) throw badRequest('Domain already attached to this project');

    return domainsRepo.addDomain({ projectId: id, domain });
  });
}

/** DELETE /api/projects/:projectId/domains?domain=app.example.com */
export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = param(params, 'projectId', 'Project');
    const domain = new URL(req.url).searchParams.get('domain');
    if (!domain) throw badRequest('Query parameter "domain" is required');

    const existing = await domainsRepo.getDomain(id, domain);
    if (!existing) throw notFound('Domain');

    // Route 53 cleanup is best-effort; the record may live in external DNS.
    const { detachCustomDomain } = await import('@/lib/services/deploy');
    await detachCustomDomain(id, domain);
    return { removed: true };
  });
}
