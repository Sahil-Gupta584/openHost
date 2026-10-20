import { GetCostAndUsageCommand, CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { resolveCredentials } from '@/lib/aws/config';
import { getDb } from '@/lib/supabase/db';
import { handle } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/usage — real AWS numbers for the Usage page:
 *  - Actual spend, per service, from AWS Cost Explorer (best effort)
 *  - Build-pipeline usage tracked in the deployments table
 */

const REPORT_DAYS = 14;
/** Approximate upstream list prices (may differ from the invoice slightly). */
const LAMBDA_GB_S = 0.0000166667;

export async function GET() {
  return handle(async () => {
    const creds = await resolveCredentials({ region: 'us-east-1' });

    // AWS-side actuals (may fail on brand-new accounts before the day-one
    // cost roll-up — the UI handles availability gracefully).
    let spend: { available: boolean; total: number; currency: string; services: Array<{ name: string; amount: number }>; days: Array<{ date: string; amount: number }> } = {
      available: false,
      total: 0,
      currency: 'USD',
      services: [],
      days: [],
    };
    try {
      const ce = new CostExplorerClient({ region: 'us-east-1', credentials: creds });
      const end = new Date(); // CE endDate is exclusive
      const start = new Date(end.getTime() - REPORT_DAYS * 24 * 3600 * 1000);
      const res = await ce.send(
        new GetCostAndUsageCommand({
          TimePeriod: {
            Start: start.toISOString().slice(0, 10),
            End: end.toISOString().slice(0, 10),
          },
          Granularity: 'DAILY',
          Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        })
      );

      const perService = new Map<string, number>();
      const perDay = new Map<string, number>();
      for (const day of res.ResultsByTime ?? []) {
        const d = day.TimePeriod?.Start ?? '';
        for (const group of day.Groups ?? []) {
          const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
          const service = group.Keys?.[0] ?? 'Other';
          if (amount <= 0) continue;
          perService.set(service, (perService.get(service) ?? 0) + amount);
          perDay.set(d, (perDay.get(d) ?? 0) + amount);
        }
      }
      const rounding = (n: number) => Math.round(n * 10_000) / 10_000;
      spend = {
        available: true,
        total: rounding(Array.from(perService.values()).reduce((a: number, b: number) => a + b, 0)),
        currency: 'USD',
        services: Array.from(perService.entries())
          .map(([name, amount]) => ({ name, amount: rounding(amount) }))
          .sort((a, b) => b.amount - a.amount),
        days: Array.from(perDay.entries())
          .map(([date, amount]) => ({ date, amount: rounding(amount) }))
          .sort((a, b) => a.date.localeCompare(b.date)),
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
    const estimatedBuildCost = (buildGbSeconds * LAMBDA_GB_S);

    return {
      spend,
      builds: {
        total: rows.length,
        succeeded: rows.filter((d) => d.status === 'ready').length,
        failed: rows.filter((d) => d.status === 'error').length,
        totalBuildSeconds: Math.round(totalBuildMs / 1000),
        estimatedBuildCost: Math.round(estimatedBuildCost * 10_000) / 10_000,
      },
      reportDays: REPORT_DAYS,
    };
  });
}
