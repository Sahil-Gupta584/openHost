import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Supabase Auth config — SERVER-ONLY.
 *
 * Unlike the data client in ./db.ts (service role), this uses the anon key so
 * the session is carried entirely by the sb-* httpOnly cookies. Neither key is
 * EVER exported to the browser: all auth flows run through Next API routes and
 * client components only talk to those routes. No NEXT_PUBLIC_* vars.
 */
export function getSupabaseAuthConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL||'';
  const anonKey = process.env.SUPABASE_ANON_KEY||'';

  if (!url || !anonKey) {
    // throw new Error(
    //   'Missing Supabase auth config. Set SUPABASE_URL and SUPABASE_ANON_KEY (not NEXT_PUBLIC_*) in .env.local.'
    // );
  }
  return { url, anonKey };
}

/**
 * Supabase client for server contexts (route handlers) that can read AND
 * write the auth session cookies.
 */
export function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseAuthConfig();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `cookies().set` throws when called from a Server Component render.
          // Safe to ignore here — middleware refreshes the session cookies.
        }
      },
    },
  });
}
