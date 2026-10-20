import { NextResponse } from 'next/server';

/**
 * Request/response plumbing for API routes:
 *  - `handle()` wraps a handler with a try/catch and serialises errors
 *  - handlers return plain data; success shape is { data }
 *  - thrown ApiError becomes { error } with its status code
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const notFound = (what: string) => new ApiError(`${what} not found`, 404);
export const badRequest = (message: string) => new ApiError(message, 400);
export const unauthorized = () => new ApiError('Unauthorized', 401);

export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    // Supabase uniqueness / FK violations surface as PostgREST errors here.
    console.error('[openhost API] unhandled route error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type Params = Record<string, string | undefined>;

export function param(params: Params, key: string, what = 'Parameter'): string {
  const value = params[key];
  if (!value) throw badRequest(`${what} "${key}" is required`);
  return value;
}
