/**
 * Types et schémas Zod pour le service Craft (Phase 4).
 *
 * Source de vérité :
 *  - `docs/BRIEF_CLAUDE_CODE_SECRETARIAT_ISSA.md` section "Craft API" (endpoint
 *    `POST /blocks` confirmé, auth Bearer, payload `{ markdown, position }`).
 *  - `docs/ia/secretariat-architecture.md` Section 8 (structure du document,
 *    convention de nommage, tag CONFIDENTIEL).
 *
 * Périmètre Phase 4 : publication uniquement. La lecture (liste documents
 * Craft pour la sidebar admin) arrive en Phase 5.
 *
 * Règle de sécurité : aucun type ne doit contenir la clé API Craft. La clé
 * est lue depuis `env.CRAFT_IC_KEY` par le service et n'est jamais propagée
 * dans les payloads typés.
 */

import { z } from 'zod';

// ============================================================
// CraftDocumentPayload — ce qu'on envoie à POST /blocks
// ============================================================

/**
 * Payload envoyé au endpoint `POST {CRAFT_IC_BASE_URL}/blocks`.
 *
 * Forme confirmée par le BRIEF session 7 :
 *   {
 *     "markdown": "[markdown complet du CR]",
 *     "position": { "position": "end" }
 *   }
 *
 * `markdown` contient tout le document : frontmatter CONFIDENTIEL,
 * header (référence + entité + participants), body (sections 1-4),
 * footer (horodatage + mention Art. 39-1 CGI).
 *
 * `title` et `metadata` sont des champs *internes* au mapper — ils ne
 * transitent PAS vers l'API Craft (le BRIEF ne les documente pas comme
 * champs acceptés). Ils servent uniquement à la traçabilité locale
 * (insertion `cr_published.craft_filename`, logs, audit DGFiP).
 */
export interface CraftDocumentPayload {
  /** Markdown complet prêt à publier sur Craft. */
  markdown: string;
  /** Position d'insertion dans le document parent Craft. "end" = append. */
  position: {
    position: 'end' | 'start';
  };
  /**
   * Titre humain généré par le mapper (convention nommage @moi).
   * NON envoyé à Craft — champ interne pour traçabilité locale.
   */
  internalTitle: string;
  /**
   * Metadata locale pour insertion en `cr_published`.
   * NON envoyée à Craft — champ interne.
   */
  internalMetadata: {
    draftId: string;
    reference: string;
    entite: string;
    typeReunion: string;
    dateReunion: string;
    userPhone: string;
    markdownSha256: string;
  };
}

// ============================================================
// CraftApiResponse — validation Zod de la réponse Craft
// ============================================================

/**
 * Réponse minimale attendue de `POST /blocks`.
 *
 * La doc Craft officielle n'étant pas publique en mars 2026, on accepte
 * plusieurs formes compatibles et on normalise dans le service. Champs
 * requis minimaux : un identifiant de bloc/document ET (optionnel) une URL.
 *
 * Le schéma est volontairement permissif (`.passthrough()`) pour ne pas
 * faire échouer un changement mineur côté Craft. Les champs vraiment
 * critiques sont extraits et validés explicitement dans le service.
 */
export const CraftApiResponseSchema = z
  .object({
    // Identifiant bloc/document. L'API peut répondre sous plusieurs noms ;
    // on accepte tous les variants et on normalise côté service.
    id: z.string().min(1).optional(),
    blockId: z.string().min(1).optional(),
    block_id: z.string().min(1).optional(),
    documentId: z.string().min(1).optional(),
    document_id: z.string().min(1).optional(),

    // URL de visualisation (optionnelle — certaines API Craft ne la retournent
    // pas et on doit la reconstruire à partir de CRAFT_IC_BASE_URL + id).
    url: z.string().url().optional(),
    permalink: z.string().url().optional(),
    webUrl: z.string().url().optional(),
  })
  .passthrough();

export type CraftApiResponse = z.infer<typeof CraftApiResponseSchema>;

// ============================================================
// CraftPublishResult — sortie du service publishToCraft
// ============================================================

export interface CraftPublishResult {
  success: boolean;
  /** Identifiant Craft du bloc/document créé (normalisé depuis la réponse). */
  craftDocId?: string;
  /** URL Craft (si fournie par l'API, sinon reconstruite best-effort). */
  craftUrl?: string;
  /** Message d'erreur si success=false (safe à remonter au client). */
  error?: string;
  /** HTTP status code si un appel a effectivement été fait. */
  httpStatus?: number;
  /** Durée totale de l'appel (incluant retries) en millisecondes. */
  durationMs: number;
  /** Nombre de tentatives effectuées (1 = pas de retry). */
  attempts: number;
}

// ============================================================
// Erreurs typées du service Craft
// ============================================================

export class CraftTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Appel Craft API interrompu après ${timeoutMs}ms`);
    this.name = 'CraftTimeoutError';
  }
}

export class CraftHttpError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
    public readonly bodyPreview: string,
  ) {
    super(message);
    this.name = 'CraftHttpError';
  }
}

export class CraftResponseError extends Error {
  constructor(
    message: string,
    public readonly rawBody: string,
  ) {
    super(message);
    this.name = 'CraftResponseError';
  }
}
