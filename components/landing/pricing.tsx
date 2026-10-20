import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Reveal } from '@/components/landing/reveal';
import { SectionHeading } from '@/components/landing/section-heading';

const tiers = [
  {
    name: 'Hobby',
    platformFee: '$0',
    description: 'For side projects and experiments.',
    features: [
      '1 project',
      'Unlimited preview deployments',
      'Free /~/ path URL (public, instant)',
      'Community support',
      'AWS costs billed directly by Amazon',
    ],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Indie',
    platformFee: '$9 / mo',
    description: 'For solo founders running real products.',
    features: [
      'Up to 5 projects',
      'Custom domains + automatic SSL',
      'Deployment logs & request analytics',
      'Environment variables per environment',
      'One-click rollback',
      'Email support',
    ],
    cta: 'Start deploying',
    highlight: true,
  },
  {
    name: 'Team',
    platformFee: '$29 / mo',
    description: 'For small teams managing multiple apps.',
    features: [
      'Unlimited projects',
      'Team collaboration & roles',
      'Cost dashboard & AWS spend insights',
      'Priority support',
      'Webhook & API access',
    ],
    cta: 'Contact us',
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="You pay AWS. We charge a flat platform fee."
          description="No compute markup, no bandwidth markup, no function overages. The only variable cost is what AWS bills you directly."
        />

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 90} className="h-full">
              <Card
                className={`relative flex h-full flex-col border-border/60 transition-all motion-reduce:transition-none ${
                  tier.highlight
                    ? 'border-primary/50 shadow-xl glow-primary'
                    : 'hover:border-border'
                }`}
              >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <CardHeader>
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {tier.description}
                </p>
                <div className="mt-4">
                  <span className="text-3xl font-bold tracking-tight">
                    {tier.platformFee}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    platform fee
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard" className="mt-6">
                  <Button
                    className="w-full"
                    variant={tier.highlight ? 'default' : 'outline'}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          All plans include the full OpenHost deploy pipeline. AWS infrastructure
          costs are billed separately by Amazon Web Services.
        </p>
      </div>
    </section>
  );
}
