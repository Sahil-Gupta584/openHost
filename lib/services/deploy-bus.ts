/**
 * In-process fan-out for live deploy logs (SSE). One listener set per
 * running deployment. Log history is also persisted to Supabase at status
 * transitions, so the client can replay via GET if it misses the stream.
 */

export interface LogEvent {
  type: 'log';
  seq: number;
  at: string;
  level: 'info' | 'success' | 'error';
  text: string;
}

export interface StatusEvent {
  type: 'status';
  seq: number;
  at: string;
  status: 'building' | 'ready' | 'error';
  url?: string;
  durationMs?: number;
  error?: string;
}

export type DeployEvent = LogEvent | StatusEvent;

/** What the runner emits — seq/at are assigned by the bus. */
export interface LogPayload {
  type: 'log';
  level: LogEvent['level'];
  text: string;
}

export interface StatusPayload {
  type: 'status';
  status: StatusEvent['status'];
  url?: string;
  durationMs?: number;
  error?: string;
}

export type PublishPayload = LogPayload | StatusPayload;

type Subscriber = (event: DeployEvent) => void;

const listeners = new Map<string, Set<Subscriber>>();
const buffers = new Map<string, DeployEvent[]>();

export function publishEvent(deploymentId: string, payload: PublishPayload): DeployEvent {
  const buffer =
    buffers.get(deploymentId) ??
    (() => {
      const b: DeployEvent[] = [];
      buffers.set(deploymentId, b);
      return b;
    })();

  const event: DeployEvent = {
    ...payload,
    seq: buffer.length + 1,
    at: new Date().toISOString(),
  } as DeployEvent;

  buffer.push(event);
  listeners.get(deploymentId)?.forEach((fn) => fn(event));
  return event;
}

export function subscribe(deploymentId: string, fn: Subscriber) {
  const set = listeners.get(deploymentId) ?? new Set();
  set.add(fn);
  listeners.set(deploymentId, set);
  return () => {
    set.delete(fn);
    if (!set.size) listeners.delete(deploymentId);
  };
}

/** Everything the runner has emitted so far (client replay on reconnect). */
export function history(deploymentId: string): DeployEvent[] {
  return buffers.get(deploymentId) ?? [];
}
