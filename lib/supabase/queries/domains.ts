import { getDb, type DomainRow } from '../db';

/** Domains repository. */

export async function listDomains(projectId: string): Promise<DomainRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('domains')
    .select('*')
    .eq('project_id', projectId)
    .order('is_primary', { ascending: false });
  if (error) throw new Error(`listDomains: ${error.message}`);
  return (data ?? []) as unknown as DomainRow[];
}

export async function getDomain(projectId: string, domain: string): Promise<DomainRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('domains')
    .select('*')
    .eq('project_id', projectId)
    .eq('domain', domain)
    .maybeSingle();
  if (error) throw new Error(`getDomain: ${error.message}`);
  return (data as unknown as DomainRow) ?? null;
}

export async function addDomain(input: {
  projectId: string;
  domain: string;
  type?: DomainRow['type'];
  status?: DomainRow['status'];
  certificateArn?: string | null;
}): Promise<DomainRow> {
  const db = getDb();
  const { data, error } = await db
    .from('domains')
    .insert({
      project_id: input.projectId,
      domain: input.domain,
      type: input.type ?? 'custom',
      status: input.status ?? 'pending',
      certificate_arn: input.certificateArn ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`addDomain: ${error.message}`);
  return data as unknown as DomainRow;
}

export async function updateDomain(
  id: string,
  patch: Partial<Pick<DomainRow, 'status' | 'certificate_arn' | 'cf_distribution_id' | 'is_primary'>>
): Promise<void> {
  const db = getDb();
  const { error } = await db.from('domains').update(patch).eq('id', id);
  if (error) throw new Error(`updateDomain: ${error.message}`);
}

export async function deleteDomain(projectId: string, domain: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('domains')
    .delete()
    .eq('project_id', projectId)
    .eq('domain', domain);
  if (error) throw new Error(`deleteDomain: ${error.message}`);
}
