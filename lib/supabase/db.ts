import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (service role). Used inside API routes only —
 * never shipped to the browser. Falls back to the anon key with RLS active
 * if the service key isn't available (e.g. preview environments).
 */

export type Db = SupabaseClient;

let cachedDb: Db | null = null;

export function getDb(): Db {
  if (cachedDb) return cachedDb;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    );
  }

  cachedDb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedDb;
}

/** Row types that mirror db/schema.sql. */
export const TABLES = {
  projects: 'projects',
  deployments: 'deployments',
  domains: 'domains',
  envVars: 'env_vars',
} as const;

export interface ProjectRow {
  id: string;
  user_id: string | null;
  name: string;
  repo: string;
  branch: string;
  region: string;
  framework: string;
  created_at: string;
  archived: boolean;
}

export interface DeploymentRow {
  id: string;
  project_id: string;
  commit_hash: string;
  branch: string;
  commit_message: string;
  author: string | null;
  status: 'queued' | 'building' | 'ready' | 'error';
  duration_ms: number | null;
  lambda_version: string | null;
  build_logs: string | null;
  production_url: string | null;
  created_at: string;
}

export interface DomainRow {
  id: string;
  project_id: string;
  domain: string;
  type: 'openhost-subdomain' | 'custom';
  status: 'pending' | 'active' | 'error';
  certificate_arn: string | null;
  cf_distribution_id: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface EnvVarRow {
  id: string;
  project_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
}
