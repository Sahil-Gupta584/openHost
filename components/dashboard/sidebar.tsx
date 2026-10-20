'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Cloud,
  LayoutGrid,
  Settings,
  Activity,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Projects', href: '/dashboard', icon: LayoutGrid },
  { label: 'Usage', href: '/dashboard/usage', icon: Activity },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/30 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cloud className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">OpenHost</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Account
        </p>
        {navItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
            >
              {active && (
                <span className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to site
        </Link>

        <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
            KV
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Kalash Vasaniya</p>
            <p className="truncate text-xs text-muted-foreground">Indie plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
