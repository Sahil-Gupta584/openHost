'use client';

import { useState } from 'react';
import { Github, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateProjectInput } from '@/hooks/use-projects';
import { parseRepoInput, slugifyProjectName } from '@/lib/utils/repo';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Backend action from the projects hook; caller owns list refresh. */
  onCreate: (input: CreateProjectInput) => Promise<{ name: string }>;
}

const SAMPLE_REPOS: Array<{ repo: string; label: string }> = [
  { repo: 'ixartz/Next-js-Boilerplate', label: 'Next.js starter' },
  { repo: 'owner/my-saas', label: 'SaaS app' },
  { repo: 'owner/marketing-site', label: 'Marketing site' },
];

export function NewProjectDialog({ open, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [step, setStep] = useState<'import' | 'config'>('import');
  const [repo, setRepo] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('import');
    setRepo('');
    setName('');
    setBranch('main');
    setSubmitting(false);
    setError(null);
  };

  /** Accept "owner/name" or a full GitHub URL; derive the project name. */
  const handleSelectRepo = (r: string) => {
    setError(null);
    const parsed = parseRepoInput(r);
    if (!parsed) {
      setError(
        'Could not read a repository from that. Use "owner/name" or paste the GitHub URL.'
      );
      return;
    }
    setRepo(parsed.repo);
    setName(slugifyProjectName(parsed.name));
    setStep('config');
  };

  const handleDeploy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ repo, name: slugifyProjectName(name), branch });
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deploy failed');
      setSubmitting(false);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'import' && (
          <>
            <DialogHeader>
              <DialogTitle>Import a Git repository</DialogTitle>
              <DialogDescription>
                Enter or pick a repository to connect. GitHub URLs work too.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSelectRepo(repo.trim());
              }}
            >
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="owner/repository or GitHub URL"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!parseRepoInput(repo)}
                >
                  Import
                </Button>
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="space-y-2 pt-1">
                {SAMPLE_REPOS.map((r) => (
                  <button
                    key={r.repo}
                    type="button"
                    onClick={() => handleSelectRepo(r.repo)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/30"
                  >
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1 text-left">
                      <span className="block text-sm font-medium">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">{r.repo}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </form>
          </>
        )}

        {step === 'config' && (
          <>
            <DialogHeader>
              <DialogTitle>Configure project</DialogTitle>
              <DialogDescription>
                Review the settings before the first deployment.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="repo">Repository</Label>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-sm">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  {repo}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                />
                {name.trim() !== slugifyProjectName(name) && (
                  <p className="text-xs text-muted-foreground">
                    Will be created as{" "}
                    <span className="font-mono text-foreground/80">{slugifyProjectName(name)}</span>
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branch">Production branch</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <div className="rounded-md bg-secondary/30 p-3 text-xs text-muted-foreground">
                OpenHost will auto-detect Next.js and deploy to S3 + Lambda +
                CloudFront inside your AWS account.
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('import')} disabled={submitting}>
                Back
              </Button>
              <Button onClick={() => void handleDeploy()} disabled={submitting || !name.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create project'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
