'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cloud, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard/settings', label: 'AWS creds', icon: Cloud },
  { href: '/dashboard/settings/git', label: 'Git', icon: GitBranch },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 border-l border-border/60 pl-2.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-secondary/60 text-foreground'
                : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
            )}
          >
            {active && (
              <span className="absolute -left-[9px] h-4 w-0.5 rounded-full bg-primary" />
            )}
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
