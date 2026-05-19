/**
 * Scanner — collecte des signaux depuis les 4 sources V1.
 *
 * Source de vérité : `docs/hot-context-spec.md` §1.3.
 *
 * Sources V1 (4) :
 *  1. Emails ingérés — relit `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` (entrées
 *     `op=append_historique` + `trigger=email-ingest:*`) depuis le dernier
 *     scan, extrait le payload.
 *  2. CR vault — `06. Réunions/YYYY/MM/*.md` modifiés depuis le dernier scan
 *     (filtrage par `modifiedTime` Drive).
 *  3. Telegram — push direct via le webhook (cf signal Telegram = handler
 *     `hot-context-patch.ts` qui appelle `processTelegramSignal`). Le scanner
 *     ne pull pas Telegram, il consomme ce qui est déjà queueé.
 *  4. Notes vault récentes — `list_recent_files` Drive (24h glissantes,
 *     exclut `_Inbox/`, `Templates/`, `Archive/`, `AnyaLogs/`, `AnyaState/`).
 *
 * Idempotence : chaque signal détecté est checké contre
 * `state.processedSignals[signalId]` avant appel Haiku.
 *
 * Le scanner produit une file de patches typés (post-Haiku). Le caller
 * (cron route) prend cette file et envoie une carte Telegram par patch.
 */

import { getAccessToken } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';
import {
  buildSignalId,
  detectSignal,
  passesHeuristicPrefilter,
} from './signal-detector';
import { writeHotContextAudit } from './audit';
import type { HotContextState, Patch, Signal } from './types';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const TIMEOUT_MS = 15_000;

/** Fenêtre glissante pour notes vault récentes. */
const RECENT_NOTES_WINDOW_MS = 24 * 60 * 60 * 1_000;

/** Dossiers exclus du scan vault-notes. */
const EXCLUDED_PREFIXES = ['_Inbox/', 'Templates/', 'Archive/'];

// ============================================================
// Types internes
// ============================================================

export interface ScanInput {
  /** State actuel (lastScanAt par source utilisé pour incrémentalité). */
  state: HotContextState;
  /** Signaux Telegram déjà queueés depuis le webhook (push). */
  telegramSignals?: Signal[];
}

export interface ScanResult {
  /** Patches typés produits (post-Haiku, post-prefilter). */
  patches: Patch[];
  /** Nouveaux lastScanAt à persister dans le state. */
  newLastScanAt: HotContextState['lastScanAt'];
  /** Nombre de signaux candidats avant filtrage (debug). */
  totalCandidates: number;
  /** Nombre filtrés par prefiltre heuristique. */
  filteredByPrefilter: number;
  /** Nombre déjà processés (idempotence cross-run). */
  skippedAlreadyProcessed: number;
}

// ============================================================
// Listing Drive helpers
// ============================================================

/**
 * Liste les fichiers .md d'un dossier Drive avec modifiedTime.
 */
async function listFilesWithMTime(
  accessToken: string,
  folderId: string,
): Promise<Array<{ id: string; name: string; modifiedTime: string; path?: string }>> {
  const q = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime: string }>;
  };
  return data.files ?? [];
}

async function readFileContent(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return '';
  return response.text();
}

// ============================================================
// Source 1 — Emails ingérés (JSONL AnyaLogs)
// ============================================================

/**
 * Lit les entrées JSONL email-ingest récentes (depuis lastScanAt.email).
 * Retourne des signaux exploitables (un par email distinct).
 */
async function collectEmailSignals(
  accessToken: string,
  sinceIso: string,
): Promise<Signal[]> {
  // Cible : `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` des 2 derniers jours
  const logsFolder = await resolvePath('_Inbox/AnyaLogs');
  if (!logsFolder.success || !logsFolder.fileId) return [];

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1_000);
  const candidates = [
    `${today.toISOString().slice(0, 10)}.jsonl`,
    `${yesterday.toISOString().slice(0, 10)}.jsonl`,
  ];

  const allFiles = await listFilesWithMTime(accessToken, logsFolder.fileId);
  const targetFiles = allFiles.filter((f) => candidates.includes(f.name));

  const signals: Signal[] = [];
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : 0;

  for (const file of targetFiles) {
    const content = await readFileContent(accessToken, file.id);
    if (!content) continue;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as {
          ts?: string;
          op?: string;
          target?: string;
          trigger?: string;
          payload?: Record<string, unknown>;
        };
        if (!entry.ts || !entry.trigger) continue;
        if (new Date(entry.ts).getTime() <= sinceMs) continue;
        // Heuristique : on garde les events email-ingest avec un excerpt
        if (!entry.trigger.startsWith('email-ingest')) continue;
        const payload = entry.payload ?? {};
        const excerpt =
          (typeof payload.subject === 'string' ? payload.subject + '\n\n' : '') +
          (typeof payload.bodyExcerpt === 'string' ? payload.bodyExcerpt : '') +
          (typeof payload.snippet === 'string' ? payload.snippet : '');
        if (!excerpt.trim()) continue;
        signals.push({
          source: 'email',
          sourceId: typeof payload.messageId === 'string' ? payload.messageId : entry.target ?? entry.ts,
          contentExcerpt: excerpt.slice(0, 2000),
          contextMeta: {
            from: typeof payload.from === 'string' ? payload.from : undefined,
            subject: typeof payload.subject === 'string' ? payload.subject : undefined,
            ts: entry.ts,
          },
        });
      } catch {
        // ligne malformée — skip silencieux
      }
    }
  }
  return signals;
}

// ============================================================
// Source 2 — CR vault récents
// ============================================================

async function collectCrSignals(
  accessToken: string,
  sinceIso: string,
): Promise<Signal[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folderPath = `06. Réunions/${year}/${month}`;
  const folder = await resolvePath(folderPath);
  if (!folder.success || !folder.fileId) return [];

  const files = await listFilesWithMTime(accessToken, folder.fileId);
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : 0;
  const recent = files.filter(
    (f) => f.name.endsWith('.md') && new Date(f.modifiedTime).getTime() > sinceMs,
  );

  const signals: Signal[] = [];
  for (const file of recent) {
    const content = await readFileContent(accessToken, file.id);
    if (!content) continue;
    signals.push({
      source: 'cr',
      sourceId: `${folderPath}/${file.name}`,
      contentExcerpt: content.slice(0, 2000),
      contextMeta: { titre: file.name.replace(/\.md$/, ''), modifiedTime: file.modifiedTime },
    });
  }
  return signals;
}

// ============================================================
// Source 4 — Notes vault récentes (24h glissantes)
// ============================================================

async function collectVaultNoteSignals(accessToken: string): Promise<Signal[]> {
  // Stratégie simple : query Drive globale modifiedTime > now-24h, mimeType md
  const sinceIso = new Date(Date.now() - RECENT_NOTES_WINDOW_MS).toISOString();
  const q = `modifiedTime > '${sinceIso}' and trashed=false and (name contains '.md')`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,parents)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime: string }>;
  };
  const files = data.files ?? [];

  const signals: Signal[] = [];
  for (const file of files) {
    // Filtre nom (exclus AnyaState/AnyaLogs/Templates)
    if (
      file.name.startsWith('hot-context-state') ||
      file.name === 'hot-context.md' ||
      file.name.endsWith('.jsonl')
    ) {
      continue;
    }
    const content = await readFileContent(accessToken, file.id);
    if (!content) continue;
    // Filtre dossier via path (best-effort : on regarde si le contenu mentionne un préfixe exclu)
    const isExcluded = EXCLUDED_PREFIXES.some((prefix) => content.includes(prefix));
    if (isExcluded && file.name.length < 5) continue;
    signals.push({
      source: 'vault-note',
      sourceId: file.id,
      contentExcerpt: content.slice(0, 2000),
      contextMeta: { name: file.name, modifiedTime: file.modifiedTime },
    });
  }
  return signals;
}

// ============================================================
// Pipeline principal
// ============================================================

/**
 * Exécute un scan complet : collecte signaux des 4 sources, applique
 * prefilter heuristique, vérifie idempotence cross-run, appelle Haiku
 * pour chaque signal restant, retourne la file de patches.
 */
export async function scanForPatches(input: ScanInput): Promise<ScanResult> {
  const accessToken = await getAccessToken();
  const newLastScanAt: HotContextState['lastScanAt'] = {
    email: input.state.lastScanAt.email,
    cr: input.state.lastScanAt.cr,
    telegram: input.state.lastScanAt.telegram,
    vaultNotes: input.state.lastScanAt.vaultNotes,
  };

  const nowIso = new Date().toISOString();
  const allSignals: Signal[] = [];

  // Sources Drive (1, 2, 4) skip si pas de token, mais lastScanAt MAJ quand même
  if (accessToken) {
    // Source 1 — emails
    try {
      const sigs = await collectEmailSignals(accessToken, input.state.lastScanAt.email);
      allSignals.push(...sigs);
    } catch (err) {
      console.warn(
        `[hot-context-scanner] email collection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Source 2 — CR vault
    try {
      const sigs = await collectCrSignals(accessToken, input.state.lastScanAt.cr);
      allSignals.push(...sigs);
    } catch (err) {
      console.warn(
        `[hot-context-scanner] cr collection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    console.warn('[hot-context-scanner] pas de token OAuth2 — sources Drive skip');
  }
  newLastScanAt.email = nowIso;
  newLastScanAt.cr = nowIso;

  // Source 3 — Telegram (push, fourni par le caller via webhook)
  if (input.telegramSignals && input.telegramSignals.length > 0) {
    allSignals.push(...input.telegramSignals);
  }
  newLastScanAt.telegram = nowIso;

  // Source 4 — vault notes (skip si pas de token)
  if (accessToken) {
    try {
      const sigs = await collectVaultNoteSignals(accessToken);
      allSignals.push(...sigs);
    } catch (err) {
      console.warn(
        `[hot-context-scanner] vault-note collection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  newLastScanAt.vaultNotes = nowIso;

  const totalCandidates = allSignals.length;
  let filteredByPrefilter = 0;
  let skippedAlreadyProcessed = 0;
  const patches: Patch[] = [];

  for (const signal of allSignals) {
    // Pre-filter heuristique
    if (!passesHeuristicPrefilter(signal)) {
      filteredByPrefilter++;
      continue;
    }

    // Audit signal detected
    void writeHotContextAudit('hot-context-signal-detected', {
      source: signal.source,
      sourceId: signal.sourceId,
      preview: signal.contentExcerpt.slice(0, 200),
    });

    // L'idempotence FINE (par signalId post-Haiku) est faite après l'appel
    // LLM. Le pré-check par source+sourceId seul n'est pas fiable (le même
    // sourceId peut générer plusieurs patches sur sections différentes au
    // fil du temps, et un patch skippé peut être reproposé après modif Thomas).

    // Appel Haiku
    const result = await detectSignal(signal, {
      currentFileTokens: input.state.lastFileTokensEstimate,
    });
    if (result.patch === null) continue;

    // Idempotence cross-run sur signalId exact (post-Haiku)
    if (input.state.processedSignals[result.patch.signalId] !== undefined) {
      skippedAlreadyProcessed++;
      void writeHotContextAudit('hot-context-signal-skipped-already-processed', {
        signalId: result.patch.signalId,
      });
      continue;
    }
    // Idempotence pendings (un patch équivalent en attente)
    if (input.state.pendingPatches[result.patch.patchId] !== undefined) {
      skippedAlreadyProcessed++;
      continue;
    }
    patches.push(result.patch);
  }

  return {
    patches,
    newLastScanAt,
    totalCandidates,
    filteredByPrefilter,
    skippedAlreadyProcessed,
  };
}

// Export pour debug
export { buildSignalId };
