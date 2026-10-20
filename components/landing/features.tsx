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
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Everything included
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            The Vercel flow you know, on infrastructure you own
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            From git integration to custom domains, EdgeOwn handles the entire
            deploy pipeline. The only difference is where the bill goes.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group relative overflow-hidden border-border/60 bg-card/50 transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-4 text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
