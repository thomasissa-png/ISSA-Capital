/**
 * POST /api/draft — génération d'un CR via Anthropic + persistance SQLite.
 *
 * Flow :
 *  1. Valide le body via GenerateCRInputSchema (Zod) — 400 si invalide
 *  2. Appelle `generateCR()` depuis le service anthropic — 502 si LLM KO
 *  3. Persiste le résultat dans cr_drafts (status "needs_clarification" | "ready")
 *  4. Retourne { draftId, status, clarificationQuestion?, cr?, usage }
 *
 * Auth : Phase 3 ne gère pas l'auth — `userPhone` est hardcodé à "thomas"
 * si absent du body. L'auth WhatsApp arrivera en Phase 2 (webhook signé).
 *
 * Rate limit : mounté en amont dans `src/server/index.ts` via draftRateLimit
 * (20 req / 15 min / IP).
 */

import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';

import { getDb } from '../db/connection';
import { AppError } from '../middleware/errorHandler';
import { generateCR } from '../services/anthropic';
import {
  AnthropicParseError,
  AnthropicSchemaError,
  AnthropicTimeoutError,
  GenerateCRInputSchema,
} from '../services/anthropic.types';
import { getLogger } from '../utils/logger';

export const draftRouter = Router();

/**
 * Insère un nouveau draft en DB et retourne son id.
 * Le payload JSON du CR est stocké tel quel dans `cr_json` (TEXT).
 */
function insertDraft(params: {
  userPhone: string;
  rawInput: string;
  status: 'needs_clarification' | 'ready';
  crJson: string | null;
  typeReunion: string | null;
  entite: string | null;
  dateReunion: string | null;
  clarificationQuestion: string | null;
}): string {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const conversationId = randomUUID();

  const clarificationHistory =
    params.clarificationQuestion !== null
      ? JSON.stringify([
          {
            q: params.clarificationQuestion,
            a: null,
            ts: now,
          },
        ])
      : null;

  db.prepare(
    `INSERT INTO cr_drafts (
      id, user_phone, conversation_id, raw_input, enriched_input,
      status, clarification_history, cr_json, cr_markdown,
      type_reunion, entite, date_reunion,
      created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.userPhone,
    conversationId,
    params.rawInput,
    null,
    params.status,
    clarificationHistory,
    params.crJson,
    null, // cr_markdown généré en Phase 4 (cr-renderer.ts)
    params.typeReunion,
    params.entite,
    params.dateReunion,
    now,
    now,
    null,
  );

  return id;
}

draftRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const log = getLogger();

    // --- 1. Validation input ---
    const parsed = GenerateCRInputSchema.safeParse(req.body);
    if (!parsed.success) {
      // Laisse errorHandler formater le ZodError en 400
      next(parsed.error);
      return;
    }
    const input = parsed.data;

    // --- 2. Appel service Anthropic ---
    try {
      const { response, usage } = await generateCR(input);

      // --- 3. Persistance ---
      const draftId = insertDraft({
        userPhone: input.userPhone,
        rawInput: input.rawInput,
        status: response.status,
        crJson: response.cr ? JSON.stringify(response.cr) : null,
        typeReunion: response.cr?.type_reunion ?? response.detected_type ?? null,
        entite: response.cr?.entite ?? response.detected_entite ?? null,
        dateReunion: response.cr?.date_reunion ?? null,
        clarificationQuestion: response.clarification_question,
      });

      log.info(
        { draftId, status: response.status, inputTokens: usage.inputTokens },
        '[draft] CR draft persisté',
      );

      // --- 4. Réponse ---
      res.status(200).json({
        draftId,
        status: response.status,
        clarificationQuestion: response.clarification_question,
        detectedEntite: response.detected_entite,
        detectedType: response.detected_type,
        cr: response.cr,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadInputTokens: usage.cacheReadInputTokens,
          cacheCreationInputTokens: usage.cacheCreationInputTokens,
          latencyMs: usage.latencyMs,
          model: usage.model,
        },
      });
    } catch (err) {
      // Erreurs typées du service Anthropic → 502 (LLM upstream KO)
      if (err instanceof AnthropicTimeoutError) {
        next(
          new AppError(504, 'LLM_TIMEOUT', 'Génération du CR interrompue (timeout 60s)'),
        );
        return;
      }
      if (err instanceof AnthropicParseError) {
        next(
          new AppError(
            502,
            'LLM_PARSE_ERROR',
            'Réponse Claude non parseable en JSON',
            { rawContentPreview: err.rawContent.slice(0, 200) },
          ),
        );
        return;
      }
      if (err instanceof AnthropicSchemaError) {
        next(
          new AppError(
            502,
            'LLM_SCHEMA_ERROR',
            'Réponse Claude non conforme au schéma attendu',
            { issues: err.issues as Record<string, unknown> },
          ),
        );
        return;
      }

      // Toute autre erreur → propage à errorHandler (500)
      next(err);
    }
  },
);
