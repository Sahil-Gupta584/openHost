import { param } from '@/lib/api/http';
import { subscribe, history } from '@/lib/services/deploy-bus';

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
 *   2. `status` event with status ready|error closes the stream
 *   3. keep-alive pings every 15s so proxies don't idle-timeout
 */
export async function GET(req: Request, { params }: Ctx) {
  const deploymentId = param(params, 'deploymentId', 'Deployment');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      const send = (payload: unknown, event = 'deploy') => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          open = false;
        }
      };

      // 1) replay buffer, 2) live subscribe, 3) heartbeat
      for (const event of history(deploymentId)) send(event);

      const unsubscribe = subscribe(deploymentId, (event) => {
        send(event);
        if (event.type === 'status' && (event.status === 'ready' || event.status === 'error')) {
          setTimeout(() => {
            open = false;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }, 300);
        }
      });

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
