import { NextResponse } from 'next/server';
import { parsePushPayload, verifyWebhookSignature } from '@/lib/services/github';
import * as projectsRepo from '@/lib/supabase/queries/projects';
import { startDeployment } from '@/lib/services/deploy-runner';
import * as deploymentsRepo from '@/lib/supabase/queries/deployments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/github — GitHub pushes trigger production deploys.
 *
 * Repo side setup (served with hints from /dashboard/settings):
 *   Payload URL: https://<your-host>/api/webhooks/github
 *   Content type: application/json
 *   Secret: value of GITHUB_WEBHOOK_SECRET env
 *   Events: just the "push" event
 */

export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = req.headers.get('x-github-event');
  const signature = req.headers.get('x-hub-signature-256');

  if (event === 'ping') {
    return NextResponse.json({ ok: true, message: 'webhook configured' });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  if (event !== 'push') {
    return NextResponse.json({ ok: true, ignored: `event ${event}` });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const push = parsePushPayload(body);
  if (!push) {
    return NextResponse.json({ ok: true, ignored: 'no deployable push' });
  }

  // Only the project's production branch deploys; preview branches come in M5.
  const project = await projectsRepo.getProjectByName(push.repo, push.branch);
  if (!project) {
    return NextResponse.json({ ok: true, ignored: `${push.repo}@${push.branch} is not connected` });
  }

  const existing = await deploymentsRepo.getLatestDeployment(project.id);
  if (existing?.status === 'building') {
    return NextResponse.json(
      { ok: true, skipped: 'deployment already running' },
      { status: 202 }
    );
  }

  try {
    const deploymentId = await startDeployment({ projectId: project.id });
    return NextResponse.json({ ok: true, deploymentId }, { status: 202 });
  } catch (e) {
    console.error('[openhost] webhook deploy failed', e);
    return NextResponse.json({ error: 'deploy failed to start' }, { status: 500 });
  }
}
