/**
 * Orchestrateur d'enrichissement de fiche contact (S24).
 *
 * Quand Thomas accepte de créer une fiche pour un expéditeur inconnu (ou via la
 * commande `/enrichir`), ce module produit une fiche RICHE dès la création — pas
 * un stub. Pipeline :
 *   1. Rassemblement cross-boîtes (Gmail + Outlook Sarani + Versi).
 *   2. Parsing du nom via LLM (red-line « NOM, Prénom », codes MAJ → notes).
 *   3. Mapping domaine → société (domains.yml).
 *   4. Synthèse de l'historique (LLM, rôle/société/sujets/tél depuis signatures).
 *   5. Extraction signature : assurée en amont (excerpts head+tail capturent la
 *      signature en fin de mail), exploitée par la synthèse.
 *   6. Rendu de la fiche enrichie (frontmatter + Synthèse + Historique).
 *
 * Robustesse : si le scan ne trouve aucun email → `null` (l'appelant retombe
 * sur le stub mono-email). Ne throw jamais.
 */

import { gatherContactEmailsAllSources } from './cross-mailbox-gather';
import { parseContactName } from './name-parser';
import { lookupSocieteByEmail } from './domains';
import {
  synthesizeContactFiche,
  renderEnrichedFiche,
  type ContactFicheData,
} from '../telegram-validation/contact-fiche-synth';
import type { ContactType } from '../telegram-validation/no-match-card';

export interface EnrichContactInput {
  /** Email de l'expéditeur/contact (source du scan). */
  email: string;
  /** Nom vu dans le header From (peut être null). */
  nameFrom: string | null;
  /** Type de contact choisi (pilote la catégorie frontmatter). */
  type: ContactType;
  /** Date du jour (YYYY-MM-DD). */
  today: string;
  /** Référence du thread email d'origine (1re ligne d'historique). */
  emailThreadRef: string;
}

export interface EnrichContactResult {
  displayName: string;
  /** Markdown complet de la fiche enrichie. */
  content: string;
  /** Données synthétisées (pour la carte preview Telegram). */
  data: ContactFicheData;
  /** Sources ayant contribué (gmail, outlook:sarani…). */
  sources: string[];
  /** Nombre d'emails analysés. */
  scanned: number;
}

/**
 * Produit une fiche contact enrichie, ou `null` si rien à enrichir (scan vide).
 * Ne throw jamais : toute défaillance partielle dégrade gracieusement.
 */
export async function enrichContact(
  input: EnrichContactInput,
): Promise<EnrichContactResult | null> {
  try {
    // 1. Rassemblement cross-boîtes.
    const { emails, scanned, sources } = await gatherContactEmailsAllSources(input.email);
    if (emails.length === 0) {
      return null;
    }

    // 5. Indice signature : extrait du mail reçu le plus récent (head+tail inclut
    //    déjà la signature en fin de corps).
    const signatureHint = emails.find((e) => e.direction === 'from')?.excerpt ?? '';

    // 2 + 4 en parallèle (parsing nom & synthèse historique).
    const [parsedName, synth] = await Promise.all([
      parseContactName(input.nameFrom, input.email, signatureHint),
      synthesizeContactFiche({
        senderEmail: input.email,
        nameFrom: input.nameFrom,
        type: input.type,
        emails,
        emailThreadRef: input.emailThreadRef,
      }),
    ]);

    // 3. Société par domaine (fallback si la synthèse n'a rien trouvé).
    const domainSociete = lookupSocieteByEmail(input.email);

    // Fusion : le nom parsé prime sur le nom synthétisé ; la société synthétisée
    // prime sur celle déduite du domaine (plus spécifique).
    const data: ContactFicheData = { ...(synth ?? {}) };
    if (parsedName?.displayName) data.nomComplet = parsedName.displayName;
    if (parsedName?.notes) data.nameNotes = parsedName.notes;
    if (!data.societe && domainSociete) data.societe = domainSociete;

    // 6. Rendu de la fiche.
    const rendered = renderEnrichedFiche(
      data,
      {
        senderEmail: input.email,
        nameFrom: input.nameFrom,
        type: input.type,
        today: input.today,
        emailThreadRef: input.emailThreadRef,
        sources,
      },
      scanned,
    );

    return {
      displayName: rendered.displayName,
      content: rendered.content,
      data,
      sources,
      scanned,
    };
  } catch (err) {
    console.warn(
      `[contact-enrich] échec enrichissement ${input.email} : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Construit un court récapitulatif des champs enrichis pour la carte Telegram
 * (preview). Vide si rien d'exploitable.
 */
export function buildEnrichPreviewLines(data: ContactFicheData): string[] {
  const lines: string[] = [];
  if (data.role) lines.push(`\u{2022} Rôle : ${data.role}`);
  if (data.societe) lines.push(`\u{2022} Société : ${data.societe}`);
  if (data.telephone) lines.push(`\u{2022} Tél : ${data.telephone}`);
  if (data.autreEmail) lines.push(`\u{2022} Autre email : ${data.autreEmail}`);
  if (data.sujets && data.sujets.length > 0) {
    lines.push(`\u{2022} Sujets : ${data.sujets.slice(0, 3).join(', ')}`);
  }
  if (data.nameNotes) lines.push(`\u{2022} Note nom : ${data.nameNotes}`);
  return lines;
}
