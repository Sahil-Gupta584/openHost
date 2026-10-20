/**
 * Normalization helpers for user-pasted repo references and project names.
 * Pure functions — safe to import from client components and zod schemas.
 */

export interface ParsedRepo {
  /** Canonical "owner/name" form. */
  repo: string;
  owner: string;
  name: string;
}

/**
 * Accept the many shapes people paste:
 *
 *   https://github.com/owner/repo
 *   http://www.github.com/owner/repo/
 *   git@github.com:owner/repo.git
 *   owner/repo.git
 *   owner/repo
 *
 * Returns null when no owner/name can be extracted — callers show a hint.
 */
export function parseRepoInput(raw: string): ParsedRepo | null {
  let s = raw.trim();
  if (!s) return null;

  s = s
    .replace(/^git\+/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^ssh:\/\//i, '')
    .replace(/^www\./i, '');

  if (/^github\.com\//i.test(s)) s = s.slice('github.com/'.length);
  s = s.replace(/\.git$/i, '').replace(/\/+$/, '');

  const segments = s.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const [owner, name] = segments;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
  return { repo: `${owner}/${name}`, owner, name };
}

/**
 * "Next-js-Boilerplate" → "next-js-boilerplate" — a valid project name
 * (lowercase letters, numbers and dashes only) derived from anything typed.
 */
export function slugifyProjectName(raw: string, fallback = 'my-project'): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/\.git$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
