/**
 * Validation des variables d'environnement au démarrage.
 *
 * Règle : tout accès à `process.env.*` dans le reste du code est INTERDIT.
 * Importer `env` depuis ce fichier.
 *
 * Phase 1 : seules les variables fondation (Anthropic, Craft, DB, serveur)
 * sont requises. Les variables WhatsApp sont optionnelles en Phase 1 et
 * deviendront obligatoires en Phase 2 via un schéma étendu.
 *
 * Fail fast : si une variable requise manque ou est invalide, le process
 * termine avec un message clair listant tous les champs en erreur.
 */

import { z } from 'zod';

// --- Schéma Phase 1 ---
// Les clés sensibles sont validées en format (starts-with) sans jamais être logguées.
const envSchema = z.object({
  // Environnement d'exécution
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive().max(65535)),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Anthropic API
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, 'ANTHROPIC_API_KEY manquante')
    .refine((v) => v.startsWith('sk-ant-'), {
      message: 'ANTHROPIC_API_KEY doit commencer par "sk-ant-"',
    }),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MAX_TOKENS: z
    .string()
    .default('2000')
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // Craft API (workspace ISSA Capital)
  CRAFT_IC_BASE_URL: z.string().url('CRAFT_IC_BASE_URL doit être une URL valide'),
  CRAFT_IC_KEY: z
    .string()
    .min(1, 'CRAFT_IC_KEY manquante')
    .refine((v) => v.startsWith('pdk_'), {
      message: 'CRAFT_IC_KEY doit commencer par "pdk_"',
    }),

  // Base de données SQLite
  DB_PATH: z.string().min(1, 'DB_PATH manquante'),
  DB_ENCRYPTION_KEY: z.string().optional(), // Réservé SQLCipher (Phase 6)

  // Sessions (Phase 2+)
  SESSION_TTL_HOURS: z
    .string()
    .default('24')
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),

  // --- WhatsApp Cloud API (OPTIONNEL en Phase 1, REQUIS en Phase 2) ---
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_WHITELIST_E164: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse et valide process.env.
 * En cas d'erreur, termine le process avec code 1 et un message clair.
 * Les valeurs des secrets ne sont jamais affichées dans les messages d'erreur.
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Sortie directe sur stderr : le logger pino n'est pas encore initialisé
    // (loadEnv est appelé AVANT getLogger()).
    process.stderr.write(
      `[env] Validation des variables d'environnement échouée :\n${errors}\n` +
        `\nVérifier le fichier .env.local (ou Replit Secrets en production).\n` +
        `Voir .env.example pour la liste des variables attendues.\n`,
    );
    process.exit(1);
  }

  return parsed.data;
}

/**
 * Singleton lazy : env est chargé une seule fois au premier appel.
 * En test, on peut reset via resetEnvForTests().
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv === null) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}

/**
 * Reset le cache. Utile uniquement en test.
 * NE PAS utiliser en production.
 */
export function resetEnvForTests(): void {
  cachedEnv = null;
}
