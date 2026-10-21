import { param } from '@/lib/api/http';
import { subscribe, history, type DeployEvent } from '@/lib/services/deploy-bus';
import { getDeployment } from '@/lib/supabase/queries/deployments';

export const dynamic = 'force-dynamic';
// Streams live build logs for one deployment (Server-Sent Events).
// 300s = Hobby plan max for serverless functions; when the function is cut,
// native EventSource auto-reconnects and this route replays buffered history.
export const maxDuration = 300;

type Ctx = { params: { projectId: string; deploymentId: string } };

/**
 * GET /api/projects/:projectId/deployments/:deploymentId/stream
 *
 * Flow:
 *   1. reply with the buffered events so far (replay), then live events
 *   2. ALSO tail the DB row every 2.5s — the deploy orchestrator runs in a
 *      different Lambda instance on Vercel, so in-memory bus history is often
 *      empty here; the incremental build_logs flushes are the real channel.
 *   3. `status` event with status ready|error closes the stream
 *   4. keep-alive pings every 15s so proxies don't idle-timeout
 */
export async function GET(req: Request, { params }: Ctx) {
  const deploymentId = param(params, 'deploymentId', 'Deployment');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (event: DeployEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: deploy\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      // 1) replay in-memory buffer (dev / same-instance case)
      for (const event of history(deploymentId)) send(event);

      // 2) live subscribe (same instance as the running pipeline)
      let sentSeq = 0; // log events only — status events always pass through
      const terminate = () => {
        if (!open) return;
        open = false;
        setTimeout(() => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }, 300);
      };
      const unsubscribe = subscribe(deploymentId, (event) => {
        if (event.type === 'log' && event.seq <= sentSeq) return; // already replayed
        send(event);
        if (event.type === 'status') {
          if (event.status === 'ready' || event.status === 'error') terminate();
        }
      });

      // 3) DB tail — replays and tails the row until the deployment finishes.
      let lastStatus: string | null = null;
      let knownLog = '';
      let sawStatus = 'building';
      let startedAt = '';
      const poll = async () => {
        if (!open) return;
        try {
          const row = await getDeployment(deploymentId);
          if (!row) {
            // Row may race its insert right after POST /deploy returns — retry next tick.
            return;
          }
          sawStatus = row.status;
          if (!startedAt && row.created_at) startedAt = row.created_at;

          // Diff build_logs against what we have already sent: emit each new
          // line as a synthetic log event, replacing previous text.
          const text = (row.build_logs as string | null) ?? '';
          if (text && text !== knownLog) {
            const lines = text.split('\n');
            const current = knownLog.split('\n');
            let i = 0;
            while (i < lines.length && i < current.length && lines[i] === current[i]) i++;
            for (; i < lines.length; i++) {
              if (!lines[i]) continue;
              sentSeq += 1;
              let level: 'info' | 'success' | 'error' = 'info';
              let out = lines[i];
              // Builder log lines carry ANSI color codes; strip them.
              // eslint-disable-next-line no-control-regex
              out = out.replace(/\x1b\[[0-9;]*m/g, '');
              if (/✓|success|ready|Live now/i.test(out)) level = 'success';
              if (/error|fail|exited|✗/i.test(out)) level = 'error';
              send({
                type: 'log',
                seq: sentSeq,
                at: startedAt || new Date().toISOString(),
                level,
                text: out,
              });
            }
            knownLog = text;
          }

          if ((row.status === 'ready' || row.status === 'error') && row.status !== lastStatus) {
            send({
              type: 'status',
              seq: sentSeq + 1,
              at: startedAt || new Date().toISOString(),
              status: row.status === 'ready' ? 'ready' : 'error',
              url: row.production_url ?? undefined,
              durationMs: row.duration_ms ?? undefined,
              error: statusEventError(text),
            });
          }
          lastStatus = row.status;
          if (row.status === 'ready' || row.status === 'error') terminate();
        } catch {
          /* DB hiccup — in-memory bus still delivers same-instance events */
        }
      };

      void poll();
      const pollTimer: ReturnType<typeof setInterval> = setInterval(
        () => void poll(),
        2500
      );

      let keepAlive: ReturnType<typeof setInterval> | undefined;
      keepAlive = setInterval(() => {
        if (!open) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          open = false;
          clearInterval(keepAlive);
        }
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(pollTimer);
        if (keepAlive) clearInterval(keepAlive);
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/** Pull the terminal error message from the persisted log (builder writes it last). */
function statusEventError(text: string): string | undefined {
  const lines = text.split('\n').filter(Boolean);
  const last = [...lines].reverse().find((l) => /error|fail|exited/i.test(l));
  return last;
}

