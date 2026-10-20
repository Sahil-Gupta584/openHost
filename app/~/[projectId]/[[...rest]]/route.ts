import { NextRequest, NextResponse } from 'next/server';
import { getLatestReadyOrigin } from '@/lib/supabase/queries/deployments';

/**
 * Serve deployed apps through OpenHost's own domain at /~/<projectId>:
 * a path-based reverse proxy into the project's live AWS origin (Lambda /
 * API Gateway / CloudFront). The HTML is rewritten so asset paths (/_next/…)
 * resolve back through the same prefix; other content streams untouched.
 */

export const dynamic = 'force-dynamic';

const INTERNAL = '/~/';

function escapeHtmlAttrPrefix(html: string, prefix: string) {
  // href="/en" → href="/~/id/en" (skip protocol-relative "//host" and "//~").
  let out = html.replace(/(href|src|action)=("|')\/(?!\/|~\/)/gi, `$1=$2${prefix}/`);
  // Inline flight payloads quote asset paths as \"/_next/…\" → prefix them.
  out = out.replaceAll('\\"/_next/', `${prefix === '' ? '/' : `\\"${prefix}`}/_next/`.replace('//', '/'));
  out = out.replace(/(?<!~\/[a-z0-9-]{1,64})\/_next\//g, `${prefix}/_next/`);
  return out;
}

async function proxy(req: NextRequest, params: { projectId: string; rest?: string[] }) {
  const origin = await getLatestReadyOrigin(params.projectId);
  if (!origin) {
    return NextResponse.json(
      { error: 'No live deployment for this project yet.' },
      { status: 404 }
    );
  }

  const target = new URL(origin);
  const path = (params.rest ?? []).map((p) => encodeURIComponent(p)).join('/');
  const incoming = req.nextUrl.pathname;
  const basePath = `${INTERNAL}${params.projectId}`;
  // Map /~/<id>/foo/bar → <origin>/foo/bar
  target.pathname =
    (path ? `/${path}` : '/') + (req.nextUrl.search ?? '');

  const upstream = new Request(target, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    // @ts-expect-error duplex is required for streaming bodies in undici
    duplex: 'half',
  });

  const res = await fetch(upstream);
  const contentType = res.headers.get('content-type') ?? '';

  if (!/text\/html/i.test(contentType)) {
    // Static assets / JSON / etc. — passthrough untouched.
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'content-type': contentType,
        ...(res.headers.get('cache-control')
          ? { 'cache-control': res.headers.get('cache-control')! }
          : {}),
      },
    });
  }

  // HTML: rewrite rooted asset/link paths into our prefix.
  let html = await res.text();
  html = escapeHtmlAttrPrefix(html, basePath);
  return new NextResponse(html, {
    status: res.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}

type Ctx = { params: Promise<{ projectId: string; rest?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params;
  return proxy(req, p);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params;
  return proxy(req, p);
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params;
  return proxy(req, p);
}
