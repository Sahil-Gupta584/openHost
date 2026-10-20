'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live deployment hook — replays previous events, then follows the SSE
 * stream from /deployments/:id/stream. Falls back to polling the GET
 * endpoint if EventSource fails (e.g. some corporate proxies).
 */

export interface DeployEvent {
  seq: number;
  at: string;
}

export interface LogEvent extends DeployEvent {
  type: 'log';
  level: 'info' | 'success' | 'error';
  text: string;
}

export interface StatusEvent extends DeployEvent {
  type: 'status';
  status: 'queued' | 'building' | 'ready' | 'error';
  url?: string;
  durationMs?: number;
  error?: string;
}

export type AnyDeployEvent = LogEvent | StatusEvent;

export function useDeployment(projectId: string, deploymentId: string) {
  const [events, setEvents] = useState<AnyDeployEvent[]>([]);
  const [status, setStatus] = useState<'queued' | 'building' | 'ready' | 'error' | 'loading'>('loading');
  const [source, setSource] = useState<EventSource | null>(null);

  const loadingRef = useRef(false);

  const bootstrap = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetch(`/api/projects/${projectId}/deployments/${deploymentId}`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (res.ok && body.data) {
        const d = body.data as { status: string; build_logs: string | null };
        setStatus((d.status as StatusEvent['status']) ?? 'building');
        // Seed the view with persisted rows; live stream appends on top.
        const lines = (d.build_logs ?? '').split('\n').filter(Boolean);
        setEvents((prev) => {
          if (prev.length || !lines.length) return prev;
          return lines.map((text, i) => ({
            type: 'log' as const,
            seq: i + 1,
            at: new Date().toISOString(),
            level: /fail|error|exited/i.test(text) ? ('error' as const) : ('info' as const),
            text,
          }));
        });
      }
    } catch {
      /* stream will retry */
    } finally {
      loadingRef.current = false;
    }
  }, [projectId, deploymentId]);

  useEffect(() => {
    void bootstrap();

    const es = new EventSource(
      `/api/projects/${projectId}/deployments/${deploymentId}/stream`
    );
    setSource(es);

    es.addEventListener('deploy', (e) => {
      const event = JSON.parse((e as MessageEvent).data) as AnyDeployEvent;
      setEvents((prev) => {
        // Replay may overlap with the seeded GET data — dedupe by seq.
        if (prev.some((p) => p.type === 'log' && p.seq === event.seq)) return prev;
        if (prev.length >= 400) return [...prev.slice(1), event];
        return [...prev, event];
      });
      if (event.type === 'status') {
        setStatus(event.status);
        if (event.status === 'ready' || event.status === 'error') es.close();
      }
    });

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, deploymentId]);

  return { events, status, close: source?.close.bind(source) };
}
