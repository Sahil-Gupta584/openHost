'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Cloud,
  Database,
  Gauge,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Usage page — what your AWS account is actually spending and doing through
 * OpenHost. Actuals come from AWS Cost Explore (when the account's cost
 * roll-up is available) plus build-channel numbers tracked per deployment.
 */

interface UsageData {
  spend: {
    available: boolean;
    total: number;
    currency: string;
    services: Array<{ name: string; amount: number }>;
    days: Array<{ date: string; amount: number }>;
  };
  builds: {
    total: number;
    succeeded: number;
    failed: number;
    totalBuildSeconds: number;
    estimatedBuildCost: number;
  };
  reportDays: number;
}

type UnavailableReason = 'loading' | 'error' | null;

function serviceName(name: string) {
  return name.replace(/^(AWS )?(Amazon )?/, '').trim() || 'Other';
}

const SERVICE_COLORS = [
  'bg-primary',
  'bg-accent',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-pink-500/80',
  'bg-sky-500/80',
  'bg-violet-500/80',
];

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<UnavailableReason>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/usage', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Request failed');
      setData(body.data as UsageData);
      setError(null);
    } catch {
      setError('error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Real spend and activity in your AWS account {data ? `· last ${data.reportDays} days` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={refreshing} onClick={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}>
          {refreshing || !data ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error === 'error' && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            Could not load usage — AWS Cost Explorer or the database is unreachable. Try Refresh.
          </CardContent>
        </Card>
      )}

      {!data && error === null && (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading usage…
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5" /> Actual AWS spend · {data.reportDays}d
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {data.spend.available
                    ? `$${data.spend.total.toFixed(2)}`
                    : 'pending'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {data.spend.available
                    ? `From AWS Cost Explorer · ${data.spend.currency}`
                    : 'Cost Explorer has no data yet on brand-new accounts (day-one roll-up). Estimates below cover what OpenHost runs.'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Builds run in your account
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">{data.builds.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {data.builds.succeeded} succeeded · {data.builds.failed} failed
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Build compute used
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {data.builds.totalBuildSeconds.toLocaleString()}s
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  est. build cost ≈ ${data.builds.estimatedBuildCost.toFixed(2)} (Lambda GB-s)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-muted-foreground" /> Spend by AWS service
              </CardTitle>
              <CardDescription>
                Unblended cost, grouped by service, from your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.spend.available && data.spend.services.length > 0 ? (
                <div className="space-y-3">
                  {data.spend.services.slice(0, 8).map((s, i) => {
                    const max = data.spend.services[0].amount || 1;
                    return (
                      <div key={s.name} className="space-y-1">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-medium">{serviceName(s.name)}</span>
                          <span className="tabular-nums text-muted-foreground">
                            ${s.amount.toFixed(4)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
                          <div
                            className={`h-full rounded-full ${SERVICE_COLORS[i % SERVICE_COLORS.length]}`}
                            style={{ width: `${Math.max(2, (s.amount / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="pt-2 text-xs text-muted-foreground">
                    Live numbers come straight from AWS — OpenHost bills you nothing on top.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
                  AWS Cost Explorer has not published spend data yet (normal for
                  accounts inside their first ~24h). The build estimate above is
                  computed from real OpenHost build minutes.
              </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-muted-foreground" /> Where the money goes per deploy
              </CardTitle>
              <CardDescription>What each OpenHost stage actually bills in your account</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-secondary/30 p-3">
                <p className="flex items-center gap-1.5 font-medium"><Database className="h-3.5 w-3.5" /> Build (Lambda sandbox)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ~3 GB memory for ~2 min → about $0.005 per build, billed by AWS.
                </p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3">
                <p className="flex items-center gap-1.5 font-medium"><Server className="h-3.5 w-3.5" /> Hosting (SSR Lambda)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Billed per request + GB-s while your site renders — metered by AWS, shown in the bars above.
                </p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3">
                <p className="flex items-center gap-1.5 font-medium"><Cloud className="h-3.5 w-3.5" /> Storage (S3 assets)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Build artifacts + static assets at standard storage rates, billed by AWS.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Looking for plan/subscription billing? OpenHost currently runs in platform mode — everything is in{' '}
            <Link href="/dashboard" className="underline underline-offset-2 hover:text-foreground">your projects</Link> and{' '}
            <Link href="/dashboard/settings" className="underline underline-offset-2 hover:text-foreground">settings</Link>.
          </p>
        </>
      )}
    </div>
  );
}
