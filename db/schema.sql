-- OpenHost schema
-- Run this in the Supabase SQL editor to set up the data layer.

create extension if not exists "pgcrypto";

-- ============ projects ============
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null unique,
  repo text not null,
  branch text not null default 'main',
  region text not null default 'us-east-1',
  framework text not null default 'nextjs',
  created_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ============ deployments ============
create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  commit_hash text not null,
  branch text not null,
  commit_message text,
  author text,
  status text not null default 'building'
    check (status in ('queued', 'building', 'ready', 'error')),
  duration_ms integer,
  lambda_version text,
  build_logs text,
  created_at timestamptz not null default now()
);

create index if not exists deployments_project_created
  on deployments(project_id, created_at desc);

-- production URL of the current live deployment (Lambda/API-Gateway origin
-- for the /~/<projectId> proxy through the OpenHost domain)
alter table deployments add column if not exists production_url text;

-- widen the lifecycle constraint in-place (queued added for CodeBuild queueing)
alter table deployments drop constraint if exists deployments_status_check;
alter table deployments add constraint deployments_status_check
  check (status in ('queued', 'building', 'ready', 'error'));

-- ============ domains ============
create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  domain text not null unique,
  type text not null check (type in ('openhost-subdomain', 'custom')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error')),
  certificate_arn text,
  cf_distribution_id text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists domains_project on domains(project_id);

-- ============ env vars ============
create table if not exists env_vars (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  value text not null,
  is_secret boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

-- ============ git hooks / tokens (M4) ============
create table if not exists git_tokens (
  key text primary key check (key = 'github'),
  value text not null,
  updated_at timestamptz not null default now()
);

-- ============ aws connections (BYOC, milestone 5+) ============
create table if not exists aws_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_arn text not null,
  external_id text not null,
  region text not null default 'us-east-1',
  connected_at timestamptz not null default now()
);

create index if not exists aws_connections_user on aws_connections(user_id);

-- ============ row level security ============
alter table projects enable row level security;
alter table deployments enable row level security;
alter table domains enable row level security;
alter table env_vars enable row level security;
alter table aws_connections enable row level security;

-- RLS policies are relaxed for now (single-user platform mode);
-- tightened when auth is wired: user_id = auth.uid() checks per table.
drop policy if exists "allow select projects" on projects;
create policy "allow select projects" on projects for select using (true);
drop policy if exists "allow insert projects" on projects;
create policy "allow insert projects" on projects for insert with check (true);
drop policy if exists "allow update projects" on projects;
create policy "allow update projects" on projects for update using (true);
drop policy if exists "allow delete projects" on projects;
create policy "allow delete projects" on projects for delete using (true);

drop policy if exists "allow all deployments" on deployments;
create policy "allow all deployments" on deployments for all using (true) with check (true);
drop policy if exists "allow all domains" on domains;
create policy "allow all domains" on domains for all using (true) with check (true);
drop policy if exists "allow all env_vars" on env_vars;
create policy "allow all env_vars" on env_vars for all using (true) with check (true);
drop policy if exists "allow all aws_connections" on aws_connections;
create policy "allow all aws_connections" on aws_connections for all using (true) with check (true);
drop policy if exists "allow all git_tokens" on git_tokens;
create policy "allow all git_tokens" on git_tokens for all using (true) with check (true);

-- note: git_tokens.value stays plaintext for now (single-user platform mode);
-- swap to pgsodium / supabase vault encryption when auth + RLS tighten up.
