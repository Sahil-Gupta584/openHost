'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Cloud,
  Github,
  GitBranch,
  Globe,
  Zap,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/landing/reveal';

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40" />
      <div className="absolute left-1/2 top-0 -z-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute right-1/4 top-32 -z-10 h-[320px] w-[320px] rounded-full bg-accent/20 blur-[100px]" />

      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              No platform markup on compute or bandwidth
            </div>
          </Reveal>

          <h1
            className="animate-fade-up text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Vercel-grade DX.
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Running on your AWS.
            </span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground"
            style={{ animationDelay: '180ms' }}
          >
            Deploy Next.js apps with git push, preview branches, custom domains,
            and instant rollbacks — all inside your own AWS account. You pay
            pure AWS costs. No surprise bills.
          </p>

          <div
            className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '280ms' }}
          >
            <Link href="/dashboard">
              <Button size="lg" className="group w-full sm:w-auto">
                Deploy your first app
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/#how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                See how it works
              </Button>
            </Link>
          </div>

          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            style={{ animationDelay: '360ms' }}
          >
            <span className="animate-fade-up inline-flex items-center gap-1.5" style={{ animationDelay: '400ms' }}>
              <CheckCircle2 className="h-4 w-4 text-success" />
              No credit card to start
            </span>
            <span className="animate-fade-up inline-flex items-center gap-1.5" style={{ animationDelay: '480ms' }}>
              <CheckCircle2 className="h-4 w-4 text-success" />
              Scales to zero
            </span>
            <span className="animate-fade-up inline-flex items-center gap-1.5" style={{ animationDelay: '560ms' }}>
              <CheckCircle2 className="h-4 w-4 text-success" />
              Full SSR & API routes
            </span>
          </div>
        </div>

        <div
          className="animate-fade-up mx-auto mt-16 max-w-4xl"
          style={{ animationDelay: '480ms' }}
        >
          <TerminalMockup />
        </div>
      </div>
    </section>
  );
}

function TerminalMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-2xl backdrop-blur glow-primary">
      <div className="flex items-center gap-2 border-b border-border/60 bg-secondary/40 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-destructive/80" />
          <div className="h-3 w-3 rounded-full bg-warning/80" />
          <div className="h-3 w-3 rounded-full bg-success/80" />
        </div>
        <span className="ml-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" /> openhost deploy
        </span>
      </div>
      <div className="space-y-2 p-5 font-mono text-sm">
        <TerminalLine
          prompt="$"
          text="git push origin main"
          icon={<Github className="h-4 w-4 text-muted-foreground" />}
          delay={600}
        />
        <div
          className="animate-fade-up pl-4 text-muted-foreground"
          style={{ animationDelay: '700ms' }}
        >
          <span className="text-accent">→</span> Detecting Next.js project…
        </div>
        <div
          className="animate-fade-up pl-4 text-muted-foreground"
          style={{ animationDelay: '800ms' }}
        >
          <span className="text-accent">→</span> Building with isolated
          container…
        </div>
        <div
          className="animate-fade-up pl-4 text-muted-foreground"
          style={{ animationDelay: '900ms' }}
        >
          <span className="text-accent">→</span> Uploading static assets to S3…
        </div>
        <div
          className="animate-fade-up pl-4 text-muted-foreground"
          style={{ animationDelay: '1000ms' }}
        >
          <span className="text-accent">→</span> Deploying SSR to Lambda…
        </div>
        <div
          className="animate-fade-up pl-4 text-muted-foreground"
          style={{ animationDelay: '1100ms' }}
        >
          <span className="text-accent">→</span> Invalidating CloudFront CDN…
        </div>
        <div
          className="animate-fade-up flex items-center gap-2 pt-1 text-success"
          style={{ animationDelay: '1200ms' }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Deployed in 94s
        </div>
        <div
          className="animate-fade-up flex flex-wrap items-center gap-3 pt-2"
          style={{ animationDelay: '1350ms' }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Globe className="h-3.5 w-3.5" /> yourapp.com/~/myapp
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-xs text-accent">
            <GitBranch className="h-3.5 w-3.5" /> yourapp.com/~/preview-pr-42
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5" /> S3 + Lambda + CloudFront
          </span>
        </div>
      </div>
    </div>
  );
}

function TerminalLine({
  prompt,
  text,
  icon,
  delay = 0,
}: {
  prompt: string;
  text: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-up flex items-center gap-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-primary">{prompt}</span>
      {icon}
      <span className="text-foreground">{text}</span>
    </div>
  );
}
