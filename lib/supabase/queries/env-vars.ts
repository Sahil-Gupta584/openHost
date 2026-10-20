import { getDb, type EnvVarRow } from '../db';

/** Environment variables repository. Values are returned raw to the server only. */

export async function listEnvVars(projectId: string): Promise<EnvVarRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('env_vars')
    .select('*')
    .eq('project_id', projectId)
    .order('key');
  if (error) throw new Error(`listEnvVars: ${error.message}`);
  return (data ?? []) as unknown as EnvVarRow[];
}

export async function upsertEnvVar(input: {
  projectId: string;
  key: string;
  value: string;
  isSecret: boolean;
}): Promise<EnvVarRow> {
  const db = getDb();
  const { data, error } = await db
    .from('env_vars')
    .upsert(
      {
        project_id: input.projectId,
        key: input.key,
        value: input.value,
        is_secret: input.isSecret,
      },
      { onConflict: 'project_id,key' }
    )
    .select('*')
    .single();
  if (error) throw new Error(`upsertEnvVar: ${error.message}`);
  return data as unknown as EnvVarRow;
}

export async function deleteEnvVar(projectId: string, key: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('env_vars')
    .delete()
    .eq('project_id', projectId)
    .eq('key', key);
  if (error) throw new Error(`deleteEnvVar: ${error.message}`);
}

/** Flat map for injection into new Lambda deployments. */
export async function envVarsForProject(projectId: string): Promise<Record<string, string>> {
  const rows = await listEnvVars(projectId);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
