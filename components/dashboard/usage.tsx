'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Cloud,
  Database,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Usage page — AWS-Billing-style view of what your AWS account is actually
 * spending and doing through OpenHost: a To-Date/Last-month/Forecast summary,
 * a "Cost by service" table, daily MTD spend, a monthly trend, plus
 * build-channel numbers tracked per deployment.
 */

interface UsageData {
  spend: {
    available: boolean;
    currency: string;
    mtdTotal: number;
    lastMonthTotal: number;
    forecast: number;
    monthLabel: string;
    lastMonthLabel: string;
    services: Array<{ name: string; mtd: number; lastMonth: number }>;
    days: Array<{ date: string; amount: number }>;
    months: Array<{ month: string; amount: number }>;
  };
  builds: {
    total: number;
    succeeded: number;
    failed: number;
    totalBuildSeconds: number;
    estimatedBuildCost: number;
  };
  trendMonths: number;
}

type UnavailableReason = 'loading' | 'error' | null;

/** AWS billing shows 2 decimals; small amounts get 4 so they don't read as $0.00. */
function money(n: number) {
  return `$${(n >= 1 ? n.toFixed(2) : n.toFixed(4))}`;
}

/** "AWS Lambda" → "Lambda", "Amazon S3 Service" → "S3". */
function serviceName(name: string) {
  return name.replace(/^(AWS )?(Amazon )?/, '').replace(/ Service$/, '').trim() || 'Other';
}

const SERVICE_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-muted-foreground/60',
  'bg-muted-foreground/40',
  'bg-muted-foreground/30',
];

function shortDay(date: string) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

function monthShort(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Simple CSS bar chart shared by the daily and monthly views. */
function SpendChart({
  data,
  color,
  formatAmount,
  emptyLabel,
}: {
  data: Array<{ label: string; amount: number; title?: string }>;
  color: string;
  formatAmount: (n: number) => string;
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.amount)) || 1;
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="group relative flex h-full flex-1 items-end"
            title={d.title ?? `${d.label}: ${formatAmount(d.amount)}`}
          >
            <div
              className={`w-full rounded-t-sm ${color} transition-opacity group-hover:opacity-80`}
              style={{ height: `${Math.max(d.amount > 0 ? 3 : 1, (d.amount / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

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
            Real spend and activity in your AWS account
            {data?.spend.available ? ` · ${data.spend.monthLabel} (month-to-date)` : ''}
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
          {/* ===== Spend summary — AWS-billing style to-date header ===== */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Month-to-date
                  {data.spend.available ? ` · ${data.spend.monthLabel}` : ''}
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {data.spend.available ? money(data.spend.mtdTotal) : 'pending'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {data.spend.available
                    ? `${data.spend.currency} · from AWS Cost Explorer`
                    : 'Cost Explorer has no data yet on brand-new accounts (day-one roll-up). Estimates below cover what OpenHost runs.'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Last month
                  {data.spend.available ? ` · ${data.spend.lastMonthLabel}` : ''}
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {data.spend.available ? money(data.spend.lastMonthTotal) : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Unblended cost, full calendar month</p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Forecast for {data.spend.available ? data.spend.monthLabel : 'this month'}
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {data.spend.available ? money(data.spend.forecast) : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Prorated estimate — month-to-date ÷ days so far × days in month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ===== Cost by service — AWS-style table ===== */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4 text-muted-foreground" /> Cost by service
              </CardTitle>
              <CardDescription>Unblended cost, grouped by service, from your AWS account</CardDescription>
            </CardHeader>
            <CardContent>
              {data.spend.available && data.spend.services.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-secondary/30 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Service</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {data.spend.lastMonthLabel} <span className="font-normal">(last month)</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {data.spend.monthLabel} <span className="font-normal">(MTD)</span>
                        </th>
                        <th className="hidden px-4 py-2.5 font-medium md:table-cell md:w-48">% of MTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.spend.services.map((s, i) => {
                        const share = data.spend.mtdTotal > 0 ? (s.mtd / data.spend.mtdTotal) * 100 : 0;
                        return (
                          <tr key={s.name} className="border-b border-border/40 last:border-0">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${SERVICE_COLORS[i % SERVICE_COLORS.length]}`} />
                                {serviceName(s.name)}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {money(s.lastMonth)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(s.mtd)}</td>
                            <td className="hidden px-4 py-2.5 md:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                                  <div
                                    className={`h-full rounded-full ${SERVICE_COLORS[i % SERVICE_COLORS.length]}`}
                                    style={{ width: `${Math.max(share > 0 ? 2 : 0, share)}%` }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {share >= 0.1 ? `${share.toFixed(1)}%` : '—'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-secondary/20 font-medium">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(data.spend.lastMonthTotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(data.spend.mtdTotal)}</td>
                        <td className="hidden px-4 py-2.5 md:table-cell" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
                  AWS Cost Explorer has not published spend data yet (normal for
                  accounts inside their first ~24h). The build estimate below is
                  computed from real OpenHost build minutes.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Charts ===== */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="border-border/60 lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Daily spend · month-to-date
                </CardTitle>
                <CardDescription>{data.spend.available ? data.spend.monthLabel : ''}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.spend.available ? (
                  <SpendChart
                    data={data.spend.days.map((d) => ({
                      label: shortDay(d.date),
                      amount: d.amount,
                      title: `${shortDay(d.date)}: ${money(d.amount)}`,
                    }))}
                    color="bg-primary"
                    formatAmount={money}
                    emptyLabel="No daily roll-ups published yet."
                  />
                ) : (
                  <SpendChart data={[]} color="bg-primary" formatAmount={money} emptyLabel="Cost Explorer unavailable." />
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" /> Monthly trend
                </CardTitle>
                <CardDescription>Last {data.trendMonths} months incl. current MTD</CardDescription>
              </CardHeader>
              <CardContent>
                <SpendChart
                  data={data.spend.available ? data.spend.months.map((m) => ({ label: monthShort(m.month), amount: m.amount })) : []}
                  color="bg-chart-4"
                  formatAmount={money}
                  emptyLabel="Cost Explorer unavailable."
                />
              </CardContent>
            </Card>
          </div>

          {/* ===== Builds ===== */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5" /> Builds run in your account
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
                  Billed per request + GB-s while your site renders — metered by AWS, shown in the table above.
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
