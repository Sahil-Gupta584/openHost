import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';

/**
 * Tells the client whether there is a valid session (validated against
 * Supabase, not just cookie shape). Kept as a thin endpoint so nothing about
 * the Supabase setup leaks to the browser.
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return NextResponse.json({
    user: data.user
      ? {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name ?? null,
        }
      : null,
  });
}
