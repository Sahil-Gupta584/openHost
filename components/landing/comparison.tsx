import { Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const rows = [
  { label: 'Platform fee on compute', edgeown: 'None', vercel: '20%+' },
  { label: 'Bandwidth markup', edgeown: 'None', vercel: '100GB then overage' },
  {
    label: 'Serverless function overage',
    edgeown: 'Pure AWS pricing',
    vercel: '$40+/mo on Pro',
  },
  {
    label: 'Git push to deploy',
    edgeown: true,
    vercel: true,
  },
  {
    label: 'Preview deployments',
    edgeown: true,
    vercel: true,
  },
  {
    label: 'Custom domains + SSL',
    edgeown: true,
    vercel: true,
  },
  {
    label: 'Infrastructure ownership',
    edgeown: 'Your AWS account',
    vercel: 'Vercel-owned',
  },
  {
    label: 'Data residency control',
    edgeown: 'Full',
    vercel: 'Limited',
  },
  {
    label: 'Scales to zero',
    edgeown: true,
    vercel: true,
  },
  {
    label: 'Typical indie monthly cost',
    edgeown: '$15–35',
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
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            The cost difference
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Same DX. A fraction of the bill.
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            For a typical indie workload with moderate traffic, the savings add
            up fast.
          </p>
        </div>

        <Card className="mt-12 overflow-hidden border-border/60">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 border-b border-border/60 bg-secondary/30 text-sm font-semibold">
              <div className="p-4 text-muted-foreground">Feature</div>
              <div className="flex items-center justify-center gap-2 border-l border-border/60 p-4 text-primary">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
                  E
                </span>
                EdgeOwn
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
                className={`grid grid-cols-3 text-sm ${
                  i % 2 === 1 ? 'bg-secondary/10' : ''
                }`}
              >
                <div className="p-4 text-muted-foreground">{row.label}</div>
                <div className="flex items-center justify-center border-l border-border/60 p-4">
                  <Cell value={row.edgeown} />
                </div>
                <div className="flex items-center justify-center border-l border-border/60 p-4">
                  <Cell value={row.vercel} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Cost figures are illustrative estimates for a single Next.js app with
          moderate traffic. Actual AWS spend varies by region and usage.
        </p>
      </div>
    </section>
  );
}
