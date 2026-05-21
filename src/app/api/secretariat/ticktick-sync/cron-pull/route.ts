/**
 * GET /api/secretariat/ticktick-sync/cron-pull
 *
 * Endpoint cron pour le pull TickTick → vault (S18.2).
 * Cadence cible : toutes les 3-5 min via GitHub Actions
 * (.github/workflows/cron-ticktick-sync-pull.yml).
 *
 * Algorithme (cf. pull-engine.ts) :
 *   1. lire state Drive
 *   2. fetch tâches TickTick (toutes les listes connues, via listTasks)
 *   3. last-write-wins, patch vault si TickTick gagne, créer si orphan
 *   4. S19 — deletes TickTick : completion silencieuse `[ ]` → `[x]` (zéro
 *      Telegram, JSONL trace). Remplace red line §9.2 historique.
 *   5. sauver state Drive
 *
 * Verrou push/pull simple via state.syncLock (TTL 30s).
 *
 * Pré-requis runtime :
 *   - CRON_SECRET (header Authorization: Bearer)
 *   - TICKTICK_ACCESS_TOKEN
 *   - DRIVE_VAULT_ROOT_ID + scopes OAuth Drive
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  loadSyncState,
  saveSyncState,
} from '@/lib/secretariat/ticktick-sync/state-store';
import {
  runPullEngine,
  releaseSyncLock,
  tryAcquireSyncLock,
  type TickTickPullClient,
  type VaultPatcher,
} from '@/lib/secretariat/ticktick-sync/pull-engine';
import { projectsReady } from '@/lib/secretariat/ticktick-sync/project-manager';
import { listTasks } from '@/lib/secretariat/ticktick/ticktick-client';
import {
  resolveFilePath,
  listMarkdownFiles,
} from '@/lib/secretariat/vault-client/drive-resolver';
import {
  getAccessToken,
  updateFileContent,
} from '@/lib/secretariat/drive-upload';
import type { TickTickRawTask } from '@/lib/secretariat/ticktick-sync/types';

// ============================================================
// Adaptateurs production
// ============================================================

function buildTickTickClient(): TickTickPullClient {
  return {
    async listAllTasks(projectIds) {
      const all: TickTickRawTask[] = [];
      for (const pid of projectIds) {
        try {
          const tasks = await listTasks(pid);
          for (const t of tasks) {
            all.push({
              id: t.id,
              projectId: t.projectId ?? pid,
              title: t.title ?? '',
              status: t.status,
              priority: t.priority,
              isAllDay: t.isAllDay,
              dueDate: t.dueDate,
              tags: t.tags,
              repeatFlag: t.repeatFlag,
              modifiedAt: t.modifiedTime ?? t.modifiedAt,
            });
          }
        } catch (err) {
          console.warn(
            `[cron-pull] listTasks(${pid}) échoué : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      return all;
    },
  };
}

function buildVaultPatcher(): VaultPatcher {
  return {
    async readFile(vaultPath) {
      const idx = vaultPath.lastIndexOf('/');
      const folder = idx > 0 ? vaultPath.slice(0, idx) : '';
      const filename = idx > 0 ? vaultPath.slice(idx + 1) : vaultPath;

      const accessToken = await getAccessToken();
      if (!accessToken) return null;

      // Résoudre fileId
      const resolved = await resolveFilePath(folder, filename);
      let fileId = resolved.success ? resolved.fileId : undefined;
      if (!fileId) {
        try {
          const files = await listMarkdownFiles(folder);
          const f = files.find((x) => x.name.toLowerCase() === filename.toLowerCase());
          if (f) fileId = f.id;
        } catch { /* ignore */ }
      }
      if (!fileId) return null;

      try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const content = await res.text();
        return { content, fileId };
      } catch {
        return null;
      }
    },
    async patchFile(fileId, newContent) {
      const result = await updateFileContent(fileId, newContent, 'text/markdown');
      return result.success;
    },
  };
}

// S19 — buildDeleteNotifier retiré : completion silencieuse remplace la carte
// Telegram delete (cf. pull-engine.ts §"Detection deletes TickTick").

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // S20 KILL SWITCH — voir docs/ia/ticktick-gap-analysis-s20.md.
  // Pull TickTick → vault désactivé : Todo.md devient miroir read-only régénéré
  // par mirror-renderer.ts (full-file, pas patch ligne par ligne).
  // Code conservé intact jusqu'à S21 (suppression définitive après 24h validation).
  if (process.env.TICKTICK_SYNC_LEGACY_DISABLED === '1') {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: 'S18 disabled S20 — see Workflow Todo.md SOT',
    });
  }

  const authHeader = req.headers.get('authorization');
  const queryToken = req.nextUrl.searchParams.get('token');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-ticktick-sync-pull] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const token = headerToken ?? queryToken;
  if (!token || token !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  const accessToken = process.env.TICKTICK_ACCESS_TOKEN;
  if (!accessToken || accessToken === '__TO_FILL__') {
    return NextResponse.json(
      {
        ok: false,
        error: 'TICKTICK_ACCESS_TOKEN manquant — configurer Replit Secrets',
      },
      { status: 500 },
    );
  }

  console.warn('[cron-ticktick-sync-pull] déclenchement pull TickTick → vault');

  try {
    const state = await loadSyncState();

    if (!projectsReady(state)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'projects_not_created',
      });
    }

    // Verrou anti-concurrence push/pull
    if (!tryAcquireSyncLock(state, 'pull')) {
      console.warn('[cron-ticktick-sync-pull] verrou occupé — skip ce run');
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'sync_lock_busy',
      });
    }

    let stats;
    let results;
    try {
      const ttClient = buildTickTickClient();
      const patcher = buildVaultPatcher();
      const pulled = await runPullEngine(state, ttClient, patcher);
      stats = pulled.stats;
      results = pulled.results;
    } finally {
      releaseSyncLock(state);
    }

    const saved = await saveSyncState(state);
    if (!saved) {
      console.warn(
        '[cron-ticktick-sync-pull] sauvegarde state Drive ÉCHEC — sync next run risque doublons',
      );
    }

    console.warn(
      `[cron-ticktick-sync-pull] terminé — fetched=${stats.fetched} patched=${stats.patched} ` +
      `created=${stats.created} completed=${stats.completed} ` +
      `completedSilently=${stats.completedSilently} vaultWins=${stats.vaultWins} ` +
      `skipped=${stats.skipped} errors=${stats.errors} (${stats.durationMs}ms)`,
    );

    return NextResponse.json({
      ok: stats.errors === 0,
      stats,
      stateSaved: saved,
      results: results.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-ticktick-sync-pull] erreur pipeline : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
