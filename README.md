# OpenHost

A minimalistic Vercel clone that deploys Next.js apps to the user's own AWS account.
Git push → build → S3 + Lambda + CloudFront. You pay pure AWS costs, no markup.

Stack: Next.js (App Router) · Tailwind · Radix/shadcn UI · Supabase · AWS SDK v3.

## Deployment flow (live, like Vercel)

```
push / "Deploy" button
  → POST /api/projects/:id/deploy          (or /api/webhooks/github from a push)
  → runner: clone (token-auth for private) → install → next build
      Next.js apps: force output:"standalone" → package standalone server
      (+ run.sh launcher) → upload versions/<commit>.zip → deploy Lambda
      (Lambda Web Adapter layer, exec-wrapper boot) → publish version +
      flip "live" alias → CloudFront default → Lambda Function URL
      plain sites: next export → out/** → S3 → CloudFront (S3 origin)
  → SSE stream of every build line at /dashboard/:id/deployments/:depId
  → status building → ready | error (recorded in Supabase)
```

SSR bucket: real Next.js server components, API routes, `getServerSideProps`
run in Lambda (nodejs20.x + aws-lambda-web-adapter). Rollbacks are atomic —
republishing an old version and repointing the `live` alias.

**Build executor**: by default builds run in an ephemeral **AWS CodeBuild**
container in your own account (nothing idles, ~1–3¢ per build, per-project
builder created/updated, logs relayed into the SSE stream). Set
`OPENHOST_BUILD_MODE=local` to build on the host instead (dev fallback).

## Architecture

```
app/
  api/
    projects/route.ts                       GET list, POST create
    projects/[projectId]/…                  PATCH/DELETE, deployments, domains, env-vars
  dashboard/                                pages (thin wrappers over components)
components/
  dashboard/                                UI only — data comes from hooks
  landing/  ui/
lib/
  aws/                                      pure AWS wrapper (no orchestration)
    config.ts      credential resolution (platform now, BYOC roles later)
    client.ts      SDK client factories (S3, Lambda, CF, R53, ACM, IAM, STS)
    s3.ts          per-project bucket: create, versioning, upload, purge
    iam.ts         shared Lambda execution role (openhost-lambda-site-role)
    lambda.ts      per-project SSR function + "live" alias (atomic rollbacks)
    cloudfront.ts  per-project distribution, invalidations
    domains.ts     ACM certs + Route 53 alias records
    index.ts       barrel — import everything from '@/lib/aws'
  services/
    deploy.ts      deployProject()/destroyProject(): aws + queries glue
  supabase/
    db.ts          server client + row types
    queries/       repository layer (projects, deployments, domains, env-vars)
  api/http.ts     {data}/{error} envelope, ApiError, route wrapper
  validation/schemas.ts  zod request schemas
  utils.ts
hooks/
  use-projects.ts   list + create/delete, reads /api/projects
  use-project.ts    detail + mutations, reads /api/projects/:id/*
db/
  schema.sql       projects, deployments, domains, env_vars, aws_connections
```

Layering rule: `route handler → (zod) → service/repository → (aws | supabase)`.
UI components never call AWS or Supabase directly.

Resource naming: `openhost-<projectId>-assets`, `openhost-<projectId>-site`.

## Roadmap

- [x] M0 — Landing page + dashboard UI (mock data)
- [x] M1 — AWS wrapper core (`lib/aws/`) + Supabase data layer + schema
- [x] M2 — Supabase wired into UI: API routes, repositories, hooks, real
      projects list and project detail (no more mock data)
- [x] M5c — Builds off the host machine (AWS CodeBuild, user's account):
      every deploy runs in an ephemeral build container (Node 20 + repo deps);
      OpenHost-generated inline buildspec mirrors the local pipeline
      (standalone wrap → install → build → package → upload);
      per-project builder `openhost-<id>-builder` is create-or-update (no idle
      cost); CloudWatch log tail relayed into the same SSE deploy stream;
      `OPENHOST_BUILD_MODE=local` falls back to in-process builds;
      artifact contract unchanged → S3 / versions / Lambda / CloudFront
- [x] M3 — Build pipeline + live deploy stream (Vercel-style) + SSR hosting:
      POST /deploy → runner clones repo → install → `next build`
      (`output: standalone`) → Lambda zip + Web Adapter layer → CloudFront;
      per-line logs streamed over SSE at
      `/dashboard/:id/deployments/:deploymentId`; static export remains the
      fallback for non-Next sites; status building→ready/error in Supabase
- [ ] M4 — GitHub integration: OAuth app + webhook (`push` → deploy), private
      repos, per-user AWS connections (BYOC role assumption behind
      `aws_connections` table)
- [ ] M5 — Custom domains end-to-end (cert request → validation → Route 53 →
      distribution alias), env vars UI passthrough to Lambda
- [ ] M6 — Rollbacks (alias switch), build log streaming (SSE), usage metering

## Setup

```bash
cp .env.local.example .env.local   # fill in Supabase + AWS creds
npm install
psql < db/schema.sql               # or paste into Supabase SQL editor
npm run dev
```
