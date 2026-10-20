'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Github,
  ExternalLink,
  Globe,
  Settings,
  ScrollText,
  Rocket,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleSlash,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useProject,
  type DeploymentItem,
  type EnvVarItem,
} from '@/hooks/use-project';
import { timeAgo, formatDuration, cn } from '@/lib/utils';

type StatusIcon = typeof CheckCircle2;

const statusConfig: Record<string, { label: string; icon: StatusIcon; className: string }> = {
  ready: { label: 'Ready', icon: CheckCircle2, className: 'text-success' },
  queued: { label: 'Waiting', icon: Clock, className: 'text-muted-foreground' },
  building: { label: 'Building', icon: Clock, className: 'text-warning' },
  error: { label: 'Failed', icon: AlertCircle, className: 'text-destructive' },
};

/** Manual deployments carry a 'pending' hash until the build reports the real commit. */
const isPendingHash = (hash: string) => !/^[0-9a-f]{7,40}$/i.test(hash);
const deployTitle = (d: DeploymentItem) =>
  d.commit_message ?? (isPendingHash(d.commit_hash) ? 'Manual deploy' : d.commit_hash.slice(0, 7));
const hashChip = (hash: string) => (isPendingHash(hash) ? 'manual deploy' : hash.slice(0, 7));

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const project = useProject(projectId);
  const [tab, setTab] = useState('deployments');
  const [deploying, setDeploying] = useState(false);

  /** Trigger a new deployment and send the user to the live log. */
  const deployNow = async () => {
    setDeploying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        // e.g. already building → go watch the existing run.
        router.push(`/dashboard/${projectId}`);
        return;
      }
      router.push(`/dashboard/${projectId}/deployments/${body.data.deploymentId}`);
    } finally {
      setDeploying(false);
    }
  };

  if (project.loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading project...
      </div>
    );
  }

  if (project.error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Button>
        </Link>
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {project.error}
        </p>
      </div>
    );
  }

  if (!project.data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Button>
        </Link>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const { data } = project;
  const latest = data.latest;
  const latestStatus = statusConfig[latest?.status ?? ''] ?? statusConfig.ready!;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground">
            <Github className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{data.project.name}</h1>
            <p className="text-sm text-muted-foreground">{data.project.repo}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => void deployNow()} disabled={deploying}>
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Deploy
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (!confirm('Delete this project and its AWS resources?')) return;
              void project
                .deleteProject()
                .then(() => {
                  window.location.href = '/dashboard';
                })
                .catch((e) => console.error('[OpenHost] delete failed', e));
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {latest && (
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
            latestStatus.className,
            latest.status === 'error' && 'text-destructive'
          )}
        >
          {latest.status === 'building' || latest.status === 'queued' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <Link
                href={`/dashboard/${projectId}/deployments/${latest.id}`}
                className="underline-offset-2 hover:underline"
              >
                {latest.status === 'queued'
                  ? 'Waiting for AWS build capacity — it starts automatically'
                  : 'Deployment in progress — watch it live'}
              </Link>
            </>
          ) : (
            <>
              <latestStatus.icon className="h-4 w-4" />
              <span>
                Latest deploy {latestStatus.label.toLowerCase()} · {deployTitle(latest)} ·{' '}
                {timeAgo(latest.created_at)}
                {latest.duration_ms != null && <> · built in {formatDuration(latest.duration_ms)}</>}
              </span>
              {latest.status === 'ready' && (
                <>
                  <a
                    href={`/~/${projectId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 font-medium text-success hover:bg-success/20"
                    title="Open the live deployment served through OpenHost"
                  >
                    Visit <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`/dashboard/${projectId}/deployments/${latest.id}`}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    details
                  </a>
                </>
              )}
            </>
          )}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="deployments" className="gap-1.5">
            <Rocket className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="domains" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Domains
          </TabsTrigger>
          <TabsTrigger value="env" className="gap-1.5">
            <KeyRound className="h-4 w-4" />
            Environment
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="mt-6">
          <DeploymentsTab deployments={data.deployments} projectId={projectId} />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsTab latest={data.latest} />
        </TabsContent>
        <TabsContent value="domains" className="mt-6">
          <DomainsTab
            projectId={projectId}
            domains={data.domains}
            onAdd={(d) => void project.addDomain(d)}
            onRemove={(d) => void project.deleteDomain(d)}
            error={project.mutationError}
          />
        </TabsContent>
        <TabsContent value="env" className="mt-6">
          <EnvVarsTab
            envVars={data.envVars}
            onSave={(kv) => void project.saveEnvVar(kv)}
            onDelete={(key) => void project.deleteEnvVar(key)}
            error={project.mutationError}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab
            project={data.project}
            onSave={(patch) => void project.updateProject(patch)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DeploymentsTab({ deployments, projectId }: { deployments: DeploymentItem[]; projectId: string }) {
  if (deployments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-16 text-center">
        <p className="text-muted-foreground">No deployments yet. Hit "Deploy" above to start one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deployments.map((d) => {
        const status = statusConfig[d.status] ?? {
          label: d.status,
          icon: CircleSlash,
          className: 'text-muted-foreground',
        };
        const StatusIcon = status.icon;
        return (
          <Card key={d.id} className="border-border/60 transition-colors hover:border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/50 ${status.className}`}
              >
                <StatusIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/${projectId}/deployments/${d.id}`}
                    className="truncate text-sm font-medium hover:text-primary hover:underline underline-offset-2"
                  >
                    {deployTitle(d)}
                  </Link>
                  {d.status === 'ready' && d.production_url && (
                    <a
                      href={`/~/${projectId}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the live deployment"
                      className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success hover:bg-success/20"
                    >
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{hashChip(d.commit_hash)}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {d.branch}
                  </Badge>
                  {d.author && <span>by {d.author}</span>}
                  <span>{timeAgo(d.created_at)}</span>
                  <span>built in {formatDuration(d.duration_ms)}</span>
                </div>
              </div>
              <span className={`hidden text-sm font-medium sm:block ${status.className}`}>
                {status.label}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LogsTab({ latest }: { latest: DeploymentItem | null }) {
  if (!latest) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-16 text-center">
        <p className="text-muted-foreground">No build logs yet.</p>
      </div>
    );
  }

  const lines = (latest.build_logs ?? '').split('\n');

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="border-b border-border/60 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Build logs</CardTitle>
            <CardDescription className="text-xs">
              Deployment {deployTitle(latest).toLowerCase()} &middot;{' '}
              {formatDuration(latest.duration_ms)}
            </CardDescription>
          </div>
          <Badge
            className={
              latest.status === 'error'
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/15'
                : 'bg-success/15 text-success hover:bg-success/15'
            }
          >
            <LogStatusIcon status={latest.status} className="mr-1 h-3 w-3" />
            {latest.status === 'error'
              ? 'Failed'
              : latest.status === 'queued'
                ? 'Queued'
                : latest.status === 'building'
                  ? 'Building'
                  : 'Success'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="bg-secondary/20 p-0">
        <div className="h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3 py-0.5 text-foreground/80">
              <span className="shrink-0 text-muted-foreground/50">{String(i + 1).padStart(2, '0')}</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LogStatusIcon({ status, className }: { status: string; className?: string }) {
  const Icon = statusConfig[status]?.icon ?? CircleSlash;
  return <Icon className={className} />;
}

function DomainsTab({
  projectId,
  domains,
  onAdd,
  onRemove,
  error,
}: {
  projectId: string;
  domains: { id: string; domain: string; type: string; status: string }[];
  onAdd: (domain: string) => void;
  onRemove: (domain: string) => void;
  error: string | null;
}) {
  const [newDomain, setNewDomain] = useState('');

  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newDomain.trim()) return;
          onAdd(newDomain.trim());
          setNewDomain('');
        }}
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="new-domain">Custom domain</Label>
          <Input
            id="new-domain"
            placeholder="app.example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add domain
        </Button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="space-y-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">/{'~'}/{projectId}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Production
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Path URL — served by OpenHost, backed by your AWS origin
                </p>
              </div>
            </div>
            <a
              href={`/~/${projectId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-success hover:underline"
            >
              Visit <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        {domains.map((d) => (
          <Card key={d.id} className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-medium">{d.domain}</span>
                  <p className="text-xs text-muted-foreground">
                    Custom domain &middot; {d.status === 'active' ? 'active' : 'pending DNS'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {d.status === 'active' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <CircleSlash className="h-4 w-4 text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(d.domain)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EnvVarsTab({
  envVars,
  onSave,
  onDelete,
  error,
}: {
  envVars: EnvVarItem[];
  onSave: (kv: { key: string; value: string; isSecret: boolean }) => void;
  onDelete: (key: string) => void;
  error: string | null;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const toggle = (key: string) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newKey.trim() || !newValue.trim()) return;
          onSave({ key: newKey.trim(), value: newValue, isSecret: false });
          setNewKey('');
          setNewValue('');
        }}
      >
        <div className="w-48 space-y-1.5">
          <Label htmlFor="new-env-key">Key</Label>
          <Input id="new-env-key" placeholder="MY_VAR" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-env-value">Value</Label>
          <Input id="new-env-value" placeholder="…" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
        </div>
        <Button type="submit" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add variable
        </Button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Card className="border-border/60">
        <CardContent className="p-0">
          {envVars.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No environment variables yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {envVars.map((env) => (
                <div key={env.id} className="flex items-center gap-3 p-4">
                  <div className="w-48 shrink-0 truncate font-mono text-sm">{env.key}</div>
                  <div className="flex-1 font-mono text-sm text-muted-foreground">
                    {env.is_secret && !visible[env.id] ? '••••••••••••••••' : env.value}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggle(env.id)}
                  >
                    {visible[env.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(env.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab({
  project,
  onSave,
}: {
  project: { name: string; branch: string; region: string };
  onSave: (patch: { name?: string; branch?: string; region?: string }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [branch, setBranch] = useState(project.branch);
  const [region, setRegion] = useState(project.region);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, branch, region });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }}
    >
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Basic project configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch">Production branch</Label>
            <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">AWS region</Label>
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              Save changes
            </Button>
            {saved && <span className="text-xs text-success">Saved.</span>}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
