'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
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
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Deployment {
  id: string;
  hash: string;
  branch: string;
  commit: string;
  message: string;
  author: string;
  time: string;
  duration: string;
  status: 'ready' | 'building' | 'error';
}

const deployments: Deployment[] = [
  {
    id: 'd1',
    hash: 'a1b2c3d',
    branch: 'main',
    commit: 'a1b2c3d',
    message: 'feat: add pricing page',
    author: 'kalashv',
    time: '2 minutes ago',
    duration: '94s',
    status: 'ready',
  },
  {
    id: 'd2',
    hash: 'e4f5g6h',
    branch: 'fix/header-overflow',
    commit: 'e4f5g6h',
    message: 'fix: header overflow on mobile',
    author: 'kalashv',
    time: '14 minutes ago',
    duration: '88s',
    status: 'ready',
  },
  {
    id: 'd3',
    hash: 'i7j8k9l',
    branch: 'main',
    commit: 'i7j8k9l',
    message: 'chore: bump dependencies',
    author: 'kalashv',
    time: '1 hour ago',
    duration: '102s',
    status: 'ready',
  },
  {
    id: 'd4',
    hash: 'm0n1o2p',
    branch: 'feature/auth',
    commit: 'm0n1o2p',
    message: 'wip: auth flow',
    author: 'kalashv',
    time: '3 hours ago',
    duration: '76s',
    status: 'error',
  },
  {
    id: 'd5',
    hash: 'q3r4s5t',
    branch: 'main',
    commit: 'q3r4s5t',
    message: 'feat: initial commit',
    author: 'kalashv',
    time: '1 day ago',
    duration: '121s',
    status: 'ready',
  },
];

const logLines = [
  { t: '00:00', text: 'Cloning repository kalashv/saas-landing@main...', level: 'info' },
  { t: '00:02', text: 'Detected Next.js 14 (App Router)', level: 'info' },
  { t: '00:03', text: 'Installing dependencies (pnpm install)...', level: 'info' },
  { t: '00:18', text: 'Dependencies installed in 15.2s', level: 'success' },
  { t: '00:19', text: 'Running next build...', level: 'info' },
  { t: '00:52', text: 'Compiled successfully (32 routes)', level: 'success' },
  { t: '00:53', text: 'Uploading 1,204 static assets to S3...', level: 'info' },
  { t: '01:12', text: 'Static assets uploaded (12.4 MB)', level: 'success' },
  { t: '01:13', text: 'Packaging SSR functions for Lambda...', level: 'info' },
  { t: '01:28', text: 'Lambda function updated (us-east-1)', level: 'success' },
  { t: '01:29', text: 'Configuring CloudFront distribution...', level: 'info' },
  { t: '01:31', text: 'CloudFront distribution deployed', level: 'success' },
  { t: '01:32', text: 'Invalidating CDN cache...', level: 'info' },
  { t: '01:34', text: 'Cache invalidated', level: 'success' },
  { t: '01:34', text: 'Deployment ready at https://saas-landing.edgeown.app', level: 'success' },
];

const domains = [
  {
    domain: 'saas-landing.edgeown.app',
    type: 'EdgeOwn subdomain',
    status: 'Active',
    primary: true,
  },
  {
    domain: 'app.kalash.dev',
    type: 'Custom domain',
    status: 'Active',
    primary: false,
  },
];

const envVars = [
  { key: 'DATABASE_URL', value: 'postgres://****@db.supabase.co', locked: true },
  { key: 'STRIPE_SECRET_KEY', value: 'sk_live_************', locked: true },
  { key: 'NEXT_PUBLIC_APP_URL', value: 'https://app.kalash.dev', locked: false },
  { key: 'NEXT_PUBLIC_ANALYTICS_ID', value: 'UA-12345678-1', locked: false },
];

const statusConfig = {
  ready: { label: 'Ready', icon: CheckCircle2, className: 'text-success' },
  building: { label: 'Building', icon: Clock, className: 'text-warning' },
  error: { label: 'Failed', icon: AlertCircle, className: 'text-destructive' },
};

export function ProjectDetail({ projectId }: { projectId: string }) {
  const project = deployments.length > 0 ? { id: projectId, name: 'saas-landing' } : null;
  if (!project) notFound();

  const [tab, setTab] = useState('deployments');

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
            <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground">kalashv/saas-landing</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href="https://saas-landing.edgeown.app" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Visit
            </Button>
          </a>
          <Button size="sm" variant="outline" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Redeploy
          </Button>
        </div>
      </div>

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
          <DeploymentsTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsTab />
        </TabsContent>
        <TabsContent value="domains" className="mt-6">
          <DomainsTab />
        </TabsContent>
        <TabsContent value="env" className="mt-6">
          <EnvVarsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DeploymentsTab() {
  return (
    <div className="space-y-3">
      {deployments.map((d) => {
        const status = statusConfig[d.status];
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
                  <span className="truncate font-medium text-sm">{d.message}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{d.commit}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {d.branch}
                  </Badge>
                  <span>by {d.author}</span>
                  <span>{d.time}</span>
                  <span>built in {d.duration}</span>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                {d.status === 'ready' && (
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rollback
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  Visit
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LogsTab() {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="border-b border-border/60 py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Build logs</CardTitle>
            <CardDescription className="text-xs">
              Latest deployment &middot; a1b2c3d &middot; 94s
            </CardDescription>
          </div>
          <Badge className="bg-success/15 text-success hover:bg-success/15">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Success
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="bg-secondary/20 p-0">
        <div className="h-[480px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {logLines.map((line, i) => (
            <div key={i} className="flex gap-3 py-0.5">
              <span className="shrink-0 text-muted-foreground/50">{line.t}</span>
              <span
                className={
                  line.level === 'success'
                    ? 'text-success'
                    : line.level === 'error'
                    ? 'text-destructive'
                    : 'text-foreground/80'
                }
              >
                {line.text}
              </span>
            </div>
          ))}
          <div className="flex gap-3 py-0.5">
            <span className="text-primary">$</span>
            <span className="inline-block h-4 w-2 animate-pulse bg-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DomainsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Domains</h3>
          <p className="text-sm text-muted-foreground">
            Manage domains and automatic SSL certificates.
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add domain
        </Button>
      </div>

      <div className="space-y-3">
        {domains.map((d) => (
          <Card key={d.domain} className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{d.domain}</span>
                    {d.primary && (
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {d.status}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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

function EnvVarsTab() {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Environment variables</h3>
          <p className="text-sm text-muted-foreground">
            Encrypted at rest. Applied to production and preview deployments.
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add variable
        </Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="divide-y divide-border/60 p-0">
          {envVars.map((env) => (
            <div key={env.key} className="flex items-center gap-3 p-4">
              <div className="w-48 shrink-0 font-mono text-sm">{env.key}</div>
              <div className="flex-1 font-mono text-sm text-muted-foreground">
                {visible[env.key] ? env.value : '••••••••••••••••'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggle(env.key)}
              >
                {visible[env.key] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Basic project configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" defaultValue="saas-landing" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch">Production branch</Label>
            <Input id="branch" defaultValue="main" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">AWS region</Label>
            <Input id="region" defaultValue="us-east-1" />
          </div>
          <Button size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deleting a project removes all deployments from your AWS account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            Delete project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
