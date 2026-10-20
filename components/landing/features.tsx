import {
  GitBranch,
  Globe,
  KeyRound,
  RotateCcw,
  ScrollText,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Reveal } from '@/components/landing/reveal';
import { SectionHeading } from '@/components/landing/section-heading';

const features = [
  {
    icon: GitBranch,
    title: 'Git push to deploy',
    description:
      'Connect GitHub or GitLab. Every push to main deploys to production; every PR gets its own preview URL.',
  },
  {
    icon: Globe,
    title: 'Custom domains & SSL',
    description:
      'Bring your own domain. Wildcard certificates are provisioned automatically via AWS Certificate Manager.',
  },
  {
    icon: Zap,
    title: 'Scales to zero',
    description:
      'Serverless Lambda handles SSR, API routes, and Server Actions. You pay nothing when traffic stops.',
  },
  {
    icon: RotateCcw,
    title: 'Instant rollbacks',
    description:
      'Every deployment is immutable. Roll back to any prior version in one click — no rebuild required.',
  },
  {
    icon: ScrollText,
    title: 'Logs & analytics',
    description:
      'Real-time deployment logs and request-level insights streamed straight from CloudFront and Lambda.',
  },
  {
    icon: KeyRound,
    title: 'Environment variables',
    description:
      'Manage secrets per environment with encrypted storage. Production, preview, and dev stay isolated.',
  },
  {
    icon: ShieldCheck,
    title: 'Your account, your rules',
    description:
      'Infrastructure lives in your AWS account with least-privilege IAM. No lock-in, full ownership.',
  },
  {
    icon: Server,
    title: 'Full Next.js support',
    description:
      'SSR, ISR, API routes, Middleware, Server Actions, and static export — all handled via OpenNext.',
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Everything included"
          title="The Vercel flow you know, on infrastructure you own"
          description="From git integration to custom domains, OpenHost handles the entire deploy pipeline. The only difference is where the bill goes."
        />

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 60} className="h-full">
              <Card
                className="group relative h-full overflow-hidden border-border/60 bg-card/50 transition-all after:pointer-events-none after:absolute after:inset-0 after:rounded-b-lg after:opacity-0 after:transition-opacity hover:after:opacity-100 hover:border-primary/40 hover:shadow-lg after:[background:linear-gradient(to_top,hsl(var(--primary)/0.06),transparent_40%)] motion-reduce:transition-none"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground/40 transition-colors group-hover:text-primary/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <CardTitle className="mt-4 text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
