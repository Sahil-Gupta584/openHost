'use client';

import { useState } from 'react';
import {
  Search,
  Plus,
  Github,
  ExternalLink,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewProjectDialog } from '@/components/dashboard/new-project-dialog';

type ProjectStatus = 'ready' | 'building' | 'error';

interface Project {
  id: string;
  name: string;
  repo: string;
  branch: string;
  domain: string;
  status: ProjectStatus;
  lastDeploy: string;
  framework: string;
}

const projects: Project[] = [
  {
    id: '1',
    name: 'saas-landing',
    repo: 'kalashv/saas-landing',
    branch: 'main',
    domain: 'saas-landing.edgeown.app',
    status: 'ready',
    lastDeploy: '2 minutes ago',
    framework: 'Next.js 14',
  },
  {
    id: '2',
    name: 'analytics-dashboard',
    repo: 'kalashv/analytics-dashboard',
    branch: 'main',
    domain: 'analytics.kalash.dev',
    status: 'building',
    lastDeploy: 'deploying now',
    framework: 'Next.js 14',
  },
  {
    id: '3',
    name: 'blog-platform',
    repo: 'kalashv/blog-platform',
    branch: 'main',
    domain: 'blog.edgeown.app',
    status: 'ready',
    lastDeploy: '3 hours ago',
    framework: 'Next.js 13',
  },
  {
    id: '4',
    name: 'api-gateway',
    repo: 'kalashv/api-gateway',
    branch: 'main',
    domain: 'api.kalash.dev',
    status: 'error',
    lastDeploy: 'failed 12m ago',
    framework: 'Next.js 14',
  },
];

const statusConfig: Record<
  ProjectStatus,
  { label: string; icon: typeof CheckCircle2; className: string; dot: string }
> = {
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    className: 'text-success',
    dot: 'bg-success',
  },
  building: {
    label: 'Building',
    icon: Clock,
    className: 'text-warning',
    dot: 'bg-warning',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'text-destructive',
    dot: 'bg-destructive',
  },
};

export function ProjectsList() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} projects connected to your AWS account
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => {
          const status = statusConfig[project.status];
          const StatusIcon = status.icon;
          return (
            <Card
              key={project.id}
              className="group relative cursor-pointer border-border/60 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <a href={`/dashboard/${project.id}`} className="block">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground">
                        <Github className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold leading-tight group-hover:text-primary">
                          {project.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {project.repo}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Visit domain</DropdownMenuItem>
                        <DropdownMenuItem>Redeploy</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`flex h-2 w-2 rounded-full ${status.dot} ${
                        project.status === 'building' ? 'animate-pulse' : ''
                      }`}
                    />
                    <span
                      className={`flex items-center gap-1 text-sm font-medium ${status.className}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      &middot; {project.lastDeploy}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {project.branch}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {project.framework}
                    </Badge>
                    <a
                      href={`https://${project.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      {project.domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </a>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center">
          <p className="text-muted-foreground">No projects found.</p>
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
