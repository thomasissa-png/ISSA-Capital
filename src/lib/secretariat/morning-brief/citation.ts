/**
 * Citation du jour pour le brief du matin.
 *
 * 1. Cherche les fiches de lecture de Thomas via l'API Drive (files.list).
 *    Filtre : nom contient « [Livre] », markdown, non supprimé.
 *    Exclut les stubs de redirection (frontmatter `type: redirect`).
 * 2. Sélection déterministe par jour : dayOfYear % nbFiches → 1 fiche.
 * 3. Lit la fiche (readFileById) → Flash distille 1-2 lignes + titre du livre.
 *
 * Fallback : aucune fiche / LLM en échec → null (le brief part sans citation).
 * R8 : la sélection s'appuie sur le dayOfYear Paris (passé par l'appelant).
 */

import {
  getAccessToken,
  searchDriveFiles,
  type DriveFileMeta,
} from '../drive-upload';
import { readFileById } from '../vault-client/obsidian-file';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { callLLM } from '../llm/client';

/** Requête Drive : fiches de lecture markdown, non supprimées. */
const FICHES_QUERY =
  "name contains '[Livre]' and mimeType='text/markdown' and trashed=false";

export interface DailyCitation {
  /** Citation / insight distillé (1-2 lignes). */
  text: string;
  /** Titre du livre source (déduit du nom de fiche). */
  book: string;
}

/**
 * Déduit un titre de livre lisible depuis le nom de fichier de la fiche.
 * Ex : « [Livre] Atomic Habits.md » → « Atomic Habits ».
 */
function bookTitleFromFilename(name: string): string {
  return name
    .replace(/\.md$/i, '')
    .replace(/\[Livre\]/i, '')
    .trim();
}

/**
 * Liste les fiches de lecture réelles (hors stubs de redirection).
 *
 * Lit chaque candidat pour vérifier le frontmatter `type` : on skip les
 * stubs `type: redirect` (R1 — `Notes/Learnings/` ne contient que des
 * redirections vers les vraies fiches).
 */
export async function listReadingFiches(accessToken: string): Promise<DriveFileMeta[]> {
  const candidates = await searchDriveFiles(FICHES_QUERY);
  if (candidates.length === 0) return [];

  const real: DriveFileMeta[] = [];
  for (const file of candidates) {
    const read = await readFileById(accessToken, file.id);
    if (!read.success || !read.content) continue;
    const parsed = parseObsidianFile(read.content);
    const type = parsed.frontmatter?.fields.type;
    if (typeof type === 'string' && type.toLowerCase() === 'redirect') continue;
    real.push(file);
  }
  return real;
}

/**
 * Sélectionne et distille la citation du jour.
 *
 * @param dayOfYear Rang du jour Paris (déterministe — même citation tout le jour).
 * @returns DailyCitation ou null (aucune fiche / LLM en échec).
 */
export async function pickDailyCitation(
  dayOfYear: number,
): Promise<DailyCitation | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[morning-citation] Drive indisponible — pas de citation');
    return null;
  }

  const fiches = await listReadingFiches(accessToken);
  if (fiches.length === 0) {
    console.warn('[morning-citation] aucune fiche de lecture trouvée — pas de citation');
    return null;
  }

  // Sélection déterministe stable : tri par nom puis index par dayOfYear.
  const sorted = [...fiches].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const chosen = sorted[dayOfYear % sorted.length]!;
  const book = bookTitleFromFilename(chosen.name);

  const read = await readFileById(accessToken, chosen.id);
  if (!read.success || !read.content) {
    console.warn(
      `[morning-citation] lecture fiche "${chosen.name}" échouée : ${read.error ?? 'inconnu'}`,
    );
    return null;
  }

  // Tronquer le corps pour rester lean côté prompt (les fiches peuvent être longues).
  const body = parseObsidianFile(read.content).body.slice(0, 6000);

  // Distillation LLM (Flash). Si elle renvoie vide / échoue, on NE laisse PAS
  // tomber la citation : on extrait une ligne marquante directement de la fiche
  // (fallback déterministe) → une citation apparaît toujours quand la fiche a du
  // contenu.
  let llmText = '';
  try {
    const result = await callLLM({
      task: 'morning-citation',
      system:
        "Tu es l'assistant de Thomas. À partir d'une fiche de lecture, extrais UNE " +
        "citation marquante ou un insight clé, reformulé en 1 à 2 lignes maximum, " +
        'en français. Réponds UNIQUEMENT par la citation/insight, sans guillemets ' +
        'superflus, sans préambule, sans mention du titre du livre.',
      messages: [
        {
          role: 'user',
          content: `Fiche de lecture du livre « ${book} » :\n\n${body}`,
        },
      ],
      // 1200 (et non 400) : DeepSeek V4 peut consommer du budget en "réflexion"
      // → `content` vide à 400 (observé en prod run 7h du 26/05). Marge de sécurité.
      maxTokens: 1200,
      responseFormat: 'text',
    });
    llmText = result.text.trim();
  } catch (err) {
    console.warn(
      `[morning-citation] LLM échec : ${err instanceof Error ? err.message : String(err)} — fallback fiche`,
    );
  }

  if (llmText) return { text: llmText, book };

  // Fallback : première ligne marquante de la fiche.
  const fallback = extractFallbackLine(body);
  if (fallback) {
    console.warn('[morning-citation] LLM vide → fallback extraction fiche');
    return { text: fallback, book };
  }

  console.warn('[morning-citation] ni LLM ni fallback exploitable — pas de citation');
  return null;
}

/**
 * Extrait une ligne « citation » exploitable d'un corps de fiche markdown :
 * première ligne de prose substantielle (hors titres, puces vides, wikilinks
 * seuls, frontmatter déjà retiré). Nettoie les marqueurs markdown de début.
 */
export function extractFallbackLine(body: string): string | null {
  for (const raw of body.split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue; // titre
    line = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').replace(/^>\s*/, '');
    line = line.replace(/\*\*/g, '').replace(/^["'«»\s]+|["'«»\s]+$/g, '').trim();
    if (line.length < 15) continue; // trop court (puce vide, mot isolé)
    if (/^\[\[[^\]]+\]\]$/.test(line)) continue; // wikilink seul
    return line.length > 220 ? `${line.slice(0, 217).trimEnd()}…` : line;
  }
  return null;
}
