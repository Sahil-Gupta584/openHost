import { getDb, type DeploymentRow, type ProjectRow } from '../db';

/**
 * Projects repository — the only place that talks to the `projects` table.
 * Services and route handlers consume these functions.
 */

export interface ProjectWithStatus extends ProjectRow {
  status: 'ready' | 'building' | 'queued' | 'error' | 'empty';
  lastDeployAt: string | null;
  lastDeployDurationMs: number | null;
  domain: string | null;
}

/** All projects with derived status from their newest deployment. */
export async function listProjectsWithStatus(): Promise<ProjectWithStatus[]> {
  const db = getDb();

  const [{ data: projects, error: projErr }, { data: deployments, error: depErr }] =
    await Promise.all([
      db.from('projects').select('*').eq('archived', false).order('created_at', { ascending: false }),
      db
        .from('deployments')
        .select('project_id, status, created_at, duration_ms')
        .order('created_at', { ascending: false }),
    ]);

  if (projErr) throw new Error(`listProjects: ${projErr.message}`);
  if (depErr) throw new Error(`listProjects(deployments): ${depErr.message}`);

  const latestByProject = new Map<string, DeploymentRow>();
  for (const d of (deployments ?? []) as unknown as Array<
    Pick<DeploymentRow, 'project_id' | 'status' | 'created_at' | 'duration_ms'>
  >) {
    if (!latestByProject.has(d.project_id)) {
      latestByProject.set(d.project_id, d as DeploymentRow);
    }
  }

  return ((projects ?? []) as unknown as ProjectRow[]).map((p) => {
    const latest = latestByProject.get(p.id);
    return {
      ...p,
      status: latest ? (latest.status as ProjectWithStatus['status']) : 'empty',
      lastDeployAt: latest?.created_at ?? null,
      lastDeployDurationMs: latest?.duration_ms ?? null,
      // No fabricated vanity domains — the live URL is /~/<projectId> on this
      // host (custom domains are a later milestone).
      domain: null,
    };
  });
}

export async function getProjectById(id: string): Promise<ProjectRow | null> {
  const db = getDb();
  const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getProjectById: ${error.message}`);
  return (data as unknown as ProjectRow) ?? null;
}

/** Match a webhook push: repo full name + production branch. */
export async function getProjectByName(repo: string, branch: string): Promise<ProjectRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('repo', repo)
    .eq('branch', branch)
    .eq('archived', false)
    .maybeSingle();
  if (error) throw new Error(`getProjectByName: ${error.message}`);
  return (data as unknown as ProjectRow) ?? null;
}

export async function createProject(input: {
  repo: string;
  name: string;
  branch: string;
  region: string;
}): Promise<ProjectRow> {
  const db = getDb();
  const { data, error } = await db
    .from('projects')
    .insert({
      repo: input.repo,
      name: input.name,
      branch: input.branch,
      region: input.region,
      framework: 'nextjs',
    })
    .select('*')
    .single();
  if (error) throw new Error(`createProject: ${error.message}`);
  return data as unknown as ProjectRow;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, 'name' | 'branch' | 'region'>>
): Promise<ProjectRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`updateProject: ${error.message}`);
  return (data as unknown as ProjectRow) ?? null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) throw new Error(`deleteProject: ${error.message}`);
  return !error;
}

export function projectDomain(name: string) {
  // Placeholder for the custom-domains milestone. Nothing should render this
  // as a working link until domains are wired — see /~/<projectId>.
  return `${name}.openhost.app`;
}
