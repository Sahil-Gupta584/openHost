'use client';

import { useCallback, useEffect, useState } from 'react';

/** GitHub token settings hook — masked reads only, full token never round-trips. */

export interface GithubStatus {
  connected: boolean;
  source: 'database' | 'env' | 'none';
  masked: string | null;
}

interface Hook {
  status: GithubStatus | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  saveToken: (token: string) => Promise<void>;
  removeToken: () => Promise<void>;
}

async function readApi<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export function useGithubSettings(): Hook {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setStatus(await readApi<GithubStatus>(await fetch('/api/settings/github', { cache: 'no-store' })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GitHub settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveToken: Hook['saveToken'] = useCallback(
    async (token) => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const who = await readApi<{ login: string; masked: string }>(
          await fetch('/api/settings/github', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
        );
        setNotice(`Connected to GitHub as ${who.login} (${who.masked})`);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save token');
      } finally {
        setSaving(false);
      }
    },
    [reload]
  );

  const removeToken: Hook['removeToken'] = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await readApi(await fetch('/api/settings/github', { method: 'DELETE' }));
      setNotice('Token removed');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove token');
    } finally {
      setSaving(false);
    }
  }, [reload]);

  return { status, loading, saving, error, notice, saveToken, removeToken };
}
