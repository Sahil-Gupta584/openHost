'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeployment, type LogEvent } from '@/hooks/use-deployment';
import { cn } from '@/lib/utils';

interface DeployLogProps {
  projectId: string;
  projectTitle: string;
  deploymentId: string;
}

/** Live build log — streams while "building", turns into a success/error card when done. */
export function DeployLog({ projectId, projectTitle, deploymentId }: DeployLogProps) {
  const { events, status } = useDeployment(projectId, deploymentId);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  const startedAt =
    events.find((e): e is LogEvent => e.type === 'log')?.at ?? new Date().toISOString();

  useEffect(() => {
    if (status !== 'building' && status !== 'queued') return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [status, startedAt]);

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [events.length]);

  const statusEvent = [...events].reverse().find((e) => e.type === 'status' ) as
    | { type: 'status'; status: 'ready' | 'error' | 'building' | 'queued'; url?: string; error?: string; durationMs?: number }
    | undefined;

  const running = status === 'building' || status === 'queued';
  const finalStatus = running ? (status === 'queued' ? 'queued' : 'building') : (statusEvent?.status ?? status);

  const logEvents = events.filter((e): e is LogEvent => e.type === 'log');
  const summaryLine = [...logEvents].reverse().find(
    (e) => e.level === 'success' && e.text.startsWith('Deployed')
  )?.text;
  const statusSummary = summaryLine;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/dashboard/${projectId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {projectTitle}
          </Button>
        </Link>
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            running && 'animate-pulse',
            finalStatus === 'ready' && 'text-success',
            finalStatus === 'error' && 'text-destructive'
          )}
        >
          {finalStatus === 'building' && <Loader2 className="h-4 w-4 animate-spin" />}
          {finalStatus === 'queued' && <Clock className="h-4 w-4" />}
          {finalStatus === 'ready' && <CheckCircle2 className="h-4 w-4" />}
          {finalStatus === 'error' && <AlertCircle className="h-4 w-4" />}
          {finalStatus === 'queued'
            ? 'Waiting for AWS build capacity — starts automatically…'
            : finalStatus === 'building'
            ? `Building… ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
            : finalStatus === 'ready'
              ? 'Deployment ready'
              : 'Deployment failed'}
        </span>
        {running && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {logEvents.length} log lines
          </Badge>
        )}
      </div>

      {statusEvent && statusEvent.status === 'ready' && statusEvent.url && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <Link href={statusEvent.url} className="font-medium underline-offset-2 hover:underline">
            {statusEvent.url.replace(/^https?:\/\//, '')}
          </Link>
          <a href={statusEvent.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Visit site
            </Button>
          </a>
        </div>
      )}

      {statusEvent && statusEvent.status === 'error' && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {statusEvent.error ?? statusSummary ?? 'Deployment failed — see log for details.'}
        </div>
      )}

      <div
        ref={logBoxRef}
        className="h-[60vh] overflow-y-auto rounded-lg border border-border/60 bg-secondary/20 p-4 font-mono text-xs leading-relaxed"
      >
        {logEvents.map((e, i) => (
          <div key={`${e.seq}-${i}`} className="flex gap-3 py-0.5">
            <span className="shrink-0 text-muted-foreground/50">
              {new Date(e.at).toLocaleTimeString([], { hour12: false })}
            </span>
            <span
              className={cn(
                e.level === 'success' && 'text-success',
                e.level === 'error' && 'text-destructive'
              )}
            >
              {e.text}
            </span>
          </div>
        ))}
        {running && (
          <div className="flex gap-3 py-0.5">
            <span className="text-primary">$</span>
            <span className="inline-block h-4 w-2 animate-pulse bg-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
