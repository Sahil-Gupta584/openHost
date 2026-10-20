import { GitBranch, Cloud, Rocket, Globe } from 'lucide-react';
import { Reveal } from '@/components/landing/reveal';
import { SectionHeading } from '@/components/landing/section-heading';

const steps = [
  {
    icon: Cloud,
    title: 'Connect your AWS account',
    description:
      'Create an IAM role with a one-click CloudFormation template. No long-lived access keys — we use OIDC for secure, temporary access.',
    badge: 'Step 01',
  },
  {
    icon: GitBranch,
    title: 'Import a Git repository',
    description:
      'Pick a repo from GitHub or GitLab. OpenHost auto-detects Next.js and configures the optimal build pipeline.',
    badge: 'Step 02',
  },
  {
    icon: Rocket,
    title: 'Deploy with one push',
    description:
      'We build in an isolated container, push static assets to S3, deploy SSR to Lambda, and wire up CloudFront. Live in under 3 minutes.',
    badge: 'Step 03',
  },
  {
    icon: Globe,
    title: 'Get a production URL',
    description:
      'Every project gets a free subdomain. Add custom domains, and every pull request gets its own preview deployment.',
    badge: 'Step 04',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-b border-border/60 py-24"
    >
      <div className="absolute inset-0 -z-10 bg-dots opacity-20" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From git push to global in four steps"
          description="No AWS certification required. The whole setup takes about five minutes."
        />

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-[2.75rem] top-14 hidden h-px w-[calc(100%-2rem)] bg-gradient-to-r from-border to-transparent lg:block" />
              )}
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-card text-primary shadow-sm">
                <step.icon className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <span className="mt-3 inline-block font-mono text-xs text-muted-foreground/60">
                {step.badge}
              </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
