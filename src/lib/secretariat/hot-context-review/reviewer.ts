/**
 * Revue autonome du hot-context (22h Paris) — deux cadences, zéro clic.
 *
 *  - LIGHT (tous les soirs, Haiku) : garde le mémo FRAIS. Intègre l'activité du
 *    jour (agenda + journal), retire le périmé. Rapide, lean.
 *  - DEEP (dimanche soir, Sonnet) : prend du recul. Lit le PROFIL de Thomas, RELIT
 *    les fiches modifiées dans la semaine pour détecter les OUBLIS, restructure,
 *    puis se RELIT (auto-critique) avant d'écrire. Bilan hebdo Telegram.
 *
 * Le hot-context « vit seul » : aucune validation Thomas (voie inline supprimée
 * S24). La transparence vient du Telegram des changements + des garde-fous.
 *
 * Sécurité (écriture autonome sur la SOT) :
 *  - Frontmatter + section « ## Maintenance » REconstruits depuis l'original
 *    (le LLM ne réécrit QUE la zone éditable).
 *  - Garde-fous déterministes (zone non vide/sectionnée, cap tokens) ; en DEEP,
 *    relecture LLM en plus. Si un contrôle échoue → on n'écrit pas + alerte.
 */

import { readFile, writeFile, readFileById } from '../vault-client/obsidian-file';
import { listRecentlyModifiedFiles } from '../vault-client/drive-resolver';
import { getAccessToken } from '../drive-upload';
import { HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME } from '../hot-context/applier';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { estimateTokens, TOKEN_CAP_WARN } from '../hot-context/token-estimator';
import { parisParts, bumpFrontmatter } from '../hot-context-staleness/staleness';
import { collectCalendar } from '../morning-brief/collect-calendar';
import { ANYA_LOGS } from '../vault-client/vault-paths';
import { writeAuditLog } from '../vault-client/audit-log';
import { callAnthropic, callLLM } from '../llm/client';
import { sendTelegramMessage } from '../telegram';

const TOKEN_HARD_LIMIT = 900; // au-delà : on alerte mais on écrit quand même
const PROFILE_FOLDER = '00. Me/01. Profil';
const PROFILE_FILENAME = 'Thomas Issa.md';
const WEEK_FICHES_CAP = 10;
const FICHE_EXCERPT_CHARS = 700;

export type ReviewMode = 'light' | 'deep';

export interface ReviewResult {
  proceeded: boolean;
  written: boolean;
  mode: ReviewMode;
  changes: string[];
  reason: string;
}

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
        const e = JSON.parse(line) as { op?: string; trigger?: string; target?: string; payload?: Record<string, unknown> };
        const p = e.payload ?? {};
        const subject = (p['subject'] as string) ?? (p['title'] as string) ?? '';
        const from = (p['from'] as string) ?? '';
        const cat = (p['category'] as string) ?? '';
        const bit = [e.trigger, cat, from, subject, e.target].filter(Boolean).join(' · ').slice(0, 180);
        if (bit) out.push(`- ${bit}`);
      } catch {
        /* ligne illisible → skip */
      }
    }
    if (!out.length) return '(aucune activité exploitable aujourd\'hui)';
    return [...new Set(out)].slice(-40).join('\n');
  } catch {
    return '(journal du jour indisponible)';
  }
}

/** Profil stable de Thomas (grille de lecture pour la passe DEEP). Best-effort. */
async function readProfile(): Promise<string> {
  try {
    const r = await readFile(PROFILE_FOLDER, PROFILE_FILENAME);
    if (!r.success || !r.content) return '(profil indisponible)';
    return parseObsidianFile(r.content).body.slice(0, 1500).trim() || '(profil vide)';
  } catch {
    return '(profil indisponible)';
  }
}

/**
 * Relit les fiches du vault modifiées cette semaine (extraits) pour la détection
 * d'oublis (passe DEEP). Best-effort : '' si rien/indisponible.
 */
async function weekFiches(): Promise<string> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const files = await listRecentlyModifiedFiles(since, WEEK_FICHES_CAP);
    if (!files.length) return '(aucune fiche modifiée cette semaine)';
    const token = await getAccessToken();
    if (!token) return '(lecture fiches indisponible)';
    const parts: string[] = [];
    for (const f of files) {
      const r = await readFileById(token, f.id);
      if (!r.success || !r.content) continue;
      const body = parseObsidianFile(r.content).body.replace(/\s+/g, ' ').trim();
      parts.push(`### ${f.name.replace(/\.md$/i, '')}\n${body.slice(0, FICHE_EXCERPT_CHARS)}`);
    }
    return parts.length ? parts.join('\n\n') : '(fiches illisibles)';
  } catch {
    return '(fiches indisponibles)';
  }
}

/** Nettoie une zone éditable produite par le LLM (frontmatter, fences, Maintenance). */
function cleanEditable(raw: string): string {
  let e = raw.trim();
  // DeepSeek rajoute parfois un bloc frontmatter en tête → le retirer (sinon le
  // garde-fou `\n---\n` rejette toute la sortie).
  e = e.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  // Fences markdown éventuelles.
  e = e.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  // La section Maintenance n'est jamais réécrite par le LLM.
  if (e.includes('## Maintenance')) e = e.slice(0, e.indexOf('## Maintenance')).trimEnd();
  return e.trim();
}

/**
 * Parse robuste de la sortie LLM `{editable, changes}` — tolère un bloc
 * ```json``` ou du texte autour (DeepSeek n'est pas toujours du JSON pur).
 */
function parseReviewOutput(raw: string): { editable: string; changes: string[] } {
  const t = (raw ?? '').trim();
  const block = t.match(/```(?:json)?\s*\r?\n?([\s\S]*?)```/);
  const candidate = block?.[1]?.trim() ?? t.match(/\{[\s\S]*\}/)?.[0] ?? t;
  const parsed = JSON.parse(candidate) as { editable?: string; changes?: string[] };
  return {
    editable: cleanEditable(String(parsed.editable ?? '')),
    changes: Array.isArray(parsed.changes)
      ? parsed.changes.map((c) => String(c).trim()).filter(Boolean)
      : [],
  };
}

/**
 * Garde-fou déterministe : la zone produite est plausible.
 *
 * S25 (2026-05-29) : ajout assertion conditionnelle de préservation de la
 * section critique `## J'attends`. Si l'original (`before`) avait cette
 * section et sa table markdown, le réécrit DOIT les conserver. Avant : la
 * consigne vivait dans le prompt LLM seulement → le LLM pouvait supprimer la
 * table sans déclencher d'alerte (sub-agent audit reviewer 29/05).
 *
 * @param e       Zone éditable réécrite par le LLM.
 * @param before  Zone éditable d'origine (optionnel — si fourni, garde-fou
 *                conditionnel sur les sections critiques qu'elle contenait).
 */
function editableIsValid(e: string, before?: string): boolean {
  if (e.length <= 40) return false;
  if (!e.includes('## ')) return false;
  if (e.includes('\n---\n')) return false;
  // Garde-fou conditionnel : si l'original avait `## J'attends`, le réécrit
  // doit le conserver (table de suivi critique pour Thomas).
  if (before && before.includes("## J'attends")) {
    if (!e.includes("## J'attends")) return false;
    // La section doit contenir une table markdown (séparateur `|---|`).
    const attendsBlock = e.split("## J'attends")[1]?.split(/^## /m)[0] ?? '';
    if (!/\|\s*-+\s*\|/.test(attendsBlock)) return false;
  }
  return true;
}

/**
 * Auto-critique (passe DEEP) : le modèle relit sa réécriture vs l'original et
 * renvoie ok + éventuelle version corrigée. Ne throw jamais.
 */
async function critiqueRewrite(
  before: string,
  after: string,
  family: 'sonnet',
  modelOverride: string | undefined,
): Promise<{ ok: boolean; issues: string[]; corrected: string | null }> {
  const system =
    "Tu es Anya, l'assistante personnelle de Thomas Issa. " +
    "Tu RELIS une réécriture du mémo « hot context » de Thomas avant publication. " +
    "Compare AVANT et APRÈS. Vérifie : (1) rien d'INVENTÉ qui n'était pas dans l'avant ; " +
    "(2) rien d'IMPORTANT supprimé à tort (item « J'attends » non résolu, décision, échéance future) ; " +
    "(3) longueur ~500 tokens max ; (4) sections Markdown présentes ; (5) PAS de section « ## Maintenance » ; " +
    "(6) wikilinks `[[...]]` préservés. " +
    'Réponds en JSON STRICT : {"ok": true|false, "issues": ["..."], "corrected": "<zone éditable corrigée du titre H1 jusqu\'avant Maintenance, ou null si rien à corriger>"}. ' +
    "Ne corrige QUE si nécessaire ; sinon corrected=null.";
  try {
    const { text } = await callAnthropic({
      family,
      modelOverride,
      system,
      messages: [{ role: 'user', content: `=== AVANT ===\n${before}\n\n=== APRÈS ===\n${after}` }],
      maxTokens: 2000,
      timeoutMs: 90_000,
      responseFormat: 'json',
    });
    const parsed = JSON.parse(text || '{}') as { ok?: boolean; issues?: unknown; corrected?: unknown };
    const issues = Array.isArray(parsed.issues) ? parsed.issues.map((i) => String(i)).filter(Boolean) : [];
    const corrected = typeof parsed.corrected === 'string' && parsed.corrected.trim().length > 0
      ? cleanEditable(parsed.corrected)
      : null;
    return { ok: parsed.ok === true, issues, corrected };
  } catch {
    // Relecture KO → on ne bloque pas, on laisse les garde-fous déterministes décider.
    return { ok: true, issues: [], corrected: null };
  }
}

/**
 * Revue du hot-context. `mode` auto (dimanche → deep, sinon light) sauf override.
 * `force` ignore la fenêtre 22h.
 */
export async function runReview(
  opts: { mode?: ReviewMode; force?: boolean } = {},
): Promise<ReviewResult> {
  const p = parisParts();
  const force = opts.force ?? false;
  const mode: ReviewMode = opts.mode ?? (p.weekday === 0 ? 'deep' : 'light');

  if (!force && p.hour !== 22) {
    return { proceeded: false, written: false, mode, changes: [], reason: `hors fenêtre (Paris ${p.hour}h)` };
  }

  const chatId = thomasChatId();
  const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
  if (!read.success || read.content === undefined) {
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : lecture impossible (${read.error ?? 'inconnu'}).`);
    return { proceeded: true, written: false, mode, changes: [], reason: `lecture échouée : ${read.error ?? 'inconnu'}` };
  }

  // Frontmatter bumpé + découpe zone éditable / maintenance (reconstruction sûre).
  const bumped = bumpFrontmatter(read.content, p.isoWeekStr, p.dateStr);
  const body = parseObsidianFile(bumped).body;
  const frontmatterText = bumped.slice(0, bumped.length - body.length);
  const maintIdx = body.indexOf('## Maintenance');
  const editableRegion = maintIdx >= 0 ? body.slice(0, maintIdx) : body;
  const maintenanceBlock = maintIdx >= 0 ? body.slice(maintIdx) : '';

  // Contexte commun + (deep) profil & fiches de la semaine.
  const [agenda, activity] = await Promise.all([upcomingAgenda(), todayActivity(p.dateStr)]);
  const [profile, fiches] = mode === 'deep'
    ? await Promise.all([readProfile(), weekFiches()])
    : ['', ''];

  // System prompt selon le mode.
  const baseRules =
    "RED LINES : ne JAMAIS inventer (si pas sûr, garde l'existant) ; PRÉSERVE les wikilinks `[[...]]` ; " +
    "garde le format Markdown des sections et le tableau « J'attends » ; mets à jour le titre H1 avec la " +
    "semaine courante ; n'ajoute PAS de section « Maintenance » (gérée à part). " +
    'Réponds en JSON STRICT, RIEN autour : {"editable": "<zone éditable mise à jour, du titre H1 jusqu\'avant Maintenance>", ' +
    '"changes": ["liste courte en français des changements"]}. ' +
    'Le champ "editable" DOIT commencer par "# " (titre H1) et CONTENIR les en-têtes "## " des sections. ' +
    'N\'inclus JAMAIS de bloc frontmatter (lignes "---" seules). ' +
    'Exemple de FORMAT (pas le contenu) : {"editable":"# Hot Context — Semaine du 26 mai\\n\\n## Je bouge sur\\n- item\\n\\n## J\'attends\\n| Quoi | De qui | Depuis | Note |\\n|---|---|---|---|\\n| x | [[Y]] | 2026-05-20 | … |\\n\\n## Décisions récentes\\n- …\\n","changes":["retiré X (échéance passée)","ajouté RDV Y"]}.';

  const system = mode === 'deep'
    ? "Tu es Anya, l'assistante personnelle de Thomas Issa — tu maintiens son CONTEXTE à jour automatiquement, pro et perso confondus. C'est la REVUE HEBDOMADAIRE (dimanche soir) de son mémo « hot context ». " +
      "Prends du RECUL : avec le PROFIL de Thomas comme grille de lecture, demande-toi les bonnes questions — qu'est-ce qui compte vraiment cette semaine pour lui ? qu'est-ce qui traîne ? qu'attend-il ? " +
      "RELIS les fiches modifiées cette semaine et VÉRIFIE QU'IL N'Y A PAS D'OUBLI : si une fiche révèle une échéance, une attente, une décision ou une action qui DEVRAIT être dans le mémo mais n'y est pas, AJOUTE-la (et signale-le dans changes, préfixe « Oubli rattrapé : »). " +
      "Puis réécris la zone éditable : retire le périmé, intègre/structure le pertinent, priorise du plus chaud au moins chaud, ~500 tokens. " +
      baseRules
    : "Tu es Anya, l'assistante personnelle de Thomas Issa — tu maintiens son CONTEXTE à jour automatiquement, pro et perso confondus. C'est la revue du SOIR (rapide) de son mémo « hot context ». " +
      "Garde-le FRAIS : retire ce qui est périmé (échéance/date passée, item résolu), intègre le pertinent de l'agenda/activité du jour. Ne restructure pas en profondeur, reste léger et synthétique (~500 tokens). " +
      baseRules;

  const userParts = [
    `Date du jour : ${p.dateStr} (semaine ${p.isoWeekStr}).`,
    `\n=== ZONE ÉDITABLE ACTUELLE ===\n${editableRegion}`,
    `\n=== AGENDA À VENIR (7 j) ===\n${agenda}`,
    `\n=== ACTIVITÉ DU JOUR (journal) ===\n${activity}`,
  ];
  if (mode === 'deep') {
    userParts.push(`\n=== PROFIL DE THOMAS (grille de lecture) ===\n${profile}`);
    userParts.push(`\n=== FICHES MODIFIÉES CETTE SEMAINE (vérifier les oublis) ===\n${fiches}`);
  }

  // Modèle : DEEP (dimanche) = Sonnet (override Opus possible) ; LÉGER (soir) =
  // DeepSeek V4 Pro via le routeur par tâche (meilleure prose que Haiku + moins
  // cher — décision Thomas S24).
  const modelOverride =
    mode === 'deep' ? (process.env.HOT_CONTEXT_REVIEW_MODEL_DEEP || undefined) : undefined;

  let editable = '';
  let changes: string[] = [];
  // S26 — Bug prod Thomas 28/05 « Unexpected end of JSON input » récurrent
  // (2 échecs de suite). Vérifié empiriquement via MCP Drive : hot-context.md
  // fait ~5870 bytes (~1500 tokens), budget cible frontmatter = ~500 tokens
  // → le mémo est 3× plus gros que la cible. MAX_TOKENS=2000 (ancien) ne laisse
  // qu'~500 tokens de marge sur un editable à réécrire de ~1400 tokens + JSON
  // overhead → saturation systémique. Le retry maxTokens doublé exigé par
  // Lessons #129 S24 n'était pas appliqué ici.
  // Fix : 1er essai à 4000 (couvre le cas attendu sans aller-retour) ; 2e
  // essai à 8000 (max DeepSeek) si le 1er KO. Détection EMPTY_RESPONSE
  // explicite pour distinguer du JSON tronqué dans les diagnostics.
  const userContent = userParts.join('\n');
  const callOnce = async (maxTokens: number): Promise<string> => {
    const { text } =
      mode === 'deep'
        ? await callAnthropic({
            family: 'sonnet',
            modelOverride,
            system,
            messages: [{ role: 'user', content: userContent }],
            maxTokens,
            timeoutMs: 90_000,
            responseFormat: 'json',
          })
        : await callLLM({
            task: 'hot-context-review-light',
            system,
            messages: [{ role: 'user', content: userContent }],
            maxTokens,
            timeoutMs: 90_000,
            responseFormat: 'json',
          });
    if (!text || text.trim().length === 0) {
      throw new Error('EMPTY_RESPONSE (LLM returned empty text)');
    }
    return text;
  };

  let succeeded = false;
  let lastErr: unknown = null;
  let lastText = '';
  for (const [attempt, maxTokens] of [[1, 4000], [2, 8000]] as const) {
    try {
      lastText = await callOnce(maxTokens);
      const out = parseReviewOutput(lastText);
      editable = out.editable;
      changes = out.changes;
      succeeded = true;
      // Log diagnostic sur succès aussi — permet d'observer post-deploy si le
      // 1er essai (4000) suffit ou si on dépend du retry (8000).
      console.warn(
        `[hot-context-review] LLM OK mode=${mode} attempt=${attempt}/2 maxTokens=${maxTokens} textLen=${lastText.length}`,
      );
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[hot-context-review] essai ${attempt}/2 KO mode=${mode} maxTokens=${maxTokens} : ${msg} — text head: ${(lastText || '(vide)').slice(0, 200).replace(/\n/g, '⏎')}`,
      );
    }
  }
  if (!succeeded) {
    const msg = lastErr instanceof Error ? lastErr.message : 'inconnu';
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : LLM échoue (2 essais : ${msg}). Mémo inchangé.`);
    return { proceeded: true, written: false, mode, changes: [], reason: `LLM échoué (2 essais) : ${msg}` };
  }

  if (!editableIsValid(editable, editableRegion)) {
    // Log diagnostique (sans le contenu intégral) pour comprendre POURQUOI la
    // sortie est rejetée (longueur, sections manquantes…) — surtout côté DeepSeek.
    console.warn(
      `[hot-context-review] sortie ${mode} invalide — len=${editable.length}, has_section=${editable.includes('## ')}, has_frontmatter=${editable.includes('\n---\n')} — extrait: ${editable.slice(0, 180).replace(/\n/g, '⏎')}`,
    );
    if (chatId !== null) await sendTelegramMessage(chatId, '🌙 Revue hot-context : sortie LLM invalide, mémo inchangé.');
    return { proceeded: true, written: false, mode, changes: [], reason: 'garde-fou zone éditable' };
  }

  // DEEP : relecture après écriture (auto-critique) avant de publier.
  if (mode === 'deep') {
    const critique = await critiqueRewrite(editableRegion, editable, 'sonnet', modelOverride);
    if (!critique.ok) {
      if (critique.corrected && editableIsValid(critique.corrected, editableRegion)) {
        editable = critique.corrected;
        changes.push(`🔁 Relecture : corrigé (${critique.issues.slice(0, 3).join(' ; ') || 'ajustements'})`);
      } else {
        if (chatId !== null) {
          await sendTelegramMessage(
            chatId,
            `🌙 Revue hebdo hot-context : la relecture a bloqué la publication (mémo inchangé).\n${critique.issues.map((i) => `• ${i}`).join('\n')}`,
          );
        }
        return { proceeded: true, written: false, mode, changes, reason: 'relecture KO' };
      }
    } else {
      changes.push('✅ Relecture OK');
    }
  }

  // Reconstruction sûre : frontmatter (bumpé) + zone éditable + maintenance (original).
  const sep = maintenanceBlock ? '\n\n' : '';
  const final = `${frontmatterText}${editable}${sep}${maintenanceBlock}`;
  const tokens = estimateTokens(final);

  const w = await writeFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME, final);
  if (!w.success) {
    if (chatId !== null) await sendTelegramMessage(chatId, `🌙 Revue hot-context : écriture Drive échouée (${w.error ?? 'inconnu'}).`);
    return { proceeded: true, written: false, mode, changes, reason: `écriture échouée : ${w.error ?? 'inconnu'}` };
  }

  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'hot-context.md',
    trigger: `hot-context-review:${mode}`,
    payload: { event: 'hot-context-review', mode, semaine: p.isoWeekStr, changes, tokens },
    status: 'success',
  });

  // Telegram — liste des changements.
  if (chatId !== null) {
    const header = mode === 'deep' ? `🌙 *Hot context — revue hebdo (${p.dateStr})*` : `🌙 *Hot context — revue du soir (${p.dateStr})*`;
    const lines = [header];
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

  console.warn(`[hot-context-review] mode=${mode} — ${changes.length} changement(s), ~${tokens} tokens`);
  return { proceeded: true, written: true, mode, changes, reason: 'ok' };
}

/** @deprecated S24 — utiliser `runReview`. Conservé pour compat (mode auto). */
export async function runNightlyReview(force = false): Promise<ReviewResult> {
  return runReview({ force });
}
