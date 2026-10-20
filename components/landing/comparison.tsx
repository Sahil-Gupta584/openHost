import { Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Reveal } from '@/components/landing/reveal';
import { SectionHeading } from '@/components/landing/section-heading';

const rows = [
  { label: 'Platform fee on compute', openhost: 'None', vercel: '20%+' },
  { label: 'Bandwidth markup', openhost: 'None', vercel: '100GB then overage' },
  {
    label: 'Serverless function overage',
    openhost: 'Pure AWS pricing',
    vercel: '$40+/mo on Pro',
  },
  {
    label: 'Git push to deploy',
    openhost: true,
    vercel: true,
  },
  {
    label: 'Preview deployments',
    openhost: true,
    vercel: true,
  },
  {
    label: 'Custom domains + SSL',
    openhost: true,
    vercel: true,
  },
  {
    label: 'Infrastructure ownership',
    openhost: 'Your AWS account',
    vercel: 'Vercel-owned',
  },
  {
    label: 'Data residency control',
    openhost: 'Full',
    vercel: 'Limited',
  },
  {
    label: 'Scales to zero',
    openhost: true,
    vercel: true,
  },
  {
    label: 'Typical indie monthly cost',
    openhost: '$15–35',
    vercel: '$50–60+',
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-4 w-4" />
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="h-4 w-4" />
      </span>
    );
  }
  return <span className="font-medium text-foreground">{value}</span>;
}

export function Comparison() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The cost difference"
          title="Same DX. A fraction of the bill."
          description="For a typical indie workload with moderate traffic, the savings add up fast."
        />

        <Reveal delay={100}>
          <Card className="mt-12 overflow-hidden border-border/60">
            <CardContent className="p-0">
              <div className="grid grid-cols-3 border-b border-border/60 bg-secondary/30 text-sm font-semibold">
                <div className="p-4 text-muted-foreground">Feature</div>
                <div className="flex items-center justify-center gap-2 border-l border-border/60 p-4 text-primary">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
                    O
                  </span>
                  OpenHost
                </div>
                <div className="flex items-center justify-center gap-2 border-l border-border/60 p-4 text-muted-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/80 text-background text-xs">
                    V
                  </span>
                  Vercel Pro
                </div>
              </div>
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`group grid grid-cols-3 text-sm transition-colors ${
                    i % 2 === 1 ? 'bg-secondary/10' : ''
                  } hover:bg-secondary/25`}
                >
                  <div className="p-4 text-muted-foreground">{row.label}</div>
                  <div className="flex items-center justify-center border-l border-border/60 p-4">
                    <Cell value={row.openhost} />
                  </div>
                  <div className="flex items-center justify-center border-l border-border/60 p-4">
                    <Cell value={row.vercel} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Cost figures are illustrative estimates for a single Next.js app with
          moderate traffic. Actual AWS spend varies by region and usage.
        </p>
      </div>
    </section>
  );
}
