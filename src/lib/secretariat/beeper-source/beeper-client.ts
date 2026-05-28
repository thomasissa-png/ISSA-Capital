/**
 * Client Beeper — lecture des messages WhatsApp déchiffrés (Phase 2).
 *
 * L'API HTTP du Beeper Server est cassée (bug nightly stuck `initializing`).
 * Source de vérité : les DB SQLite locales du serveur, lues en READ-ONLY via la
 * CLI `sqlite3` (zéro dépendance npm → pas de module natif, build Replit safe).
 *
 * Découverte S24/S25 (vérifiée) :
 *  - `index.db` table `mx_room_messages` : 9264 messages, texte EN CLAIR dans la
 *    colonne JSON `message` (`message ->> 'text'`), `roomID` = salle Matrix,
 *    `senderContactID`, `timestamp`, `type`, `isDeleted`.
 *  - `megabridge.db` table `portal` : mapping `mxid` (= roomID Matrix) ↔ `id`
 *    (chat WhatsApp `…@g.us`/`…@s.whatsapp.net`) + `name` (nom du chat).
 *  - La table `index.db.messages` est vide ; `text_content`/`message_derived_content` aussi.
 *
 * 🔒 LECTURE SEULE STRICTE. Aucune écriture, aucun envoi WhatsApp (règle 11).
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  try {
    loadEnvConfig(process.cwd());
  } catch {
    /* best-effort */
  }
  envLoaded = true;
}

const SERVER_DIR = '/root/.beeper/profiles/server/server';
const SQLITE_TIMEOUT_MS = 15_000;

function indexDbPath(): string {
  ensureEnv();
  return process.env.BEEPER_INDEX_DB ?? `${SERVER_DIR}/index.db`;
}
function megabridgeDbPath(): string {
  ensureEnv();
  return process.env.BEEPER_DB_PATH ?? `${SERVER_DIR}/local-whatsapp/megabridge.db`;
}

/** Liste blanche pro (chat WhatsApp id `…@g.us`, ou fragment de nom), CSV dans BEEPER_WHITELIST. */
export function beeperWhitelist(): string[] {
  ensureEnv();
  return (process.env.BEEPER_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface SqliteResult {
  ok: boolean;
  rows?: Array<Record<string, unknown>>;
  error?: string;
}

/**
 * Copie la DB (+ ses sidecars WAL/SHM) dans un dossier temporaire détenu par
 * l'utilisateur courant, puis renvoie le chemin de la copie + un cleanup.
 *
 * Pourquoi : `index.db` est en mode WAL. Une lecture `sqlite3 -readonly` d'une DB
 * WAL doit pouvoir écrire le `-shm` (mmap) — or Anya (`thomas`) n'a PAS les droits
 * d'écriture sur les fichiers de `root/.beeper` (et le `setfacl` ne survit pas aux
 * recréations de fichiers par le bridge) → erreur « attempt to write a readonly
 * database (8) ». La copie locale (writable) supprime cette dépendance. Lecture
 * du vrai fichier inchangée : aucune écriture vers `root/.beeper` (règle 11).
 */
async function snapshotDb(dbPath: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'anya-beeper-'));
  const dest = path.join(dir, path.basename(dbPath));
  // Copie le fichier principal + les sidecars WAL/SHM s'ils existent (snapshot cohérent).
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fs.copyFile(dbPath + suffix, dest + suffix);
    } catch {
      /* sidecar absent → normal */
    }
  }
  return { path: dest, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

/** Requête READ-ONLY via la CLI sqlite3, sortie JSON. SELECT uniquement. */
async function runSqliteJson(dbPath: string, query: string): Promise<SqliteResult> {
  let snap: { path: string; cleanup: () => Promise<void> };
  try {
    snap = await snapshotDb(dbPath);
  } catch (err) {
    return { ok: false, error: `snapshot DB impossible : ${err instanceof Error ? err.message : String(err)}` };
  }
  try {
    return await new Promise<SqliteResult>((resolve) => {
      // PAS de `-readonly` : on lit la COPIE jetable en read-WRITE pour que SQLite
      // puisse rejouer le `-wal` et reconstruire le `-shm` (un `-readonly` sur une
      // DB WAL ne peut PAS écrire le `-shm` → soit « readonly database (8) », soit
      // lecture du seul fichier principal sans les messages récents encore dans le
      // `-wal`). La vraie DB sous /root/.beeper n'est JAMAIS touchée (règle 11) :
      // on n'écrit que sur la copie temporaire, supprimée juste après (cleanup).
      execFile(
        'sqlite3',
        ['-json', snap.path, query],
        { timeout: SQLITE_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            resolve({ ok: false, error: (stderr || err.message).slice(0, 400).trim() });
            return;
          }
          const out = stdout.trim();
          if (!out) {
            resolve({ ok: true, rows: [] });
            return;
          }
          try {
            resolve({ ok: true, rows: JSON.parse(out) as Array<Record<string, unknown>> });
          } catch {
            resolve({ ok: false, error: `JSON parse impossible : ${out.slice(0, 200)}` });
          }
        },
      );
    });
  } finally {
    await snap.cleanup().catch(() => {});
  }
}

export interface BeeperChat {
  /** roomID Matrix (`!xxx:…`) — clé de jointure avec mx_room_messages.roomID. */
  mxid: string;
  /** id WhatsApp du chat (`…@g.us` / `…@s.whatsapp.net`). */
  chatId: string;
  /** nom lisible du chat. */
  name: string;
}

/** Fragment de nom de chat à EXCLURE (CSV, case-insensitive). Défaut : "sarani,ubi". */
export function beeperExcludedNameFragments(): string[] {
  ensureEnv();
  return (process.env.BEEPER_EXCLUDE ?? 'sarani,ubi')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Fragments de nom FORCÉS INCLUS (CSV, case-insensitive), qui PRIMENT sur
 * l'exclusion. Permet de garder un chat précis même s'il contient un fragment
 * exclu — ex. « Reprise Sarani » reste traité alors que « sarani » est exclu.
 * Défaut : "reprise sarani". Override via BEEPER_INCLUDE.
 */
export function beeperIncludedNameFragments(): string[] {
  ensureEnv();
  return (process.env.BEEPER_INCLUDE ?? 'reprise sarani')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Vrai si le chat doit être exclu. La liste d'inclusion PRIME : un nom qui
 * matche un fragment inclus n'est jamais exclu (même s'il contient « sarani »).
 */
export function isExcludedChat(chatName: string): boolean {
  const n = chatName.toLowerCase();
  if (beeperIncludedNameFragments().some((frag) => n.includes(frag))) return false;
  return beeperExcludedNameFragments().some((frag) => n.includes(frag));
}

/** Charge la table des chats (portal) → map roomID(mxid) → {chatId, name}.
 *  Résout le nom des DM via ghost (portal.name est vide pour les conversations 1-1). */
export async function loadChats(): Promise<Map<string, BeeperChat>> {
  const r = await runSqliteJson(
    megabridgeDbPath(),
    `SELECT p.mxid AS mxid,
            p.id AS chatId,
            COALESCE(NULLIF(p.name,''), g.name, p.other_user_id, '') AS name
     FROM portal p
     LEFT JOIN ghost g ON g.bridge_id = p.bridge_id AND g.id = p.other_user_id
     WHERE p.mxid IS NOT NULL AND p.mxid != '';`,
  );
  const map = new Map<string, BeeperChat>();
  if (r.ok && r.rows) {
    for (const row of r.rows) {
      const mxid = String(row.mxid ?? '');
      if (mxid) map.set(mxid, { mxid, chatId: String(row.chatId ?? ''), name: String(row.name ?? '') });
    }
  }
  return map;
}

export interface BeeperMessage {
  roomID: string;
  chatId: string;
  chatName: string;
  senderContactID: string;
  timestamp: number;
  text: string;
  isSender: boolean;
}

/**
 * Liste les messages TEXTE reçus depuis un curseur (timestamp ms), enrichis du
 * nom de chat. Exclut les supprimés et les messages envoyés par le compte
 * (isSender). Lecture seule.
 */
export async function listTextMessagesSince(
  sinceTimestamp: number,
  limit = 200,
): Promise<BeeperMessage[]> {
  const chats = await loadChats();
  const r = await runSqliteJson(
    indexDbPath(),
    `SELECT roomID,
            senderContactID,
            timestamp,
            message ->> 'text' AS text,
            message ->> 'isSender' AS isSender
     FROM mx_room_messages
     WHERE type='TEXT' AND isDeleted=0
       AND timestamp > ${Number(sinceTimestamp) || 0}
       AND COALESCE(message ->> 'text','') != ''
     ORDER BY timestamp ASC
     LIMIT ${Number(limit) || 200};`,
  );
  // Lecture échouée (snapshot/sqlite/WAL « readonly ») : on REMONTE l'erreur au
  // lieu de renvoyer [] silencieusement — sinon l'appelant la prend pour « aucun
  // message » et avance le curseur, sautant la fenêtre pour toujours.
  if (!r.ok) {
    throw new Error(`lecture SQLite Beeper échouée : ${r.error ?? 'inconnue'}`);
  }
  const mapped = (r.rows ?? []).map((row): BeeperMessage => {
    const roomID = String(row.roomID ?? '');
    const chat = chats.get(roomID);
    const isSender = row.isSender === 1 || row.isSender === true || row.isSender === '1';
    return {
      roomID,
      chatId: chat?.chatId ?? '',
      chatName: chat?.name ?? '',
      senderContactID: String(row.senderContactID ?? ''),
      timestamp: Number(row.timestamp ?? 0),
      text: String(row.text ?? ''),
      isSender,
    };
  });
  // S26 — Bug #2 investigation : ventiler les drops par raison plutôt qu'un
  // total agrégé. Permet de discriminer « curseur cassé » (raw=0) d'une
  // « exclusion BEEPER_EXCLUDE trop large » (raw>0, kept=0, exclus>0) ou d'un
  // « volume isSender élevé » (Thomas répond beaucoup, peu de messages reçus).
  let droppedIsSender = 0;
  let droppedEmpty = 0;
  let droppedExcluded = 0;
  const excludedChatNamesSeen = new Set<string>();
  const kept: BeeperMessage[] = [];
  for (const m of mapped) {
    if (m.isSender) {
      droppedIsSender++;
      continue;
    }
    if (m.text.length === 0) {
      droppedEmpty++;
      continue;
    }
    if (isExcludedChat(m.chatName)) {
      droppedExcluded++;
      excludedChatNamesSeen.add(m.chatName);
      continue;
    }
    kept.push(m);
  }
  const maxTs = mapped.reduce((m, x) => Math.max(m, x.timestamp), 0);
  const excludedSample = [...excludedChatNamesSeen].slice(0, 5).join(' | ') || '∅';
  console.warn(
    `[beeper] listTextMessagesSince(since=${Math.round(Number(sinceTimestamp))}) : ` +
      `${mapped.length} ligne(s) SQL → kept ${kept.length} | dropped: isSender=${droppedIsSender} ` +
      `vide=${droppedEmpty} exclus(BEEPER_EXCLUDE)=${droppedExcluded} (chats: ${excludedSample}) | ` +
      `maxTs=${maxTs}, now=${Date.now()}`,
  );
  return kept;
}

export interface BeeperHealth {
  ok: boolean;
  totalMessages?: number;
  chats?: number;
  lastChatName?: string;
  lastTextLength?: number;
  error?: string;
}

/**
 * Sanity check au démarrage : prouve que la lecture déchiffrée marche, SANS
 * logguer le contenu (privacy) — juste compteurs + nom de chat + longueur.
 */
export async function checkBeeperContent(): Promise<BeeperHealth> {
  const count = await runSqliteJson(
    indexDbPath(),
    "SELECT COUNT(*) AS n FROM mx_room_messages WHERE type='TEXT' AND isDeleted=0;",
  );
  if (!count.ok) return { ok: false, error: count.error };
  const total = Number(count.rows?.[0]?.n ?? 0);

  const chats = await loadChats();

  const last = await runSqliteJson(
    indexDbPath(),
    `SELECT roomID, length(message ->> 'text') AS len
     FROM mx_room_messages
     WHERE type='TEXT' AND isDeleted=0 AND COALESCE(message ->> 'text','') != ''
     ORDER BY timestamp DESC LIMIT 1;`,
  );
  const lastRow = last.rows?.[0];
  const lastChat = lastRow ? chats.get(String(lastRow.roomID ?? ''))?.name ?? '(chat inconnu)' : undefined;

  return {
    ok: true,
    totalMessages: total,
    chats: chats.size,
    lastChatName: lastChat,
    lastTextLength: lastRow ? Number(lastRow.len ?? 0) : undefined,
  };
}
