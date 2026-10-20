import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/landing/reveal';

export function CTA() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 px-6 py-16 text-center sm:px-12">
            <div className="bg-grid absolute inset-0 opacity-30" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="absolute left-1/2 top-0 -z-10 h-[280px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[100px]" />

            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Stop paying the platform tax.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
                Deploy your Next.js app on your own AWS in under five minutes.
                Keep the DX, cut the bill.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/dashboard">
                  <Button size="lg" className="group w-full sm:w-auto">
                    Deploy your first app
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/#pricing">
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-background/80 w-full backdrop-blur sm:w-auto"
                  >
                    Compare plans
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  5-minute setup
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
