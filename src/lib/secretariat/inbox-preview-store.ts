/**
 * Store en mémoire pour les cartes preview "inbox-router" éditables (S20.A).
 *
 * Quand Thomas envoie un message texte/vocal court, le router inbox-message-router
 * extrait un draft `{ titre, date, heure, lieu, description }`, affiche une carte
 * preview avec 7 boutons (4 ✏️ + 2 actions + Annuler). Thomas peut taper un bouton
 * édition (ex: ✏️ Heure) → Anya passe en mode "awaitingField=heure" et attend la
 * prochaine ligne de texte pour patcher le draft puis re-render la carte.
 *
 * Ce module stocke le draft + l'état conversationnel (awaitingField) + le couple
 * (chatId, messageId) pour pouvoir éditer la carte in-place.
 *
 * TTL : 7 jours (R3 — usage humain, week-end, vacances).
 * Persistance : globalThis Map (re-créée par process, comme le cache du router).
 * Choix : pas de I/O Drive pour ne pas alourdir chaque tap bouton (vs pending-store).
 *
 * Clé : `inbox-preview:{pendingId}` où pendingId est un id court (8 chars).
 */

import type { ExtractedMessage } from './workflows/inbox-message-router';

// ============================================================
// Types
// ============================================================

export type AwaitingField = null | 'titre' | 'date' | 'heure' | 'lieu';

export interface InboxPreviewEntry {
  /** Identifiant court (8 chars hex) utilisé dans la clé du store et les callback_data. */
  pendingId: string;
  /** Draft extrait par l'IA, patché au fil des édits conversationnelles. */
  draft: ExtractedMessage;
  /** Champ en attente de saisie texte. null = aucun (carte affichée avec ses 7 boutons). */
  awaitingField: AwaitingField;
  /** chatId Telegram (vérifié à chaque callback). */
  chatId: number;
  /** message_id de la carte preview pour `editMessageText` in-place. */
  messageId: number;
  /** Date de création (timestamp ms). Sert au TTL et au tri "plus récent". */
  createdAt: number;
}

// ============================================================
// Constantes
// ============================================================

/** Préfixe clé du store. */
export const INBOX_PREVIEW_KEY_PREFIX = 'inbox-preview:';

/** TTL pending (R3 — 7 jours strict, jamais < 72h). */
export const INBOX_PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

// ============================================================
// Backing store — globalThis Map (survit aux re-évaluations Next.js)
// ============================================================

const STORE_KEY = '__issa_inbox_preview_store__' as const;

function getStore(): Map<string, InboxPreviewEntry> {
  if (!(STORE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[STORE_KEY] = new Map<
      string,
      InboxPreviewEntry
    >();
  }
  return (globalThis as Record<string, unknown>)[STORE_KEY] as Map<
    string,
    InboxPreviewEntry
  >;
}

function fullKey(pendingId: string): string {
  return `${INBOX_PREVIEW_KEY_PREFIX}${pendingId}`;
}

// ============================================================
// API publique
// ============================================================

/**
 * Génère un pendingId court (8 chars hex base36).
 * Suffisant pour 1 utilisateur (Thomas) avec quelques cartes simultanées.
 */
export function generatePendingId(): string {
  return (
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 6)
  );
}

/**
 * Purge interne — supprime les entrées dont createdAt > TTL.
 * Appelée best-effort à chaque écriture.
 */
function purgeExpired(): void {
  const store = getStore();
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > INBOX_PREVIEW_TTL_MS) {
      store.delete(key);
    }
  }
}

/** Insère ou remplace une entrée. Purge les expirées au passage. */
export function savePreview(entry: InboxPreviewEntry): void {
  purgeExpired();
  getStore().set(fullKey(entry.pendingId), entry);
}

/**
 * Récupère une entrée par pendingId.
 * Retourne null si absente ou expirée (et la supprime dans ce cas).
 */
export function getPreview(pendingId: string): InboxPreviewEntry | null {
  const store = getStore();
  const entry = store.get(fullKey(pendingId));
  if (!entry) return null;

  if (Date.now() - entry.createdAt > INBOX_PREVIEW_TTL_MS) {
    store.delete(fullKey(pendingId));
    return null;
  }
  return entry;
}

/** Supprime une entrée (après validation finale ou annulation). */
export function deletePreview(pendingId: string): void {
  getStore().delete(fullKey(pendingId));
}

/**
 * Trouve l'entrée la plus récente (createdAt max) pour un chatId donné
 * avec `awaitingField != null`. Utilisé par le hook texte conversationnel
 * du webhook : si Thomas tape pendant qu'une carte attend un champ, on patche.
 */
export function findLatestAwaitingForChat(chatId: number): InboxPreviewEntry | null {
  const store = getStore();
  const now = Date.now();
  let best: InboxPreviewEntry | null = null;

  for (const entry of store.values()) {
    if (entry.chatId !== chatId) continue;
    if (entry.awaitingField === null) continue;
    if (now - entry.createdAt > INBOX_PREVIEW_TTL_MS) continue;
    if (!best || entry.createdAt > best.createdAt) {
      best = entry;
    }
  }
  return best;
}

// ============================================================
// Helpers de test
// ============================================================

/** Reset complet — UNIQUEMENT pour tests. */
export function _resetInboxPreviewStoreForTests(): void {
  getStore().clear();
}

/** Lecture brute — UNIQUEMENT pour tests. */
export function _getStoreSizeForTests(): number {
  return getStore().size;
}
