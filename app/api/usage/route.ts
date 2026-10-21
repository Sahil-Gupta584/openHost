import { GetCostAndUsageCommand, CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { resolveCredentials } from '@/lib/aws/config';
import { getDb } from '@/lib/supabase/db';
import { handle } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/usage — real AWS numbers for the Usage page, AWS-Billing-style:
 *  - Month-to-date, last month, and prorated forecast spend
 *  - Cost by service table (per service for both periods)
 *  - Daily month-to-date totals + 6-month trend
 *  - Build-pipeline usage tracked in the deployments table
 */

/** Full trailing months included in the trend (current MTD is separate). */
const TREND_MONTHS = 6;
/** Approximate upstream list price (may differ from the invoice slightly). */
const LAMBDA_GB_S = 0.0000166667;

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function utcMonthStart(offsetMonths: number, from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offsetMonths, 1));
}

export async function GET() {
  return handle(async () => {
    const creds = await resolveCredentials({ region: 'us-east-1' });

    // AWS-side actuals (may fail on brand-new accounts before the day-one
    // cost roll-up — the UI handles availability gracefully).
    const emptySpend = {
      available: false,
      currency: 'USD',
      mtdTotal: 0,
      lastMonthTotal: 0,
      forecast: 0,
      monthLabel: '',
      lastMonthLabel: '',
      services: [] as Array<{ name: string; mtd: number; lastMonth: number }>,
      days: [] as Array<{ date: string; amount: number }>,
      months: [] as Array<{ month: string; amount: number }>,
    };
    let spend = emptySpend;

    try {
      const ce = new CostExplorerClient({ region: 'us-east-1', credentials: creds });

      // Today (UTC); CE End is exclusive → tomorrow includes today's partial cost.
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const endExclusive = new Date(today.getTime() + 86_400_000);
      // Window start: first day of the month (TREND_MONTHS - 1) months back.
      const windowStart = utcMonthStart(-(TREND_MONTHS - 1), today);

      const res = await ce.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: isoDate(windowStart), End: isoDate(endExclusive) },
          Granularity: 'DAILY',
          Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        })
      );

      const perDay = new Map<string, number>(); // date -> total
      const perServiceMonth = new Map<string, number>(); // `${month}|${service}` -> amount

      for (const day of res.ResultsByTime ?? []) {
        const d = day.TimePeriod?.Start ?? '';
        const month = d.slice(0, 7);
        for (const group of day.Groups ?? []) {
          const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
          if (amount <= 0) continue;
          const service = (group.Keys?.[0] ?? 'Other').trim() || 'Other';
          perDay.set(d, (perDay.get(d) ?? 0) + amount);
          perServiceMonth.set(
            `${month}|${service}`,
            (perServiceMonth.get(`${month}|${service}`) ?? 0) + amount
          );
        }
      }

      const currentMonth = isoDate(today).slice(0, 7);
      const lastMonthDate = utcMonthStart(-1, today);
      const lastMonth = isoDate(lastMonthDate).slice(0, 7);

      const monthLabel = (monthKey: string) => {
        const [y, m] = monthKey.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
      };

      // Month-to-date and last-month totals.
      let mtdTotal = 0;
      const days: Array<{ date: string; amount: number }> = [];
      perDay.forEach((amount, d) => {
        if (d.startsWith(currentMonth)) {
          mtdTotal += amount;
          days.push({ date: d, amount: round4(amount) });
        }
      });
      days.sort((a, b) => a.date.localeCompare(b.date));

      let lastMonthTotal = 0;
      perDay.forEach((amount, d) => {
        if (d.startsWith(lastMonth)) lastMonthTotal += amount;
      });

      // Simple prorated forecast: MTD ÷ days elapsed × days in month.
      const dayOfMonth = today.getUTCDate();
      const daysInMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
      ).getUTCDate();
      const forecast =
        dayOfMonth > 0 ? Math.max(0, (mtdTotal / dayOfMonth) * daysInMonth) : 0;

      // Per-service comparison for the table.
      const serviceNames = new Set<string>();
      perServiceMonth.forEach((_, key) => {
        const name = key.split('|')[1];
        if (name) serviceNames.add(name);
      });
      const services = Array.from(serviceNames)
        .map((name) => ({
          name,
          mtd: round4(perServiceMonth.get(`${currentMonth}|${name}`) ?? 0),
          lastMonth: round4(perServiceMonth.get(`${lastMonth}|${name}`) ?? 0),
        }))
        .filter((s) => s.mtd > 0 || s.lastMonth > 0)
        .sort((a, b) => b.mtd - a.mtd || b.lastMonth - a.lastMonth);

      // Monthly trend (ascending), current month is MTD.
      const monthTotals = new Map<string, number>();
      perDay.forEach((amount, d) => {
        const month = d.slice(0, 7);
        monthTotals.set(month, (monthTotals.get(month) ?? 0) + amount);
      });
      const months = Array.from(monthTotals.entries())
        .map(([month, amount]) => ({ month, amount: round4(amount) }))
        .sort((a, b) => a.month.localeCompare(b.month));

      spend = {
        available: true,
        currency: 'USD',
        mtdTotal: round4(mtdTotal),
        lastMonthTotal: round4(lastMonthTotal),
        forecast: round4(forecast),
        monthLabel: monthLabel(currentMonth),
        lastMonthLabel: monthLabel(lastMonth),
        services,
        days,
        months,
      };
    } catch {
      /* Cost Explorer unavailable on this account — local estimates still show */
    }

    // OpenHost build-channel usage from the deployments table.
    const db = getDb();
    const { data, error } = await db
      .from('deployments')
      .select('status, duration_ms, created_at');
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<{
      status: string;
      duration_ms: number | null;
      created_at: string;
    }>;
    const totalBuildMs = rows.reduce((sum, d) => sum + (d.duration_ms ?? 0), 0);
    // Builder ran at ~3008MB (≈2.9GB) for every build on this account.
    const buildGbSeconds = (totalBuildMs / 1000) * (3008 / 1024);
    const estimatedBuildCost = buildGbSeconds * LAMBDA_GB_S;

    return {
      spend,
      builds: {
        total: rows.length,
        succeeded: rows.filter((d) => d.status === 'ready').length,
        failed: rows.filter((d) => d.status === 'error').length,
        totalBuildSeconds: Math.round(totalBuildMs / 1000),
        estimatedBuildCost: round4(estimatedBuildCost),
      },
      trendMonths: TREND_MONTHS,
    };
  });
}
