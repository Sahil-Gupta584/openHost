'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';

/**
 * Signed-in user footer for the dashboard sidebar — shows the real session
 * email and initials avatar, with a sign-out action. No Supabase key runs in
 * the browser; session state comes from the /api/auth/* routes.
 */
interface SessionUser {
  id: string;
  email?: string;
  name?: string | null;
}

export function DashboardUserBlock() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then(({ user }) => {
        setUser(user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-secondary/60" />
        <div className="flex-1">
          <div className="mb-1.5 h-3 w-24 animate-pulse rounded bg-secondary/60" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-secondary/60" />
        </div>
      </div>
    );
  }

  const email = user?.email ?? '';
  const label = user?.name || email || 'Signed in';
  const initials = (user?.name || email).slice(0, 2).toUpperCase() || '··';

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <LogOut className="h-3 w-3" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
