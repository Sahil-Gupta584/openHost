'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Projects list hook — talks to /api/projects with the {data} envelope
 * used by lib/api/http. Components stay UI-only.
 */

export type ProjectStatus = 'ready' | 'building' | 'queued' | 'error' | 'empty';

export interface ProjectSummary {
  id: string;
  name: string;
  repo: string;
  branch: string;
  region: string;
  status: ProjectStatus;
  lastDeployAt: string | null;
  lastDeployDurationMs: number | null;
  domain: string | null;
}

export interface CreateProjectInput {
  repo: string;
  name?: string;
  branch: string;
  region?: string;
}

async function readApi<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await readApi<ProjectSummary[]>(
        await fetch('/api/projects', { cache: 'no-store' })
      );
      setProjects(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      const created = await readApi<ProjectSummary>(
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
      await refresh();
      return created;
    },
    [refresh]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await readApi(await fetch(`/api/projects/${id}`, { method: 'DELETE' }));
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    []
  );

  return { projects, loading, error, refresh, createProject, deleteProject };
}
