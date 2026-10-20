'use client';

import { useState } from 'react';
import { Github, KeyRound, Trash2, Loader2, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGithubSettings } from '@/hooks/use-github-settings';

export function SettingsView() {
  const gh = useGithubSettings();
  const [token, setToken] = useState('');

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-host.example';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integration credentials for your AWS and GitHub accounts.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" />
            GitHub access token
            {gh.status?.connected && (
              <Badge className="ml-auto bg-success/15 text-success hover:bg-success/15">
                Connected
              </Badge>
            )}
            {gh.status && !gh.status.connected && (
              <Badge variant="outline" className="ml-auto">
                Not connected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Grants OpenHost the ability to clone repositories — including private
            ones. Token is verified against api.github.com before being stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gh.status?.connected && (
            <div className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-sm">
              <span className="font-mono text-muted-foreground">{gh.status.masked}</span>
              <span className="text-xs text-muted-foreground">
                {gh.status.source === 'env' ? 'from GITHUB_TOKEN env (read-only)' : 'stored in database'}
              </span>
            </div>
          )}

          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!token.trim()) return;
              void gh.saveToken(token.trim()).then(() => setToken(''));
            }}
          >
            <Label htmlFor="gh-token">
              {gh.status?.source === 'database' ? 'Replace token' : 'Paste token'}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="gh-token"
                type="password"
                placeholder="ghp_…" // fine-grained: github_pat_…
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={gh.saving || !token.trim()}>
                {gh.saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create at github.com/settings/tokens — fine-grained, with “Contents: Read” for target repos.
            </p>
          </form>

          {gh.status?.source === 'database' && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={gh.saving}
              onClick={() => void gh.removeToken()}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove stored token
            </Button>
          )}

          {gh.error && <p className="text-xs text-destructive">{gh.error}</p>}
          {gh.notice && <p className="text-xs text-success">{gh.notice}</p>}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" />
            Git push → auto deploy
          </CardTitle>
          <CardDescription>
            Add this webhook to every repo you want to deploy on push. The secret below goes in the
            GitHub webhook config.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Payload URL" value={`${origin}/api/webhooks/github`} />
          <Row label="Content type" value="application/json" />
          <Row label="Secret" value="GITHUB_WEBHOOK_SECRET (server env)" />
          <Row label="Events" value="Just the push event" />
          <p className="text-xs text-muted-foreground">
            Pushes to a project's production branch start a deployment automatically; branch mismatch
            is recorded but not deployed (preview branches arrive in M5).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/50 bg-secondary/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs sm:text-right">{value}</span>
    </div>
  );
}
