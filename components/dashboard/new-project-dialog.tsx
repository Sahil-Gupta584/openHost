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

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const [step, setStep] = useState<'import' | 'config'>('import');
  const [repo, setRepo] = useState('');
  const [name, setName] = useState('');
  const [deploying, setDeploying] = useState(false);

  const handleSelectRepo = (r: string) => {
    setRepo(r);
    setName(r.split('/')[1] || '');
    setStep('config');
  };

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      onOpenChange(false);
      setStep('import');
      setRepo('');
      setName('');
    }, 1800);
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setStep('import');
      setRepo('');
      setName('');
    }
    onOpenChange(o);
  };

  const sampleRepos = [
    'kalashv/saas-landing',
    'kalashv/analytics-dashboard',
    'kalashv/blog-platform',
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'import' && (
          <>
            <DialogHeader>
              <DialogTitle>Import a Git repository</DialogTitle>
              <DialogDescription>
                Select a repository from your connected GitHub account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {sampleRepos.map((r) => (
                <button
                  key={r}
                  onClick={() => handleSelectRepo(r)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/30"
                >
                  <Github className="h-5 w-5 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{r}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'config' && (
          <>
            <DialogHeader>
              <DialogTitle>Configure project</DialogTitle>
              <DialogDescription>
                Review the settings before deploying to your AWS account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="repo">Repository</Label>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-sm">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  {repo}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Production branch</Label>
                <Input id="branch" defaultValue="main" />
              </div>
              <div className="rounded-md bg-secondary/30 p-3 text-xs text-muted-foreground">
                EdgeOwn will auto-detect Next.js and deploy using S3 + Lambda +
                CloudFront in your AWS account.
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('import')}
                disabled={deploying}
              >
                Back
              </Button>
              <Button onClick={handleDeploy} disabled={deploying}>
                {deploying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  'Deploy'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
