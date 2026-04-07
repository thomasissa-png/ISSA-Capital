import { z } from 'zod';

/**
 * Validation des variables d'environnement au runtime serveur.
 * Ne valide que les variables server-only ici. Les variables NEXT_PUBLIC_*
 * sont inlined par Next et validées indirectement via leur usage.
 *
 * Usage : import { serverEnv } from '@/lib/env' — uniquement dans du code serveur.
 */

const serverEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY requis').optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_TO_EMAIL: z.string().email().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] Variables serveur invalides :', parsed.error.flatten());
    throw new Error('Variables d environnement serveur invalides');
  }
  cached = parsed.data;
  return cached;
}
