/**
 * Store de conversations — mémoire d'Anya entre les messages.
 *
 * Stocke l'historique des messages (user + assistant) par chat_id.
 * Persisté en fichier JSON sur disque pour survivre aux redémarrages Replit.
 *
 * Chaque conversation a un TTL de 24h — au-delà, elle est nettoyée.
 * L'historique est limité à 20 messages par conversation (les plus anciens
 * sont supprimés) pour ne pas exploser le contexte Claude.
 *
 * Supporte un `pendingDraft` optionnel : quand Claude génère un CR (status=ready),
 * le draft est stocké ici en attente de validation par l'utilisateur via les
 * boutons inline Telegram (Valider/Modifier/Annuler).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CRDraft } from './types';

const STORE_PATH = resolve(process.cwd(), '.conversations.json');
const MAX_MESSAGES_PER_CONVERSATION = 20;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // epoch ms
}

/**
 * Draft CR en attente de validation utilisateur.
 * Stocké dans la conversation entre la génération Claude et le clic
 * sur Valider/Modifier/Annuler.
 */
export interface PendingDraft {
  /** Le CR structuré tel que retourné par Claude */
  cr: CRDraft;
  /** Le texte formaté pour Telegram (aperçu envoyé à l'utilisateur) */
  previewText: string;
  /** Timestamp de création du draft */
  createdAt: number; // epoch ms
}

interface ConversationEntry {
  chatId: number;
  messages: ConversationMessage[];
  lastActivityAt: number; // epoch ms
  /** Draft CR en attente de validation (null si pas de draft pending) */
  pendingDraft?: PendingDraft | null;
}

type StoreData = Record<string, ConversationEntry>;

// ============================================================
// Persistence
// ============================================================

function loadStore(): StoreData {
  try {
    if (existsSync(STORE_PATH)) {
      const raw = readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw) as StoreData;
    }
  } catch {
    console.warn('[conversation-store] fichier corrompu, reset');
  }
  return {};
}

function saveStore(data: StoreData): void {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[conversation-store] erreur écriture :', err);
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Récupère l'historique de conversation pour un chat_id.
 * Retourne un tableau de messages au format Claude API.
 * Nettoie automatiquement les conversations expirées.
 */
export function getConversation(chatId: number): ConversationMessage[] {
  const store = loadStore();
  const key = String(chatId);
  const entry = store[key];

  if (!entry) return [];

  // TTL check
  if (Date.now() - entry.lastActivityAt > TTL_MS) {
    delete store[key];
    saveStore(store);
    return [];
  }

  return entry.messages;
}

/**
 * Ajoute un message (user ou assistant) à la conversation.
 * Limite à MAX_MESSAGES_PER_CONVERSATION messages.
 */
export function appendMessage(
  chatId: number,
  role: 'user' | 'assistant',
  content: string,
): void {
  const store = loadStore();
  const key = String(chatId);

  if (!store[key]) {
    store[key] = {
      chatId,
      messages: [],
      lastActivityAt: Date.now(),
    };
  }

  const entry = store[key];
  entry.messages.push({ role, content, timestamp: Date.now() });
  entry.lastActivityAt = Date.now();

  // Garder les N derniers messages
  if (entry.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    entry.messages = entry.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  }

  saveStore(store);
}

/**
 * Efface la conversation d'un chat_id (après publication CR par exemple).
 */
export function clearConversation(chatId: number): void {
  const store = loadStore();
  delete store[String(chatId)];
  saveStore(store);
}

/**
 * Convertit l'historique en format Claude API messages.
 */
export function toClaudeMessages(
  history: ConversationMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

// ============================================================
// Pending draft — CR en attente de validation
// ============================================================

/**
 * Stocke un draft CR en attente de validation pour un chat_id.
 * Appelé quand Claude génère un CR (status=ready) et que le preview
 * est envoyé avec les boutons inline.
 */
export function setPendingDraft(
  chatId: number,
  cr: CRDraft,
  previewText: string,
): void {
  const store = loadStore();
  const key = String(chatId);

  if (!store[key]) {
    store[key] = {
      chatId,
      messages: [],
      lastActivityAt: Date.now(),
    };
  }

  store[key].pendingDraft = {
    cr,
    previewText,
    createdAt: Date.now(),
  };
  store[key].lastActivityAt = Date.now();

  saveStore(store);
}

/**
 * Récupère le draft CR en attente de validation pour un chat_id.
 * Retourne null si aucun draft n'est en attente ou si la conversation a expiré.
 */
export function getPendingDraft(chatId: number): PendingDraft | null {
  const store = loadStore();
  const key = String(chatId);
  const entry = store[key];

  if (!entry) return null;

  // TTL check
  if (Date.now() - entry.lastActivityAt > TTL_MS) {
    delete store[key];
    saveStore(store);
    return null;
  }

  return entry.pendingDraft ?? null;
}

/**
 * Supprime le draft CR en attente pour un chat_id.
 * Appelé après validation, modification ou annulation.
 */
export function clearPendingDraft(chatId: number): void {
  const store = loadStore();
  const key = String(chatId);
  const entry = store[key];

  if (entry) {
    entry.pendingDraft = null;
    entry.lastActivityAt = Date.now();
    saveStore(store);
  }
}
