import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';

/**
 * Starts the GitHub OAuth flow (Supabase Auth provider). We request repo +
 * admin:repo_hook scopes so the returned provider token can list the user's
 * repos, attach push webhooks, and clone private code — one grant, no PAT.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '/dashboard/settings/git';

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'repo admin:repo_hook read:user user:email',
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
  return NextResponse.redirect(data.url);
}
