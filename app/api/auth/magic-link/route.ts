import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';

/**
 * Sends the magic-link email server-side (PKCE verifier is stored in an
 * httpOnly cookie by createSupabaseServerClient).
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    next?: string;
  } | null;

  const email = body?.email?.trim().toLowerCase() ?? '';
  const next = body?.next ?? '/dashboard';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sent: true });
}
