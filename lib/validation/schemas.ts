import { z } from 'zod';
import { parseRepoInput, slugifyProjectName } from '../utils/repo';

/**
 * Request validation schemas. Route handlers parse input with these before
 * touching services — anything unvalidated never reaches AWS or Supabase.
 */

const namePattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

/** Forgive pasted GitHub URLs ("https://github.com/o/r" → "o/r"). */
const repoSchema = z.preprocess(
  (v) => (typeof v === 'string' ? parseRepoInput(v)?.repo ?? v : v),
  z
    .string()
    .min(3)
    .regex(/^[\w.-]+\/[\w.-]+$/, 'repo must look like "owner/name" or a GitHub URL')
);

/** Derive a valid project name from whatever was typed. */
const projectNameSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? slugifyProjectName(v) : undefined),
  z.string().min(3).max(60).regex(namePattern, 'lowercase letters, numbers and dashes only').optional()
);

export const createProjectSchema = z.object({
  repo: repoSchema,
  name: projectNameSchema,
  branch: z.string().min(1).default('main'),
  region: z.string().min(3).default('us-east-1'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: projectNameSchema,
  branch: z.string().min(1).optional(),
  region: z.string().min(3).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addEnvVarSchema = z.object({
  key: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'letters, numbers and underscores, not starting with a digit'),
  value: z.string().min(1),
  isSecret: z.boolean().default(false),
});

export type AddEnvVarInput = z.infer<typeof addEnvVarSchema>;

export const addDomainSchema = z.object({
  domain: z
    .string()
    .toLowerCase()
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
      'must be a valid domain like app.example.com'
    ),
});

export const uuidSchema = z.string().uuid();

/** Parse + throw ApiError(400) with a readable message on failure. */
export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const { ApiError } = await import('../api/http');
    throw new ApiError(
      result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
      400
    );
  }
  return result.data;
}
