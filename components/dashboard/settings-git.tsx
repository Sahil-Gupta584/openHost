'use client';

import { useEffect, useState } from 'react';
import { Github, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function GitSettings() {
  const [status, setStatus] = useState<GithubIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch('/api/settings/github', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setStatus(body.data as GithubIdentity);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GitHub settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/github', { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setStatus(body.data as GithubIdentity);
      setNotice('Disconnected.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Github className="h-4 w-4" />
          GitHub account
          {status?.connected && (
            <Badge className="ml-auto bg-success/15 text-success hover:bg-success/15">
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connecting your GitHub account lists your newest-updated repos when creating a
          project, and attaches a push webhook to each project&apos;s repo so commits
          auto-deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : status?.connected ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {status.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.avatarUrl}
                  alt={`${status.login}'s avatar`}
                  className="h-9 w-9 rounded-full border border-border/60"
                />
              )}
              <div className="leading-tight">
                <p className="text-sm font-medium">{status.name ?? status.login}</p>
                <p className="text-xs text-muted-foreground">
                  @{status.login} · token {status.masked}
                  {status.source === 'env' ? ' (env, read-only)' : ''}
                </p>
              </div>
            </div>
            {status.source === 'database' && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={saving}
                onClick={() => void disconnect()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Disconnect
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            <a href="/api/auth/github" className="w-fit">
              <Button size="sm">
                <Github className="mr-1.5 h-4 w-4" />
                Connect with GitHub
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Approving GitHub grants OpenHost <span className="font-mono">repo</span> and{' '}
              <span className="font-mono">admin:repo_hook</span> scopes — used to list your
              repos, clone private code, and attach push webhooks. Verified against
              api.github.com before storing.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        {notice && <p className="text-xs text-success">{notice}</p>}
      </CardContent>
    </Card>
  );
}

interface GithubIdentity {
  connected: boolean;
  source: 'database' | 'env' | 'none';
  masked: string | null;
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
}
