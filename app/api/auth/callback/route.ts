import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/auth-server';
import { saveGithubToken } from '@/lib/services/github';

/**
 * Auth callback for both flows:
 *  - OAuth (Google / GitHub) redirect
 *  - email magic link / confirmation links (PKCE code exchange)
 *
 * When the flow came from GitHub, Supabase hands back the provider access
 * token (repo + admin:repo_hook). Store it so deploys, repo listing and
 * webhook attachment run as the connected user — no pasted PAT needed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // `next` is let through unchanged (it is a local path only).
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.session?.user.app_metadata.provider === 'github' && data.session.provider_token) {
        // Non-fatal: without storage the session still works as a login.
        try {
          await saveGithubToken(data.session.provider_token);
        } catch {}
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
