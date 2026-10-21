'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OpenHostMark } from '@/components/logo';

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const authError = searchParams.get('error') === 'auth';

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(
    authError ? 'Sign-in failed or the link expired. Please try again.' : null
  );
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Already signed in? Go straight to the destination page.
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then(({ user }) => {
        if (user) router.replace(next);
      })
      .catch(() => {
        // Session check is best-effort — stay on the login page.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGoogle() {
    setGoogleLoading(true);
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError(null);
    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error ?? 'Something went wrong. Try again.');
      } else {
        setEmailSent(true);
      }
    } catch {
      setEmailError('Something went wrong. Try again.');
    } finally {
      setEmailLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-2xl">
          ✉️
        </div>
        <p className="text-[15px] font-semibold">Check your inbox</p>
        <p className="max-w-[280px] text-[13px] leading-[1.6] text-muted-foreground">
          We sent a magic link to{' '}
          <span className="font-semibold text-foreground">{email}</span>. Click it
          to sign in. The link expires shortly and can only be used once.
        </p>
        <button
          onClick={() => setEmailSent(false)}
          className="mt-2 text-[12.5px] font-medium text-primary hover:text-primary/80"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Google */}
      <Button
        variant="outline"
        size="lg"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full justify-center gap-3"
      >
        {googleLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
        )}
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </Button>

      <div className="my-1 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11.5px] font-medium text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email magic link */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          placeholder="you@yourproduct.com"
          autoComplete="email"
          autoFocus
          className={`h-11 w-full rounded-xl border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary ${
            emailError ? 'border-destructive' : 'border-input'
          }`}
        />
        {emailError && (
          <p className="pl-1 text-[12px] font-medium text-destructive">{emailError}</p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={emailLoading}
          className="w-full justify-center"
        >
          {emailLoading ? 'Sending link…' : 'Continue with email'}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed -top-24 left-1/2 h-[320px] w-[560px] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
      <div className="pointer-events-none fixed -bottom-16 -right-16 h-[260px] w-[320px] rounded-full bg-ember/10 blur-[90px]" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2">
            <OpenHostMark size={32} />
            <span className="text-[16px] font-semibold tracking-tight">OpenHost</span>
          </Link>
        </div>

        {/* Auth card */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <div className="px-7 py-7">
            <h1 className="mb-1 font-display text-[26px] font-normal tracking-[-0.02em]">
              Welcome back
            </h1>
            <p className="mb-6 text-[13.5px] text-muted-foreground">
              Sign in to your OpenHost account.
            </p>
            <Suspense fallback={null}>
              <LoginCard />
            </Suspense>
          </div>

          <div className="border-t border-border/60 bg-secondary/20 px-7 py-4">
            <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
              By continuing you agree to our{' '}
              <a href="#" className="underline-offset-2 hover:underline">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="underline-offset-2 hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          No account?{' '}
          <Link
            href="/"
            className="font-medium text-primary hover:text-primary/80"
          >
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
