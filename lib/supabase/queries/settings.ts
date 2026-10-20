import { getDb } from '../db';

/** Global key/value settings (currently just the GitHub token). */

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('git_tokens')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`getSetting: ${error.message}`);
  return (data as { value: string } | null)?.value ?? null;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('git_tokens')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`upsertSetting: ${error.message}`);
}

export async function deleteSetting(key: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('git_tokens').delete().eq('key', key);
  if (error) throw new Error(`deleteSetting: ${error.message}`);
}
