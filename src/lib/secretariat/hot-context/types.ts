/**
 * Types — module hot-context-updater (Anya S19 Phase B).
 *
 * Source de vérité : `docs/hot-context-spec.md`.
 *
 * Maintient le briefing `00. Me/hot-context.md` (4 sections : bouge / attends /
 * arbitrage / Maintenance) via détection LLM Haiku 4.5 sur 4 sources de signaux
 * (emails ingérés, CR vault, Telegram explicite, notes vault récentes).
 *
 * R5 (P0 #99) : édition Drive = PATCH in-place (jamais create+delete).
 * R3 (P1 #96) : TTL pending ≥ 7 jours.
 * R7 (P1 #101) : pas de hardcoded — fileId résolus live via vault-reader.
 */

// ============================================================
// Patches — types canoniques
// ============================================================

/** Section cible du fichier `hot-context.md`. */
export type PatchSection = 'bouge' | 'attends' | 'arbitrage';

/** Action sur la section : ajout ou retrait d'une ligne. */
export type PatchAction = 'add' | 'remove';

/** Source du signal détecté. */
export type SignalSource = 'email' | 'cr' | 'telegram' | 'vault-note';

/** Payload « Je bouge sur (cette semaine) » — liste à puces. */
export interface BougePayload {
  /** Texte télégraphique ≤ 80 chars, DOIT inclure un wikilink `[[...]]`. */
  text: string;
}

/** Payload « J'attends » — tableau Quoi / De qui / Depuis / Note. */
export interface AttendsPayload {
  /** Quoi : objet de l'attente (ex. « Signature acte »). */
  quoi: string;
  /** De qui : personne ou entité (ex. « Maître X »). */
  deQui: string;
  /** Depuis : date ISO (YYYY-MM-DD) ou label court. */
  depuis: string;
  /** Note optionnelle (≤ 80 chars). */
  note?: string;
}

/** Payload « Décisions en arbitrage » — sujet + contexte. */
export interface ArbitragePayload {
  /** Sujet : description courte (ex. « Choix fournisseur A/B »). */
  sujet: string;
  /** Contexte : ≤ 120 chars. */
  contexte: string;
}

/** Union des payloads selon la section. */
export type PatchPayload = BougePayload | AttendsPayload | ArbitragePayload;

/** Patch typé prêt pour validation Telegram + applier. */
export interface Patch {
  /** patchId = sha1(signalId + ':' + section + ':' + action). */
  patchId: string;
  /** signalId = sha1(source + ':' + sourceId + ':' + section + ':' + action + ':' + canonical(payload)). */
  signalId: string;
  /** Section cible. */
  section: PatchSection;
  /** Action sur la section. */
  action: PatchAction;
  /** Payload typé selon section. */
  payload: PatchPayload;
  /** Source du signal. */
  source: SignalSource;
  /** Identifiant de la source (emailId, filePath, telegramMsgId stringifié). */
  sourceId: string;
  /** Timestamp ISO de proposition Haiku. */
  proposedAt: string;
  /** Rationale 1 ligne — pourquoi Anya propose. */
  rationale: string;
}

// ============================================================
// Signaux bruts (input scanner → Haiku)
// ============================================================

/** Signal brut à analyser par Haiku 4.5. */
export interface Signal {
  /** Source du signal. */
  source: SignalSource;
  /** Identifiant source (emailId, filePath relatif, telegramMsgId stringifié). */
  sourceId: string;
  /** Extrait textuel (≤ 2000 chars). */
  contentExcerpt: string;
  /** Métadonnées contextuelles (date, expéditeur, titre). */
  contextMeta: Record<string, string | number | undefined>;
}

/** Sortie attendue de `detectSignal`. */
export interface DetectSignalResult {
  /** Patch proposé ou null si le signal n'est pas pertinent. */
  patch: Patch | null;
  /** Confiance Haiku 0.0–1.0. */
  confidence: number;
  /** Si patch null, raison textuelle (debug + audit). */
  reasonIfNull: string;
}

// ============================================================
// State store — hot-context-state.json
// ============================================================

/** Résultat d'un signal traité (audit cross-run). */
export interface ProcessedSignal {
  signalId: string;
  /** Timestamp ISO. */
  processedAt: string;
  /** Issue : patché / skip / rejeté. */
  outcome: 'patched' | 'skipped' | 'rejected';
}

/**
 * Phase d'un pending hot-context (défaut 2 — loop Modifier).
 *  - `preview` : carte affichée avec boutons Valider/Modifier/Skip (défaut).
 *  - `awaiting_edit` : Thomas a cliqué Modifier → le prochain texte libre est
 *    capté comme instruction de reformulation du payload.
 */
export type HotContextPendingPhase = 'preview' | 'awaiting_edit';

/** Pending patch en attente de validation Thomas. */
export interface PendingPatchRecord {
  patchId: string;
  patch: Patch;
  /** Timestamp ISO (sert TTL R3). */
  proposedAt: string;
  /** message_id Telegram (pour edit ultérieur). */
  telegramMessageId?: number;
  /**
   * Phase du pending (défaut 2). Absent = `preview` (rétrocompat pendings legacy).
   */
  phase?: HotContextPendingPhase;
  /**
   * Nombre de reformulations déjà appliquées (défaut 2). Cap à
   * HOT_CONTEXT_MAX_MODIFY_ITERATIONS. Absent = 0.
   */
  modifyCount?: number;
}

/** State complet du module hot-context. */
export interface HotContextState {
  schemaVersion: 1;
  /** Idempotence cross-run (signalId → ProcessedSignal). */
  processedSignals: Record<string, ProcessedSignal>;
  /** Pendings actifs (patchId → record). */
  pendingPatches: Record<string, PendingPatchRecord>;
  /** Dernier scan par source (ISO timestamps). */
  lastScanAt: {
    email: string;
    cr: string;
    telegram: string;
    vaultNotes: string;
  };
  /** Estimation tokens du fichier après dernier patch (cap warn 500). */
  lastFileTokensEstimate: number;
}

/** State vide initial. */
export function emptyHotContextState(): HotContextState {
  return {
    schemaVersion: 1,
    processedSignals: {},
    pendingPatches: {},
    lastScanAt: { email: '', cr: '', telegram: '', vaultNotes: '' },
    lastFileTokensEstimate: 0,
  };
}

// ============================================================
// Parsing AST (parser.ts)
// ============================================================

/** AST 4 sections du fichier `hot-context.md`. */
export interface HotContextAst {
  /** Frontmatter brut (préservé tel quel, jamais touché). */
  frontmatter: string;
  /** Heading + lignes de la section « Je bouge sur (cette semaine) ». */
  bouge: SectionBlock;
  /** Heading + lignes de la section « J'attends » (tableau markdown). */
  attends: SectionBlock;
  /** Heading + lignes de la section « Décisions en arbitrage ». */
  arbitrage: SectionBlock;
  /**
   * Heading + lignes de la section « Maintenance » — RED LINE INTOUCHABLE.
   * applier DOIT préserver bit-à-bit.
   */
  maintenance: SectionBlock;
  /** Texte avant la première section connue (préservé). */
  preamble: string;
}

/** Bloc d'une section parsée. */
export interface SectionBlock {
  /** Heading complet (ex. « ## Je bouge sur (cette semaine) »). */
  heading: string;
  /** Lignes brutes du corps de section (sans heading), ordre préservé. */
  bodyLines: string[];
}
