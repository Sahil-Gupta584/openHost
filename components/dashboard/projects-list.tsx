'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Github,
  ExternalLink,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleSlash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewProjectDialog } from '@/components/dashboard/new-project-dialog';
import { useProjects, type ProjectSummary } from '@/hooks/use-projects';
import { timeAgo, formatDuration } from '@/lib/utils';

type StatusIcon = typeof CheckCircle2;

const statusConfig: Record<
  ProjectSummary['status'],
  { label: string; icon: StatusIcon; className: string; dot: string }
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
  queued: {
    label: 'Waiting',
    icon: Clock,
    className: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'text-destructive',
    dot: 'bg-destructive',
  },
  empty: {
    label: 'Not deployed',
    icon: CircleSlash,
    className: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export function ProjectsList() {
  const router = useRouter();
  const { projects, loading, error, createProject, deleteProject } = useProjects();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(
    () =>
      projects.filter((p) =>
        (p.name + ' ' + p.repo).toLowerCase().includes(search.toLowerCase())
      ),
    [projects, search]
  );

  /** Create register + kick off the first deploy + open the live log. */
  const handleCreate: typeof createProject = async (input) => {
    const created = await createProject(input);
    try {
      const res = await fetch(`/api/projects/${created.id}/deploy`, { method: 'POST' });
      const body = await res.json();
      const deploymentId: string | undefined = body?.data?.deploymentId;
      if (deploymentId) {
        router.push(`/dashboard/${created.id}/deployments/${deploymentId}`);
      } else {
        router.push(`/dashboard/${created.id}`);
      }
    } catch {
      router.push(`/dashboard/${created.id}`);
    }
    return created;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
    } catch (e) {
      console.error('[OpenHost] delete failed', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} projects on your AWS account
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

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="flex h-44 animate-pulse flex-col justify-between p-5">
                <div className="h-6 w-2/3 rounded bg-secondary/60" />
                <div className="h-4 w-1/2 rounded bg-secondary/50" />
                <div className="h-4 w-1/3 rounded bg-secondary/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center">
          <p className="text-muted-foreground">
            {projects.length === 0
              ? 'No projects yet — create your first one.'
              : 'No projects match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={() => void handleDelete(project.id)} />
          ))}
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} />
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: ProjectSummary; onDelete: () => void }) {
  const status = statusConfig[project.status] ?? statusConfig.empty;
  const StatusIcon = status.icon;

  return (
    <Card className="group relative cursor-pointer border-border/60 transition-all hover:border-primary/40 hover:shadow-md">
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
                <p className="text-xs text-muted-foreground">{project.repo}</p>
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
                <DropdownMenuItem asChild>
                  <a href={`/dashboard/${project.id}`}>Open</a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                >
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
            <span className={`flex items-center gap-1 text-sm font-medium ${status.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>
            <span className="text-xs text-muted-foreground">
              &middot; {timeAgo(project.lastDeployAt)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <Badge variant="secondary" className="font-mono text-xs">
              {project.branch}
            </Badge>
            {project.lastDeployDurationMs != null && (
              <Badge variant="outline" className="text-xs">
                {formatDuration(project.lastDeployDurationMs)}
              </Badge>
            )}
            {project.status === 'ready' ? (
              <a
                href={`/~/${project.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                title="Open the live deployment served through OpenHost"
              >
                /~/{project.id ? project.id.slice(0, 8) : ''}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </CardContent>
      </a>
    </Card>
  );
}
