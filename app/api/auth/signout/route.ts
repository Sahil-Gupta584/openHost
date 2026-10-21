import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';

/** Signs the user out server-side, clearing the sb-* session cookies. */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  return NextResponse.json(
    { ok: !error },
    { status: error ? 500 : 200 }
  );
}
