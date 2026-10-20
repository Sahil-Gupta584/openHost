'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Single project hook — loads project, deployments, domains and env vars
 * from the API. Mutations return the fresh data or throw with the API's
 * error message surfaced for the UI.
 */

export interface DeploymentItem {
  id: string;
  commit_hash: string;
  branch: string;
  commit_message: string | null;
  author: string | null;
  status: 'queued' | 'building' | 'ready' | 'error';
  duration_ms: number | null;
  build_logs: string | null;
  production_url?: string | null;
  created_at: string;
}

export interface DomainItem {
  id: string;
  domain: string;
  type: 'openhost-subdomain' | 'custom';
  status: 'pending' | 'active' | 'error';
  is_primary: boolean;
}

export interface EnvVarItem {
  id: string;
  key: string;
  value: string;
  is_secret: boolean;
}

export interface ProjectItem {
  id: string;
  name: string;
  repo: string;
  branch: string;
  region: string;
}

interface ProjectData {
  project: ProjectItem;
  deployments: DeploymentItem[];
  latest: DeploymentItem | null;
  defaultDomain: string | null;
  domains: DomainItem[];
  envVars: EnvVarItem[];
}

interface UseProject {
  data: ProjectData | null;
  loading: boolean;
  error: string | null;
  /** Error from the most recent mutation (add/delete env var or domain). */
  mutationError: string | null;
  reload: () => Promise<void>;
  updateProject: (patch: { name?: string; branch?: string; region?: string }) => Promise<void>;
  saveEnvVar: (input: { key: string; value: string; isSecret: boolean }) => Promise<void>;
  deleteEnvVar: (key: string) => Promise<void>;
  addDomain: (domain: string) => Promise<void>;
  deleteDomain: (domain: string) => Promise<void>;
  deleteProject: () => Promise<void>;
}

async function readApi<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export function useProject(projectId: string): UseProject {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  /** Runs a mutation and records failures instead of throwing (UI single source). */
  const runMutation = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        setMutationError(null);
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : 'Action failed');
      }
    },
    []
  );

  const reload = useCallback(async () => {
    try {
      const [project, deployments, domains, envVars] = await Promise.all([
        readApi<ProjectItem>(await fetch(`/api/projects/${projectId}`, { cache: 'no-store' })),
        readApi<{ deployments: DeploymentItem[]; latest: DeploymentItem | null }>(
          await fetch(`/api/projects/${projectId}/deployments`, { cache: 'no-store' })
        ),
        readApi<{ defaultDomain: string | null; domains: DomainItem[] }>(
          await fetch(`/api/projects/${projectId}/domains`, { cache: 'no-store' })
        ),
        readApi<EnvVarItem[]>(await fetch(`/api/projects/${projectId}/env-vars`, { cache: 'no-store' })),
      ]);

      setData({
        project,
        deployments: deployments.deployments,
        latest: deployments.latest,
        defaultDomain: domains.defaultDomain,
        domains: domains.domains,
        envVars,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveEnvVar: UseProject['saveEnvVar'] = useCallback(
    async (input) => {
      await readApi(
        await fetch(`/api/projects/${projectId}/env-vars`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
      await reload();
    },
    [projectId, reload]
  );

  const deleteEnvVar: UseProject['deleteEnvVar'] = useCallback(
    async (key) => {
      await readApi(await fetch(`/api/projects/${projectId}/env-vars/${key}`, { method: 'DELETE' }));
      await reload();
    },
    [projectId, reload]
  );

  const addDomain: UseProject['addDomain'] = useCallback(
    async (domain) => {
      await readApi(
        await fetch(`/api/projects/${projectId}/domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        })
      );
      await reload();
    },
    [projectId, reload]
  );

  const deleteDomain: UseProject['deleteDomain'] = useCallback(
    async (domain) => {
      await readApi(
        await fetch(`/api/projects/${projectId}/domains?domain=${encodeURIComponent(domain)}`, {
          method: 'DELETE',
        })
      );
      await reload();
    },
    [projectId, reload]
  );

  const updateProject: UseProject['updateProject'] = useCallback(
    async (patch) => {
      await readApi(
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
      );
      await reload();
    },
    [projectId, reload]
  );

  const deleteProject: UseProject['deleteProject'] = useCallback(async () => {
    await readApi(await fetch(`/api/projects/${projectId}`, { method: 'DELETE' }));
  }, [projectId]);

  return {
    data,
    loading,
    error,
    mutationError,
    reload,
    updateProject: (patch) => runMutation(() => updateProject(patch)),
    saveEnvVar: (input) => runMutation(() => saveEnvVar(input)),
    deleteEnvVar: (key) => runMutation(() => deleteEnvVar(key)),
    addDomain: (domain) => runMutation(() => addDomain(domain)),
    deleteDomain: (domain) => runMutation(() => deleteDomain(domain)),
    deleteProject: () => deleteProject(),
  };
}
