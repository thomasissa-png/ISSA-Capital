/**
 * Handler `inbox-edit` (S20.A) — édition conversationnelle d'une carte preview
 * inbox-router.
 *
 * Flow :
 *   1. Thomas envoie un message court → router affiche carte preview 7 boutons
 *      (4 ✏️ + 2 destinations + ✗ Annuler) avec un `pendingId`.
 *   2. Thomas tape sur ✏️ Heure (par ex.) →
 *      - callback `cb_inbox_edit_heure_{pendingId}` arrive sur le webhook
 *      - `handleInboxEditCallback` set `awaitingField=heure` dans le store
 *      - éditeur Telegram : message remplacé par une question + un seul bouton
 *        (✗ Annuler), pour bloquer les autres taps en attendant la saisie.
 *   3. Thomas tape "14h30" →
 *      - le webhook détecte qu'un pending awaitingField existe via
 *        `hasActivePendingEdit(chatId)`
 *      - dispatch vers `handleInboxEditText`
 *      - parsing déterministe via `inbox-edit-parsers.ts` (variants FR)
 *      - patch du draft dans le store, `awaitingField=null`
 *      - re-render carte 7 boutons in-place via `editMessageTextWithButtons`
 *
 * Règles ISSA respectées :
 *   - R3 : TTL pending 7j (assuré par `inbox-preview-store.ts`).
 *   - R4 : handler dédié + dispatch dans webhook + tests E2E (ce fichier).
 *
 * Choix techniques :
 *   - Aucun appel LLM : parsing déterministe pour rester économe & rapide.
 *   - `editMessageTextWithButtons(buttons=[…])` pour conserver le bouton
 *     d'annulation en mode "awaiting", évitant les écrans Telegram sans CTA.
 *   - Multi-pending : on prend toujours le plus récent (`createdAt` desc).
 */

import {
  getPreview,
  savePreview,
  findLatestAwaitingForChat,
  deletePreview,
  type InboxPreviewEntry,
  type AwaitingField,
} from '../inbox-preview-store';
import {
  parseTitre,
  parseDate,
  parseHeure,
  parseLieu,
} from '../workflows/inbox-edit-parsers';
import {
  buildPreviewMessage,
  buildPreviewKeyboard,
  INBOX_EDIT_TITRE_PREFIX,
  INBOX_EDIT_DATE_PREFIX,
  INBOX_EDIT_HEURE_PREFIX,
  INBOX_EDIT_LIEU_PREFIX,
  ROUTER_CALLBACK_PREFIX,
} from '../workflows/inbox-message-router';
import { editMessageTextWithButtons } from '../telegram-validation/telegram-cards';

// ============================================================
// Types
// ============================================================

/** Labels FR — utilisés dans les invites "Tape la nouvelle …". */
const FIELD_LABELS: Record<Exclude<AwaitingField, null>, string> = {
  titre: 'titre',
  date: 'date',
  heure: 'heure',
  lieu: 'lieu',
};

/** Hints d'exemple par champ — affichés à Thomas quand on attend une saisie. */
const FIELD_HINTS: Record<Exclude<AwaitingField, null>, string> = {
  titre: 'ex: RDV notaire avenue Foch',
  date: 'ex: 22/05, 22 mai, demain, lundi prochain',
  heure: 'ex: 14h30, 14:30, 14h, 2pm',
  lieu: 'ex: 21 avenue Foch, Paris',
};

/**
 * Résultat d'un dispatch (utilisé pour les tests — la prod ignore la valeur
 * de retour, le webhook se contente de `return Response.json({ ok: true })`).
 */
export interface InboxEditDispatchResult {
  handled: boolean;
  /** Détail d'erreur ou statut — sert aux tests + au logging. */
  reason?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Parse le préfixe callback_data → field + pendingId.
 * Retourne null si aucun préfixe d'édition ne matche.
 */
function parseEditCallback(
  callbackData: string,
): { field: Exclude<AwaitingField, null>; pendingId: string } | null {
  if (callbackData.startsWith(INBOX_EDIT_TITRE_PREFIX)) {
    return {
      field: 'titre',
      pendingId: callbackData.slice(INBOX_EDIT_TITRE_PREFIX.length),
    };
  }
  if (callbackData.startsWith(INBOX_EDIT_DATE_PREFIX)) {
    return {
      field: 'date',
      pendingId: callbackData.slice(INBOX_EDIT_DATE_PREFIX.length),
    };
  }
  if (callbackData.startsWith(INBOX_EDIT_HEURE_PREFIX)) {
    return {
      field: 'heure',
      pendingId: callbackData.slice(INBOX_EDIT_HEURE_PREFIX.length),
    };
  }
  if (callbackData.startsWith(INBOX_EDIT_LIEU_PREFIX)) {
    return {
      field: 'lieu',
      pendingId: callbackData.slice(INBOX_EDIT_LIEU_PREFIX.length),
    };
  }
  return null;
}

/** Dispatch sur le parser correspondant au champ. */
function parseValueForField(
  field: Exclude<AwaitingField, null>,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  switch (field) {
    case 'titre':
      return parseTitre(raw);
    case 'lieu':
      return parseLieu(raw);
    case 'heure':
      return parseHeure(raw);
    case 'date':
      return parseDate(raw);
  }
}

// ============================================================
// API publique — détection d'un pending actif (pour le webhook)
// ============================================================

/**
 * Helper booléen pour le webhook : true si un pending preview est en mode
 * `awaitingField` pour ce chatId. Permet au webhook de router le prochain
 * message texte vers `handleInboxEditText` plutôt que vers le router classique.
 *
 * @returns true si une carte attend une saisie, false sinon (= flow normal).
 */
export async function hasActivePendingEdit(chatId: number): Promise<boolean> {
  const latest = findLatestAwaitingForChat(chatId);
  return latest !== null;
}

// ============================================================
// API publique — handleInboxEditCallback (tap ✏️ Heure/Date/Lieu/Titre)
// ============================================================

/**
 * Gère un callback Telegram avec préfixe `cb_inbox_edit_{field}_{pendingId}`.
 *
 * Effets :
 *   - Met à jour `awaitingField` dans le store.
 *   - Édite la carte Telegram in-place : remplace le texte par une invite
 *     "⏳ Tape la nouvelle {field}… ({hint})" et ne laisse plus que le bouton
 *     ✗ Annuler.
 *
 * @returns `{ handled: true }` si le callback a été pris en charge,
 *          `{ handled: false }` sinon (pas notre préfixe — le webhook continue
 *          son dispatch sur les autres préfixes).
 */
export async function handleInboxEditCallback(
  callbackData: string,
  chatId: number,
  _messageId: number,
): Promise<InboxEditDispatchResult> {
  const parsed = parseEditCallback(callbackData);
  if (!parsed) {
    return { handled: false };
  }

  const { field, pendingId } = parsed;
  const entry = getPreview(pendingId);

  // Pending expiré ou inconnu : ne casse pas le flow, signale juste.
  if (!entry) {
    return { handled: true, reason: 'pending-expired-or-unknown' };
  }

  // Vérification d'appartenance (le store la fait déjà côté chat, on double-check).
  if (entry.chatId !== chatId) {
    return { handled: true, reason: 'chat-mismatch' };
  }

  // Patch awaitingField + persist
  const updated: InboxPreviewEntry = {
    ...entry,
    awaitingField: field,
  };
  savePreview(updated);

  // Re-render carte : question + un seul bouton ✗ Annuler.
  const label = FIELD_LABELS[field];
  const hint = FIELD_HINTS[field];
  const previewText = buildPreviewMessage(entry.draft);
  const newText = `${previewText}\n\n⏳ Tape la nouvelle ${label} (${hint})`;
  const cancelOnly: Array<Array<{ text: string; callback_data: string }>> = [
    [
      {
        text: '\u{2717} Annuler',
        callback_data: `${ROUTER_CALLBACK_PREFIX}cancel:${pendingId}`,
      },
    ],
  ];

  await editMessageTextWithButtons(
    chatId,
    entry.messageId,
    newText,
    cancelOnly,
  );

  return { handled: true };
}

// ============================================================
// API publique — handleInboxEditText (Thomas tape "14h30")
// ============================================================

/**
 * Gère une saisie texte quand un pending preview est en mode `awaitingField`.
 *
 * Effets :
 *   - Parse la saisie via le parser correspondant au champ attendu.
 *   - Si parse OK : patch `draft.{field}`, set `awaitingField=null`,
 *     re-render carte 7 boutons in-place.
 *   - Si parse KO : laisse l'état tel quel, ré-affiche la carte avec un
 *     message d'erreur compact + bouton ✗ Annuler (Thomas peut retaper).
 *
 * @returns `{ handled: true }` si un pending awaitingField existait,
 *          `{ handled: false }` sinon (= rien à faire, le webhook continue).
 */
export async function handleInboxEditText(
  text: string,
  chatId: number,
): Promise<InboxEditDispatchResult> {
  const entry = findLatestAwaitingForChat(chatId);
  if (!entry || entry.awaitingField === null) {
    return { handled: false };
  }

  const field = entry.awaitingField;
  const parsed = parseValueForField(field, text);

  if (!parsed.ok) {
    // Garder awaitingField actif, ré-afficher l'invite avec l'erreur.
    const label = FIELD_LABELS[field];
    const hint = FIELD_HINTS[field];
    const previewText = buildPreviewMessage(entry.draft);
    const newText =
      `${previewText}\n\n\u{26A0}\u{FE0F} ${parsed.error}\n` +
      `Tape la ${label} (${hint})`;
    const cancelOnly: Array<Array<{ text: string; callback_data: string }>> = [
      [
        {
          text: '\u{2717} Annuler',
          callback_data: `${ROUTER_CALLBACK_PREFIX}cancel:${entry.pendingId}`,
        },
      ],
    ];
    await editMessageTextWithButtons(
      chatId,
      entry.messageId,
      newText,
      cancelOnly,
    );
    return { handled: true, reason: 'parse-failed' };
  }

  // Patch du draft + clear awaitingField.
  const patchedDraft = { ...entry.draft, [field]: parsed.value };
  const updated: InboxPreviewEntry = {
    ...entry,
    draft: patchedDraft,
    awaitingField: null,
  };
  savePreview(updated);

  // Re-render carte 7 boutons.
  const newText = buildPreviewMessage(patchedDraft);
  const keyboard = buildPreviewKeyboard(entry.pendingId);
  await editMessageTextWithButtons(chatId, entry.messageId, newText, keyboard);

  return { handled: true };
}

// ============================================================
// API publique — cleanup explicite (utilisé par cb_cancel)
// ============================================================

/**
 * Supprime un pending preview par son id. Idempotent.
 * Exposé pour que le dispatch du webhook puisse cleaner après un cancel.
 */
export function cleanupInboxPreview(pendingId: string): void {
  deletePreview(pendingId);
}
