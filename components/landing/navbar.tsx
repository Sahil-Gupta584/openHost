'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Cloud, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Dashboard', href: '/dashboard' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cloud className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">EdgeOwn</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-1.5">
              Start deploying
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <button
          className="rounded-md p-2 text-muted-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden border-t border-border/60 bg-background md:hidden',
          open ? 'max-h-80' : 'max-h-0'
        )}
        style={{ transition: 'max-height 0.25s ease' }}
      >
        <div className="space-y-1 px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/10 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/dashboard" className="flex-1" onClick={() => setOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1" onClick={() => setOpen(false)}>
              <Button size="sm" className="w-full">
                Start deploying
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
