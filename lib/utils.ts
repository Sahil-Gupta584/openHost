import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human "2 minutes ago" style relative time, used across the dashboard. */
export function timeAgo(iso: string | null): string {
  if (!iso) return 'never deployed';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 1)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "94s" style build duration from milliseconds. */
export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  return `${Math.round(ms / 1000)}s`;
}
