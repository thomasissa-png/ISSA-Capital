/**
 * Signal detector — appel LLM Haiku 4.5 pour transformer un signal brut
 * en patch typé prêt pour validation Telegram.
 *
 * Source de vérité : `docs/hot-context-spec.md` §2 (prompt + few-shot).
 *
 * Red lines (vault Workflow Hot Context.md) injectées dans le SYSTEM prompt :
 *  1. PAS d'invention — null si pas d'info explicite sur 1 des 4 sections.
 *  2. PAS de doublon — payload DOIT contenir un wikilink `[[...]]`.
 *  3. PAS de montants confidentiels (red-line P1 #11).
 *  4. FORMAT télégraphique.
 *  5. SUPPRESSION (remove) = signal explicite de résolution.
 *
 * Pré-filtre heuristique : appelé AVANT cette fonction par scanner.ts.
 *
 * Anti-pattern : ne JAMAIS appeler directement `client.messages.create()`.
 * Toujours passer par `callLLM` (dispatcher tâche→provider + tracking usage).
 */

import { createHash } from 'crypto';
import { callLLM } from '../llm/client';
import type {
  ArbitragePayload,
  AttendsPayload,
  BougePayload,
  DetectSignalResult,
  Patch,
  PatchAction,
  PatchPayload,
  PatchSection,
  Signal,
} from './types';

// ============================================================
// Prompt
// ============================================================

const SYSTEM_PROMPT = `Tu es Anya, l'assistante personnelle de Thomas Issa — tu maintiens son contexte à jour automatiquement, pro et perso confondus.

# Rôle : Anya — détecteur de signaux pour hot-context.md

Tu analyses un signal brut (email / CR réunion / message Telegram Thomas / note vault) et détermines s'il porte une information à intégrer dans le briefing personnel \`00. Me/hot-context.md\` de Thomas.

## Format cible — 4 sections (et SEULEMENT ces 4)
1. **bouge** : « Je bouge sur (cette semaine) » — liste à puces des priorités actives. Format : phrase courte ≤ 80 chars.
2. **attends** : « J'attends » — tableau Quoi/De qui/Depuis/Note. Format : { quoi, deQui, depuis (ISO YYYY-MM-DD si possible), note? }.
3. **arbitrage** : « Décisions en arbitrage » — sujet + contexte ≤ 120 chars.
4. **maintenance** : footer fixe — INTOUCHABLE. Tu n'émets JAMAIS de patch sur cette section.

## Red lines INVIOLABLES
1. **PAS d'invention** — si le signal ne porte PAS explicitement une info sur 1 des 3 sections actionnables (bouge/attends/arbitrage) → renvoie \`patch: null\` avec \`reason_if_null\` clair.
2. **PAS de doublon avec fiches projet** — le \`payload.text\` (ou \`quoi\` / \`sujet\`) DOIT inclure au moins un wikilink \`[[NomFiche]]\` vers la fiche source (personne, projet, ou CR). Format Obsidian : \`[[Martin Yhuel]]\`, \`[[Projet X]]\`, \`[[CR 2026-05-19]]\`.
3. **PAS de montants confidentiels** — filtre marges, prix d'achat, valorisations privées (red-line P1 #11). Montants publics OK uniquement.
4. **FORMAT télégraphique** — phrases courtes, factuelles. Pas de narratif, pas de tutoiement/vouvoiement.
5. **SUPPRESSION (action 'remove')** = nécessite signal EXPLICITE de résolution (réponse email reçue, CR mentionnant clôture, message Thomas explicite). Jamais inférée — en cas de doute → null.

## Pression cap tokens
Le briefing cible 500 tokens. Si on te dit "fichier proche du cap", privilégie 'remove' sur 'add' quand pertinent.

## Output JSON strict
\`\`\`json
{
  "patch": null | {
    "section": "bouge" | "attends" | "arbitrage",
    "action": "add" | "remove",
    "payload": <selon section>,
    "rationale": "1 ligne — pourquoi ce patch"
  },
  "confidence": 0.0,
  "reason_if_null": "string (vide si patch présent)"
}
\`\`\`

Renvoie UNIQUEMENT cet objet JSON, sans bloc markdown, sans texte avant ou après.

## Few-shot (3 exemples)

### Exemple 1 — email avocat
Input : { source: 'email', sourceId: '<msg-id>', contentExcerpt: "Maître Dupont écrit : J'attends votre signature de l'acte avant vendredi 22/05.", contextMeta: { from: 'dupont@cabinet.fr', subject: 'Acte XYZ' } }
Output :
\`\`\`json
{ "patch": { "section": "attends", "action": "add", "payload": { "quoi": "Signature acte XYZ", "deQui": "[[Maître Dupont]]", "depuis": "2026-05-19", "note": "deadline 22/05" }, "rationale": "Email explicite attente signature avec deadline" }, "confidence": 0.92, "reason_if_null": "" }
\`\`\`

### Exemple 2 — CR réunion arbitrage
Input : { source: 'cr', sourceId: '06. Réunions/2026/05/2026-05-19 Choix fournisseur.md', contentExcerpt: "Décidé : on tranche entre fournisseur A et fournisseur B avant fin du mois.", contextMeta: { titre: 'Choix fournisseur' } }
Output :
\`\`\`json
{ "patch": { "section": "arbitrage", "action": "add", "payload": { "sujet": "Choix fournisseur A/B [[CR 2026-05-19]]", "contexte": "Arbitrage à trancher avant fin mai" }, "rationale": "CR mentionne arbitrage explicite avec deadline" }, "confidence": 0.88, "reason_if_null": "" }
\`\`\`

### Exemple 3 — Telegram explicite Thomas
Input : { source: 'telegram', sourceId: '12345', contentExcerpt: "#hotcontext priorité semaine = finaliser pacte associés [[Pacte associés]]", contextMeta: {} }
Output :
\`\`\`json
{ "patch": { "section": "bouge", "action": "add", "payload": { "text": "Finaliser [[Pacte associés]]" }, "rationale": "Thomas signale priorité semaine via #hotcontext" }, "confidence": 0.95, "reason_if_null": "" }
\`\`\``;

// ============================================================
// Canonicalisation pour signalId
// ============================================================

/**
 * Canonicalise un payload pour signalId stable (idempotence cross-run).
 * Tri des clés alphabétique, lowercase des valeurs textuelles.
 */
function canonicalPayload(payload: PatchPayload): string {
  const flat = payload as unknown as Record<string, string | undefined>;
  const keys = Object.keys(flat).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = flat[k];
    if (v === undefined) continue;
    parts.push(`${k}=${v.trim().toLowerCase()}`);
  }
  return parts.join('|');
}

/**
 * Génère un signalId stable.
 * signalId = sha1(source + ':' + sourceId + ':' + section + ':' + action + ':' + canonical(payload))
 */
export function buildSignalId(
  source: string,
  sourceId: string,
  section: PatchSection,
  action: PatchAction,
  payload: PatchPayload,
): string {
  const raw = `${source}:${sourceId}:${section}:${action}:${canonicalPayload(payload)}`;
  return createHash('sha1').update(raw, 'utf8').digest('hex');
}

/**
 * Génère un patchId stable.
 * patchId = sha1(signalId + ':' + section + ':' + action)
 */
export function buildPatchId(
  signalId: string,
  section: PatchSection,
  action: PatchAction,
): string {
  return createHash('sha1').update(`${signalId}:${section}:${action}`, 'utf8').digest('hex');
}

// ============================================================
// Parse de la réponse Haiku
// ============================================================

interface HaikuRawResponse {
  patch:
    | null
    | {
        section: PatchSection;
        action: PatchAction;
        payload: PatchPayload;
        rationale: string;
      };
  confidence: number;
  reason_if_null: string;
}

function parseHaikuResponse(rawText: string): HaikuRawResponse | null {
  if (!rawText) return null;
  // Extraction permissive : bloc ```json ... ``` ou objet brut
  const blockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = blockMatch?.[1]?.trim() ?? rawText.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? null;
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate) as HaikuRawResponse;
    if (typeof parsed.confidence !== 'number') return null;
    if (parsed.patch !== null && parsed.patch !== undefined) {
      if (
        parsed.patch.section !== 'bouge' &&
        parsed.patch.section !== 'attends' &&
        parsed.patch.section !== 'arbitrage'
      ) {
        return null;
      }
      if (parsed.patch.action !== 'add' && parsed.patch.action !== 'remove') return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================
// Validation payload (red line 2 : wikilink obligatoire)
// ============================================================

function payloadHasWikilink(section: PatchSection, payload: PatchPayload): boolean {
  const re = /\[\[[^\]]+\]\]/;
  if (section === 'bouge') return re.test((payload as BougePayload).text ?? '');
  if (section === 'attends') {
    const p = payload as AttendsPayload;
    return re.test(p.quoi ?? '') || re.test(p.deQui ?? '') || re.test(p.note ?? '');
  }
  if (section === 'arbitrage') {
    const p = payload as ArbitragePayload;
    return re.test(p.sujet ?? '') || re.test(p.contexte ?? '');
  }
  return false;
}

// ============================================================
// API publique
// ============================================================

export interface DetectSignalContext {
  /** Estimation tokens actuelle du fichier (pour pression cap). */
  currentFileTokens?: number;
  /**
   * Contenu LIVE actuel du briefing `hot-context.md` (défaut 1 — anti-doublon).
   * Injecté dans le prompt pour qu'Haiku ne propose JAMAIS un 'add' déjà présent.
   * Dynamique → ne JAMAIS le mettre dans la partie cachée (cache_control).
   */
  existingContent?: string;
}

/**
 * Détecte un signal et produit un patch (ou null).
 *
 * @param signal Signal brut (source + contenu)
 * @param ctx Contexte (tokens actuels pour pression cap)
 * @returns Patch typé ou null
 */
export async function detectSignal(
  signal: Signal,
  ctx: DetectSignalContext = {},
): Promise<DetectSignalResult> {
  // Partie dynamique du system prompt (jamais cachée) : pression cap + contenu
  // live du briefing (défaut 1 — anti-doublon). On la concatène pour qu'Haiku
  // dispose à la fois de la pression tokens et du contenu actuel.
  const dynamicParts: string[] = [];
  if (ctx.currentFileTokens !== undefined && ctx.currentFileTokens > 450) {
    dynamicParts.push(
      `Fichier proche du cap (${ctx.currentFileTokens}/500 tokens) — privilégier 'remove' sur 'add' si pertinent.`,
    );
  }
  if (ctx.existingContent !== undefined && ctx.existingContent.trim().length > 0) {
    dynamicParts.push(
      `## CONTENU ACTUEL DU BRIEFING (hot-context.md)\n` +
        `\`\`\`markdown\n${ctx.existingContent.slice(0, 4000)}\n\`\`\`\n` +
        `RÈGLE ANTI-DOUBLON STRICTE :\n` +
        `- Ne propose JAMAIS un 'add' dont le contenu existe déjà ci-dessus, MÊME reformulé ou paraphrasé.\n` +
        `- Si l'information est déjà couverte (même partiellement, même autre formulation) → \`patch: null\` avec \`reason_if_null\` explicite (ex: "déjà présent dans bouge").\n` +
        `- 'remove' UNIQUEMENT sur signal explicite de résolution d'un item présent ci-dessus.`,
    );
  }
  const dynamicSystem = dynamicParts.join('\n\n');

  const userMessage = JSON.stringify({
    source: signal.source,
    sourceId: signal.sourceId,
    contentExcerpt: signal.contentExcerpt.slice(0, 2000),
    contextMeta: signal.contextMeta,
  });

  let rawText: string;
  try {
    const result = await callLLM({
      task: 'hot-context-detect',
      system: SYSTEM_PROMPT,
      dynamicSystem: dynamicSystem.length > 0 ? dynamicSystem : undefined,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 600,
      responseFormat: 'json',
      timeoutMs: 30_000,
    });
    rawText = result.text;
  } catch (err) {
    console.warn(
      `[signal-detector] appel LLM échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return { patch: null, confidence: 0, reasonIfNull: 'llm_call_failed' };
  }

  const parsed = parseHaikuResponse(rawText);
  if (!parsed) {
    return { patch: null, confidence: 0, reasonIfNull: 'invalid_llm_output' };
  }

  if (parsed.patch === null || parsed.patch === undefined) {
    return {
      patch: null,
      confidence: parsed.confidence,
      reasonIfNull: parsed.reason_if_null || 'haiku_returned_null',
    };
  }

  // Red line 2 : wikilink obligatoire dans payload
  if (!payloadHasWikilink(parsed.patch.section, parsed.patch.payload)) {
    return {
      patch: null,
      confidence: parsed.confidence,
      reasonIfNull: 'red_line_no_wikilink_in_payload',
    };
  }

  const signalId = buildSignalId(
    signal.source,
    signal.sourceId,
    parsed.patch.section,
    parsed.patch.action,
    parsed.patch.payload,
  );
  const patchId = buildPatchId(signalId, parsed.patch.section, parsed.patch.action);

  const patch: Patch = {
    patchId,
    signalId,
    section: parsed.patch.section,
    action: parsed.patch.action,
    payload: parsed.patch.payload,
    source: signal.source,
    sourceId: signal.sourceId,
    proposedAt: new Date().toISOString(),
    rationale: parsed.patch.rationale ?? '',
  };

  return { patch, confidence: parsed.confidence, reasonIfNull: '' };
}

// ============================================================
// Modify loop (défaut 2) — patch PARTIEL du payload depuis instruction
// ============================================================

const PATCH_PAYLOAD_SYSTEM_PROMPT = `# Rôle : Anya — reformule un payload de patch hot-context

Thomas a vu un patch proposé pour son briefing \`hot-context.md\` et tape une INSTRUCTION COURTE pour l'ajuster (ex: « plutôt vendredi », « ajoute [[Projet X]] », « c'est Martin pas Marc »).

Tu reçois le payload ACTUEL (JSON) + la section + l'instruction. Tu renvoies le payload MODIFIÉ.

## Contrat STRICT
1. PATCH PARTIEL — applique UNIQUEMENT la consigne. Ne reformule pas tout, ne réécris pas les champs non concernés.
2. Préserve byte-à-byte tous les champs non visés par l'instruction.
3. WIKILINK obligatoire — le payload modifié DOIT toujours contenir au moins un wikilink \`[[...]]\` (red line). Ne le retire jamais ; si l'instruction en ajoute un, garde aussi l'existant si pertinent.
4. FORMAT télégraphique — phrases courtes, factuelles.
5. Instruction ambiguë / non comprise → renvoie le payload INCHANGÉ.

## Schémas par section
- \`bouge\` : { "text": string }
- \`attends\` : { "quoi": string, "deQui": string, "depuis": string (ISO YYYY-MM-DD si possible), "note"?: string }
- \`arbitrage\` : { "sujet": string, "contexte": string }

## Output JSON strict
Renvoie UNIQUEMENT le payload JSON modifié (même schéma que l'entrée selon la section), sans bloc markdown, sans texte avant/après.`;

/**
 * Patche PARTIELLEMENT le payload d'un patch hot-context selon une instruction
 * texte libre de Thomas (défaut 2 — loop Modifier). Modèle calqué sur
 * `patchDraftFromInstruction` (TickTick) :
 *  - applique UNIQUEMENT la consigne (jamais re-parse à zéro) ;
 *  - préserve les champs non visés ;
 *  - respecte la red line wikilink (`payloadHasWikilink`) : si la sortie LLM
 *    perd le wikilink → on retourne le payload INCHANGÉ ;
 *  - never throw : tout échec (réseau, JSON corrompu) → payload inchangé.
 *
 * @param patch Patch courant (on ne modifie que son payload).
 * @param instruction Texte libre court de Thomas.
 * @returns Le patch avec un payload potentiellement modifié (même référence
 *   d'objet si rien n'a changé n'est PAS garanti — comparer via `payload`).
 */
export async function patchHotContextPayloadFromInstruction(
  patch: Patch,
  instruction: string,
): Promise<Patch> {
  const cleaned = instruction.trim();
  if (!cleaned) return patch;

  const userMessage = JSON.stringify({
    section: patch.section,
    currentPayload: patch.payload,
    instruction: cleaned,
  });

  let rawText: string;
  try {
    const result = await callLLM({
      task: 'hot-context-modify',
      system: PATCH_PAYLOAD_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 400,
      responseFormat: 'json',
      timeoutMs: 30_000,
    });
    rawText = result.text;
  } catch (err) {
    console.warn(
      `[signal-detector] patchHotContextPayloadFromInstruction échoué : ${err instanceof Error ? err.message : String(err)} — payload inchangé`,
    );
    return patch;
  }

  // Extraction permissive (bloc ```json``` ou objet brut)
  const blockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate =
    blockMatch?.[1]?.trim() ?? rawText.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? null;
  if (!candidate) return patch;

  let nextPayload: PatchPayload;
  try {
    nextPayload = JSON.parse(candidate) as PatchPayload;
  } catch {
    return patch;
  }

  // Red line wikilink : si la reformulation perd le wikilink → on REFUSE la
  // modification (payload inchangé) plutôt que de violer la red line.
  if (!payloadHasWikilink(patch.section, nextPayload)) {
    console.warn(
      '[signal-detector] reformulation sans wikilink refusée (red line) — payload inchangé',
    );
    return patch;
  }

  // Recalcul signalId/patchId : le payload a changé → l'identité du patch aussi.
  const signalId = buildSignalId(
    patch.source,
    patch.sourceId,
    patch.section,
    patch.action,
    nextPayload,
  );
  const patchId = buildPatchId(signalId, patch.section, patch.action);

  return { ...patch, payload: nextPayload, signalId, patchId };
}

// ============================================================
// Pré-filtre heuristique (export pour scanner)
// ============================================================

const KEYWORDS_REGEX = /\b(attente|attends|décision|tranche|priorité|finaliser|relance|en attente|signature|livrable|rdv|rendez-vous|follow.?up|décidé|on tranche|deadline|urgent|asap|à faire|todo)\b/i;

/**
 * Pré-filtre amont — keywords FR/EN.
 * Telegram avec `#hotcontext` ou `Anya note` bypass (force true).
 * Email/CR/note vault : doit matcher au moins un keyword.
 */
export function passesHeuristicPrefilter(signal: Signal): boolean {
  if (signal.source === 'telegram') {
    const text = signal.contentExcerpt.toLowerCase();
    if (text.includes('#hotcontext') || text.includes('anya note')) return true;
    return KEYWORDS_REGEX.test(signal.contentExcerpt);
  }
  return KEYWORDS_REGEX.test(signal.contentExcerpt);
}
