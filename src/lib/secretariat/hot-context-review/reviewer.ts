/**
 * Revue nocturne du hot-context (22h Paris) — autonome, langage adapté.
 *
 * Anya relit `hot-context.md`, intègre l'activité récente (agenda + journal
 * d'activité du jour), retire le périmé, et réécrit le mémo TOUTE SEULE, puis
 * envoie à Thomas un Telegram listant les changements. Aucun clic requis.
 *
 * Sécurité (écriture autonome sur la source de vérité) :
 *  - Le frontmatter et la section « ## Maintenance » sont REconstruits depuis
 *    l'original (le LLM ne peut pas les casser) — il ne réécrit QUE la zone
 *    éditable (titre + Je bouge / J'attends / Décisions).
 *  - Garde-fous : zone non vide, contient des sections, cap tokens. Sinon on
 *    n'écrit pas et on signale l'échec (pas de mémo cassé en silence).
 */

import { readFile, writeFile } from '../vault-client/obsidian-file';
import { HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME } from '../hot-context/applier';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { estimateTokens, TOKEN_CAP_WARN } from '../hot-context/token-estimator';
import { parisParts, bumpFrontmatter } from '../hot-context-staleness/staleness';
import { collectCalendar } from '../morning-brief/collect-calendar';
import { ANYA_LOGS } from '../vault-client/vault-paths';
import { writeAuditLog } from '../vault-client/audit-log';
import { callLLM } from '../llm/client';
import { sendTelegramMessage } from '../telegram';

const TOKEN_HARD_LIMIT = 900; // au-delà : on alerte mais on écrit quand même

function thomasChatId(): number | null {
  const raw = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** Agenda des 7 prochains jours, formaté en lignes compactes. Best-effort. */
async function upcomingAgenda(): Promise<string> {
  try {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const section = await collectCalendar(now.toISOString(), end.toISOString());
    if (!section.events.length) return '(aucun RDV à venir)';
    return section.events
      .slice(0, 20)
      .map((e) => `- ${e.allDay ? '(journée)' : (e.time ?? '')} ${e.title}${e.attendees.length ? ` — ${e.attendees.join(', ')}` : ''}`)
      .join('\n');
  } catch {
    return '(agenda indisponible)';
  }
}

/** Digest de l'activité du jour depuis le journal JSONL (emails, projets, etc.). */
async function todayActivity(parisDate: string): Promise<string> {
  try {
    const r = await readFile(ANYA_LOGS, `${parisDate}.jsonl`);
    if (!r.success || !r.content) return '(aucune activité enregistrée aujourd\'hui)';
    const lines = r.content.split('\n').filter((l) => l.trim().length > 0);
    const out: string[] = [];
    for (const line of lines.slice(-120)) {
      try {
        const e = JSON.parse(line) as { op?: string; trigger?: string; payload?: Record<string, unknown> };
        const p = e.payload ?? {};
        const subject = (p['subject'] as string) ?? (p['title'] as string) ?? '';
        const from = (p['from'] as string) ?? '';
        const cat = (p['category'] as string) ?? '';
        const bit = [e.trigger, cat, from, subject].filter(Boolean).join(' · ').slice(0, 160);
        if (bit) out.push(`- ${bit}`);
      } catch {
        /* ligne illisible → skip */
      }
    }
    if (!out.length) return '(aucune activité exploitable aujourd\'hui)';
    // Dédup + cap
    return [...new Set(out)].slice(-40).join('\n');
  } catch {
    return '(journal du jour indisponible)';
  }
}

export interface ReviewResult {
  proceeded: boolean;
  written: boolean;
  changes: string[];
  reason: string;
}

export async function runNightlyReview(force = false): Promise<ReviewResult> {
  const p = parisParts();
  if (!force && p.hour !== 22) {
    return { proceeded: false, written: false, changes: [], reason: `hors fenêtre (Paris ${p.hour}h)` };
  }

  const chatId = thomasChatId();
  const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
  if (!read.success || read.content === undefined) {
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : lecture impossible (${read.error ?? 'inconnu'}).`);
    return { proceeded: true, written: false, changes: [], reason: `lecture échouée : ${read.error ?? 'inconnu'}` };
  }

  // 1. Frontmatter bumpé + découpe zone éditable / maintenance (reconstruction sûre).
  const bumped = bumpFrontmatter(read.content, p.isoWeekStr, p.dateStr);
  const body = parseObsidianFile(bumped).body;
  const frontmatterText = bumped.slice(0, bumped.length - body.length);
  const maintIdx = body.indexOf('## Maintenance');
  const editableRegion = maintIdx >= 0 ? body.slice(0, maintIdx) : body;
  const maintenanceBlock = maintIdx >= 0 ? body.slice(maintIdx) : '';

  // 2. Digest activité récente.
  const [agenda, activity] = await Promise.all([upcomingAgenda(), todayActivity(p.dateStr)]);

  // 3. LLM — réécriture de la zone éditable + liste des changements.
  const system =
    "Tu es Anya, secrétariat IA de Thomas Issa (ISSA Capital — patrimoine, immobilier, business). " +
    "Tu fais la REVUE DU SOIR du mémo « hot context » de Thomas. On te donne la zone éditable actuelle " +
    "(titre + sections « Je bouge sur », « J'attends » (tableau), « Décisions récentes », « Décisions en " +
    "arbitrage »), la date du jour, et l'activité récente (agenda + journal). Mets le mémo À JOUR :\n" +
    "- RETIRE ce qui est périmé (échéance/date passée, item résolu, semaine révolue).\n" +
    "- INTÈGRE le pertinent issu de l'agenda/activité (RDV à venir, décisions, échéances).\n" +
    "- Garde le mémo SYNTHÉTIQUE (cible ~500 tokens), priorisé du plus chaud au moins chaud.\n" +
    "RED LINES : ne JAMAIS inventer (si pas sûr, garde l'existant) ; PRÉSERVE les wikilinks `[[...]]` ; " +
    "garde le format Markdown des sections et le tableau « J'attends » ; mets à jour le titre H1 avec la " +
    "semaine courante ; n'ajoute PAS de section « Maintenance » (gérée à part). " +
    'Réponds en JSON STRICT : {"editable": "<la zone éditable mise à jour, du titre H1 jusqu\'avant Maintenance>", ' +
    '"changes": ["liste courte en français des changements effectués (ce qui a été retiré/ajouté/màj)"]}.';

  let editable = '';
  let changes: string[] = [];
  try {
    const { text } = await callLLM({
      task: 'hot-context-review',
      system,
      messages: [
        {
          role: 'user',
          content:
            `Date du jour : ${p.dateStr} (semaine ${p.isoWeekStr}).\n\n` +
            `=== ZONE ÉDITABLE ACTUELLE ===\n${editableRegion}\n\n` +
            `=== AGENDA À VENIR (7 j) ===\n${agenda}\n\n` +
            `=== ACTIVITÉ DU JOUR (journal) ===\n${activity}`,
        },
      ],
      maxTokens: 2000,
      timeoutMs: 90_000,
      responseFormat: 'json',
    });
    const parsed = JSON.parse(text || '{}') as { editable?: string; changes?: string[] };
    editable = String(parsed.editable ?? '').trim();
    changes = Array.isArray(parsed.changes) ? parsed.changes.map((c) => String(c).trim()).filter(Boolean) : [];
  } catch (err) {
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : échec LLM, mémo inchangé (${err instanceof Error ? err.message : String(err)}).`);
    return { proceeded: true, written: false, changes: [], reason: 'LLM échoué' };
  }

  // 4. Garde-fous sur la zone éditable produite.
  if (editable.includes('## Maintenance')) editable = editable.slice(0, editable.indexOf('## Maintenance')).trimEnd();
  editable = editable.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  const editableOk = editable.length > 40 && editable.includes('## ') && !editable.includes('\n---\n');
  if (!editableOk) {
    if (chatId !== null) await sendTelegramMessage(chatId, '🌙 Revue hot-context : sortie LLM invalide, mémo inchangé.');
    return { proceeded: true, written: false, changes: [], reason: 'garde-fou zone éditable' };
  }

  // 5. Reconstruction sûre : frontmatter (bumpé) + zone éditable LLM + maintenance (original).
  const sep = maintenanceBlock ? '\n\n' : '';
  const final = `${frontmatterText}${editable}${sep}${maintenanceBlock}`;
  const tokens = estimateTokens(final);

  const w = await writeFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME, final);
  if (!w.success) {
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : écriture Drive échouée (${w.error ?? 'inconnu'}).`);
    return { proceeded: true, written: false, changes, reason: `écriture échouée : ${w.error ?? 'inconnu'}` };
  }

  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'hot-context.md',
    trigger: 'hot-context-review:nightly',
    payload: { event: 'hot-context-nightly-review', semaine: p.isoWeekStr, changes, tokens },
    status: 'success',
  });

  // 6. Telegram — liste des changements.
  if (chatId !== null) {
    const lines = [`🌙 *Hot context — revue du soir (${p.dateStr})*`];
    if (changes.length > 0) {
      lines.push('', ...changes.map((c) => `• ${c}`));
    } else {
      lines.push('', 'Aucun changement — le mémo était déjà à jour.');
    }
    if (tokens > TOKEN_HARD_LIMIT) {
      lines.push('', `⚠️ Mémo un peu long (~${tokens} tokens, cible ${TOKEN_CAP_WARN}). À élaguer.`);
    }
    await sendTelegramMessage(chatId, lines.join('\n'));
  }

  console.warn(`[hot-context-review] mémo réécrit — ${changes.length} changement(s), ~${tokens} tokens`);
  return { proceeded: true, written: true, changes, reason: 'ok' };
}
