import { getDb, type DeploymentRow } from '../db';

/**
 * Deployments repository — writes come from the deploy service, reads
 * from the project detail page and API consumers.
 */

export async function listDeployments(projectId: string): Promise<DeploymentRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('deployments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`listDeployments: ${error.message}`);
  return (data ?? []) as unknown as DeploymentRow[];
}

export async function getDeployment(id: string): Promise<DeploymentRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('deployments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getDeployment: ${error.message}`);
  return (data as unknown as DeploymentRow) ?? null;
}

export async function getLatestDeployment(projectId: string): Promise<DeploymentRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('deployments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestDeployment: ${error.message}`);
  return (data as unknown as DeploymentRow) ?? null;
}

export interface CreateDeploymentInput {
  projectId: string;
  commitHash: string;
  branch: string;
  commitMessage?: string;
  author?: string;
  status?: DeploymentRow['status'];
  durationMs?: number;
  lambdaVersion?: string;
  buildLogs?: string;
}

export async function createDeployment(input: CreateDeploymentInput): Promise<DeploymentRow> {
  const db = getDb();
  const { data, error } = await db
    .from('deployments')
    .insert({
      project_id: input.projectId,
      commit_hash: input.commitHash,
      branch: input.branch,
      commit_message: input.commitMessage ?? null,
      author: input.author ?? null,
      status: input.status ?? 'building',
      duration_ms: input.durationMs ?? null,
      lambda_version: input.lambdaVersion ?? null,
      build_logs: input.buildLogs ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`createDeployment: ${error.message}`);
  return data as unknown as DeploymentRow;
}

export async function updateDeployment(
  id: string,
  patch: Partial<
    Pick<
      DeploymentRow,
      | 'status'
      | 'duration_ms'
      | 'lambda_version'
      | 'build_logs'
      | 'commit_hash'
      | 'commit_message'
      | 'author'
      | 'production_url'
    >
  >
): Promise<void> {
  const db = getDb();
  const { error } = await db.from('deployments').update(patch).eq('id', id);
  if (error) throw new Error(`updateDeployment: ${error.message}`);
}

/** The newest deployment that produced a live origin URL (for the /~/ proxy). */
export async function getLatestReadyOrigin(projectId: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('deployments')
    .select('production_url')
    .eq('project_id', projectId)
    .not('production_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestReadyOrigin: ${error.message}`);
  return (data as unknown as { production_url: string | null } | null)?.production_url ?? null;
}
