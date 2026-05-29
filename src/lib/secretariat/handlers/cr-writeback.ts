/**
 * Handler write-back CR → fiche Projet vault.
 *
 * Pipeline asynchrone (décision Thomas S15) :
 *   1. CR uploadé dans le dossier Drive de l'entité (IC/GO/VI/VV)
 *   2. (Hors scope ici) Inbox vault notifiée
 *   3. Ce handler s'exécute pour append le lien CR dans la fiche Projet vault
 *
 * Comportement :
 *   - Lookup fiche Projet via vault-reader live (R7 — pas de fileId hardcodé,
 *     résolution par nom canonique dans `02. Projets/02. Pro/`).
 *   - Lecture live via readFileById (vault-reader sait déjà l'identifier)
 *   - Parse markdown : trouve/crée section "## Comptes Rendus"
 *   - Append ligne : `- [YYYY-MM-DD] [Titre CR](webViewLink)`
 *   - Idempotence : skip si le webViewLink est déjà présent
 *   - PATCH in-place via updateFileContent (R5 P0 #99 — JAMAIS create+delete)
 *
 * Jalon S16 Q3. Migration R7 hardcoded → vault-reader live : S17.
 */

import { updateFileContent, getAccessToken } from '../drive-upload';
import { readFileById } from '../vault-client/obsidian-file';
import { findProjetFicheByEntite } from '../vault-reader';
import { sendTelegramMessage } from '../telegram';
import { appendPending } from './cr-writeback-pending';

// ============================================================
// Constantes
// ============================================================

const SECTION_HEADING = '## Comptes Rendus';

// ============================================================
// Types
// ============================================================

export interface CrWritebackInput {
  /** Code entité : IC | GO | VI | VV */
  entiteCode: string;
  /** fileId Drive du PDF CR (pour traçabilité, non utilisé pour le link) */
  crFileId: string;
  /** Nom de fichier du PDF (pour fallback titre si crTitle absent) */
  crFilename: string;
  /** Lien Google Drive webViewLink du PDF — utilisé dans le markdown */
  crWebViewLink: string;
  /** Date du CR au format YYYY-MM-DD */
  crDate: string;
  /** Titre du CR (sujet de la réunion) */
  crTitle: string;
}

export interface CrWritebackResult {
  success: boolean;
  /** true si la fiche a été modifiée (false si skip idempotence) */
  modified: boolean;
  /** fileId de la fiche Projet patchée */
  ficheFileId?: string;
  /** Section créée (true) ou append à l'existante (false) */
  sectionCreated?: boolean;
  error?: string;
}

// ============================================================
// Helpers internes
// ============================================================

/**
 * Formate la ligne markdown pour le CR.
 * Format : `- [YYYY-MM-DD] [Titre](webViewLink)`
 */
function formatCrLine(date: string, title: string, link: string): string {
  return `- [${date}] [${title}](${link})`;
}

/**
 * Ajoute ou met à jour la section "## Comptes Rendus" dans un body markdown.
 *
 * Comportement :
 *   - Section absente : crée la section à la fin du fichier (séparée par 2 \n)
 *   - Section présente : append la ligne juste après le heading (pas en fin de section
 *     pour rester déterministe et éviter de toucher le contenu utilisateur en bas)
 *
 * @returns { newBody, sectionCreated } — newBody = nouveau contenu, sectionCreated = true si on a créé la section
 */
export function upsertCrSection(
  body: string,
  crLine: string,
): { newBody: string; sectionCreated: boolean } {
  // Regex section : "## Comptes Rendus" en début de ligne, optionnellement précédé d'espaces
  const sectionRegex = new RegExp(`^${SECTION_HEADING}\\s*$`, 'm');
  const match = sectionRegex.exec(body);

  if (!match) {
    // Section absente → créer en fin de fichier
    const trimmed = body.replace(/\s+$/, '');
    const newBody = `${trimmed}\n\n${SECTION_HEADING}\n\n${crLine}\n`;
    return { newBody, sectionCreated: true };
  }

  // Section présente → insérer la ligne juste après le heading
  const headingEnd = match.index + match[0].length;
  // Trouver la fin de la ligne de heading (le \n suivant)
  const afterHeading = body.indexOf('\n', headingEnd);
  const insertPos = afterHeading === -1 ? body.length : afterHeading + 1;

  // Si une ligne vide suit le heading, on insère après. Sinon on ajoute un \n avant.
  const charAfter = body.charAt(insertPos);
  const prefix = charAfter === '\n' || charAfter === '' ? '' : '';

  const newBody =
    body.slice(0, insertPos) +
    `${crLine}\n${prefix}` +
    body.slice(insertPos);

  return { newBody, sectionCreated: false };
}

// ============================================================
// API publique
// ============================================================

/**
 * Write-back d'un CR vers la fiche Projet vault correspondante.
 *
 * Idempotent : si le crWebViewLink est déjà présent dans le fichier, ne modifie rien.
 *
 * @param input Métadonnées du CR à référencer
 * @returns CrWritebackResult
 */
export async function writeBackCrToFiche(
  input: CrWritebackInput,
): Promise<CrWritebackResult> {
  // Validation inputs
  if (!input.entiteCode) {
    return { success: false, modified: false, error: 'entiteCode manquant' };
  }
  if (!input.crWebViewLink) {
    return { success: false, modified: false, error: 'crWebViewLink manquant' };
  }
  if (!input.crDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.crDate)) {
    return {
      success: false,
      modified: false,
      error: `crDate invalide (attendu YYYY-MM-DD, reçu "${input.crDate}")`,
    };
  }

  // Lookup fiche Projet — résolution dynamique via vault-reader (R7)
  const fiche = await findProjetFicheByEntite(input.entiteCode);
  if (!fiche) {
    // S25 (2026-05-29) : alerte Telegram explicite à Thomas. Avant : skip
    // silencieux côté log, le CR write-back vers la fiche Projet disparaissait
    // sans qu'aucun signal n'arrive à Thomas (audit reviewer 29/05 P0-6).
    // Le CR principal (PDF Drive) reste préservé — le write-back fiche est
    // un enrichissement non-bloquant, mais doit être traçable.
    console.warn(
      `[cr-writeback] fiche Projet non trouvée pour entité ${input.entiteCode} — write-back skip + alerte Telegram`,
    );
    const chatIdRaw = process.env.TELEGRAM_CHAT_ID_THOMAS;
    const chatId = chatIdRaw ? parseInt(chatIdRaw, 10) : NaN;
    if (chatIdRaw && Number.isFinite(chatId)) {
      try {
        // P1-A (review S25) : texte brut, pas de tags HTML. sendTelegramMessage
        // n'envoie pas de parse_mode → les <b>/<code> s'affichaient en littéral.
        await sendTelegramMessage(
          chatId,
          `⚠️ CR write-back fiche Projet introuvable\n\n` +
            `Entité : ${input.entiteCode}\n` +
            `CR : ${input.crFilename ?? '(sans nom)'}\n` +
            `Lien : ${input.crWebViewLink}\n\n` +
            `Le PDF du CR est sauvegardé, mais la ligne d'historique ` +
            `"## Comptes Rendus" n'a PAS été ajoutée car aucune fiche Projet ` +
            `n'a été trouvée pour ce code entité. ` +
            `Action : créer/renommer la fiche, puis re-trigger le write-back via le webhook.`,
        );
      } catch (err) {
        console.warn(
          `[cr-writeback] échec envoi alerte Telegram : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // S25 (reprise secrétariat, P0 #1) : EN PLUS de l'alerte Telegram, on
    // persiste un pending. Un cron (cron-cr-writeback-retry) rejoue toutes
    // les 2h, max 3 fois. L'échec de persistance ne change PAS le résultat
    // retourné (l'alerte reste la trace primaire pour Thomas).
    try {
      await appendPending({
        entiteCode: input.entiteCode,
        crFileId: input.crFileId,
        crWebViewLink: input.crWebViewLink,
        crFilename: input.crFilename,
        crDate: input.crDate,
        crTitle: input.crTitle,
      });
    } catch (err) {
      console.warn(
        `[cr-writeback] échec persistance pending : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return {
      success: false,
      modified: false,
      error: `Fiche Projet non trouvée pour entité "${input.entiteCode}" (vault-reader)`,
    };
  }

  const ficheFileId = fiche.fileId;

  // Lecture fiche live (pas via cache — on veut la version la plus à jour pour le PATCH)
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      modified: false,
      ficheFileId,
      error: 'Credentials OAuth2 manquants pour lire la fiche Projet',
    };
  }

  const readResult = await readFileById(accessToken, ficheFileId);
  if (!readResult.success || readResult.content === undefined) {
    return {
      success: false,
      modified: false,
      ficheFileId,
      error: `Lecture fiche Projet échouée : ${readResult.error ?? 'contenu vide'}`,
    };
  }

  const currentContent = readResult.content;

  // Idempotence : skip si le webViewLink est déjà présent
  if (currentContent.includes(input.crWebViewLink)) {
    return {
      success: true,
      modified: false,
      ficheFileId,
    };
  }

  // Titre fallback : crTitle ou crFilename sans extension
  const title = input.crTitle?.trim() || input.crFilename.replace(/\.pdf$/i, '');
  const crLine = formatCrLine(input.crDate, title, input.crWebViewLink);

  // Upsert section
  const { newBody, sectionCreated } = upsertCrSection(currentContent, crLine);

  // PATCH in-place (R5 P0 #99)
  const patchResult = await updateFileContent(
    ficheFileId,
    newBody,
    'text/markdown',
  );

  if (!patchResult.success) {
    return {
      success: false,
      modified: false,
      ficheFileId,
      error: `PATCH fiche Projet échoué : ${patchResult.error ?? 'erreur inconnue'}`,
    };
  }

  // Note : pas d'invalidation cache vault-reader ici — l'invalidation est par
  // (folderPath, filename), pas par fileId. La fiche Projet est lue ici en direct
  // (pas via vault-reader), donc pas de cache à invalider côté écriture.
  // Si un autre module lit la fiche via vault-reader, le TTL 1h s'applique.

  return {
    success: true,
    modified: true,
    ficheFileId,
    sectionCreated,
  };
}

// ============================================================
// Exports pour tests
// ============================================================

export const _internals = {
  SECTION_HEADING,
  formatCrLine,
  upsertCrSection,
};
