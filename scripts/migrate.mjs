import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load .env.local (never .env) — same precedence Next.js uses.
dotenv.config({ path: '.env.local' });

const SCHEMA_PATH = join(process.cwd(), 'db', 'schema.sql');

function sslOption() {
  return { rejectUnauthorized: false };
}

function parseProjectRef(url) {
  const match = String(url ?? '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Supabase accepts several connection hosts. Newer projects only expose the
 * pooler URLs — the legacy db.<ref>.supabase.co host may not resolve. We try
 * credentials-bearing candidates in order and report which one worked.
 */
export function connectionCandidates(env = process.env) {
  // Explicit connection string wins if provided.
  if (env.SUPABASE_DB_URL) {
    return [
      {
        label: 'SUPABASE_DB_URL',
        connectionString: env.SUPABASE_DB_URL,
        ssl: sslOption(),
      },
    ];
  }

  const ref = parseProjectRef(env.SUPABASE_URL);
  const password = env.SUPABASE_DB_PASSWORD ?? '';
  const region = (env.SUPABASE_REGION ?? '').trim();

  if (!ref || !password) {
    console.error(
      '[migrate] Missing SUPABASE_URL and/or SUPABASE_DB_PASSWORD in .env.local'
    );
    process.exit(1);
  }

  const candidates = [];

  if (region) {
    // Supavisor pooler — username must be postgres.<ref>.
    candidates.push({
      label: `pooler (${region})`,
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${ref}`,
      password,
      ssl: sslOption(),
    });
  }

  // Legacy direct host (works only on older projects).
  candidates.push({
    label: 'direct',
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: sslOption(),
  });

  return candidates;
}

async function applySchema() {
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  const candidates = connectionCandidates();

  for (const config of candidates) {
    const client = new pg.Client(config);
    try {
      await client.connect();
      await client.query(sql);

      const { rows } = await client.query(
        `select table_name
           from information_schema.tables
          where table_schema = 'public'
            and table_type = 'base table'
          order by table_name`
      );

      console.log(
        `[migrate] OK — applied db/schema.sql via ${config.label}. Public tables: ${rows
          .map((r) => r.table_name)
          .join(', ')}`
      );
      await client.end();
      return;
    } catch (err) {
      await client.end().catch(() => {});
      const dnsFailure = /ENOTFOUND|ETIMEDOUT|ECONNREFUSED/.test(err.message);
      if (!dnsFailure) {
        // Real DDL/auth failure — surface only the driver message, never the
        // connection string or password.
        console.error('[migrate] FAILED —', err.message);
        process.exit(1);
      }
      // Unreachable host → try the next candidate.
      continue;
    }
  }

  console.error(
    '[migrate] FAILED — no Supabase connection host was reachable (direct + pooler). ' +
      'Check the project ref in SUPABASE_URL and the region in SUPABASE_REGION.'
  );
  process.exit(1);
}

applySchema().catch((err) => {
  console.error('[migrate] FAILED —', err.message);
  process.exit(1);
});
