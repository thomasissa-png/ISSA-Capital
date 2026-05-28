/**
 * Write-back CR → fiches CONTACT des participants (S24).
 *
 * Quand un CR est validé puis uploadé sur Drive, on en référence aussi le lien
 * dans l'historique de chaque fiche contact participant — symétriquement à ce
 * que `cr-writeback.ts` fait pour la fiche Projet.
 *
 * Pourquoi : un CR (dicté vocal, réunion improvisée…) n'a pas forcément
 * d'invitation Calendar associée → sans cette étape, les fiches participants ne
 * « savent » pas qu'il y a eu cette réunion (et `canal_préféré` / `fréquence_
 * échanges` sous-comptent les rencontres réelles).
 *
 * Matching : déterministe par nom (`prenom + nom` du participant CR → fiche
 * via `matchContacts`, recherche floue accents/casse, comme `/enrichir`).
 * Idempotent : skip si le lien CR est déjà dans la fiche (relance sans dégâts).
 *
 * Best-effort : un participant non matché / ambigu → log seulement, jamais
 * d'invention de fiche. Une erreur sur une fiche ne bloque pas les autres.
 */

import type { Participant } from '../types';
import { getVaultContacts, type VaultContact } from '../vault-contacts';
import { matchContacts } from './enrichir';
import { appendToHistorique } from '../vault-client';
import { readFile } from '../vault-client/obsidian-file';

export interface CrContactWritebackInput {
  /** Liste des participants (déjà validée par Thomas dans le CR). */
  participants: readonly Participant[];
  /** Date de la réunion `YYYY-MM-DD`. */
  crDate: string;
  /** Titre Craft du CR (sert au titre de la ligne d'historique). */
  crTitle: string;
  /** Lien Drive vers le PDF du CR. */
  crWebViewLink: string;
  /** Nom de fichier PDF (pour le trigger audit). */
  crFilename: string;
  /** Code entité projet (IC/GO/VI/VM/VV/IM) — note de contexte. */
  entiteCode: string;
}

export interface CrContactWritebackResult {
  enriched: number;
  notMatched: string[];
  ambiguous: string[];
  skippedIdempotent: number;
  errors: number;
}

function buildContactHistoryContent(
  p: Participant,
  input: CrContactWritebackInput,
): { title: string; content: string } {
  const title = `${input.crDate} — Réunion : ${input.crTitle}`;
  const lines: string[] = [
    `[Compte rendu PDF](${input.crWebViewLink}) — projet ${input.entiteCode}`,
  ];
  if (p.qualite_relation) {
    lines.push(`Rôle : ${p.qualite_relation}`);
  }
  if (p.societe) {
    lines.push(`Société : ${p.societe}`);
  }
  return { title, content: lines.join('\n') };
}

/**
 * Référence le CR dans la fiche historique de chaque participant matché.
 * Ne throw jamais. Statistiques en retour.
 */
export async function writeBackCrToContacts(
  input: CrContactWritebackInput,
): Promise<CrContactWritebackResult> {
  const result: CrContactWritebackResult = {
    enriched: 0,
    notMatched: [],
    ambiguous: [],
    skippedIdempotent: 0,
    errors: 0,
  };

  let contacts: VaultContact[];
  try {
    contacts = await getVaultContacts();
  } catch (err) {
    console.warn(
      `[cr-contact-writeback] chargement contacts KO : ${err instanceof Error ? err.message : String(err)}`,
    );
    result.errors++;
    return result;
  }

  for (const p of input.participants) {
    const fullName = `${p.prenom} ${p.nom}`.trim();
    if (!fullName) {
      continue;
    }
    try {
      const matches = matchContacts(contacts, fullName);
      if (matches.length === 0) {
        result.notMatched.push(fullName);
        console.warn(
          `[cr-contact-writeback] aucune fiche pour « ${fullName} » — skip (R2 : zéro invention)`,
        );
        continue;
      }
      if (matches.length > 1) {
        result.ambiguous.push(fullName);
        console.warn(
          `[cr-contact-writeback] ${matches.length} fiches matchent « ${fullName} » — skip (ambigu)`,
        );
        continue;
      }
      const c = matches[0]!;
      if (!c.folderPath || !c.filename) {
        // Fiche sans chemin résolu — improbable mais défense en profondeur.
        result.notMatched.push(fullName);
        continue;
      }

      // Idempotence : si la fiche contient déjà le lien CR, on saute.
      const read = await readFile(c.folderPath, c.filename);
      if (read.success && read.content && read.content.includes(input.crWebViewLink)) {
        result.skippedIdempotent++;
        continue;
      }

      const { title, content } = buildContactHistoryContent(p, input);
      const ok = await appendToHistorique(c.folderPath, c.filename, {
        title,
        content,
        trigger: `cr-writeback:contact:${input.crFilename}`,
        // S24 : déclenche aussi la mise à jour de date_derniere_interaction,
        // canal_préféré et fréquence_échanges (réunion comptée).
        updateLastInteraction: true,
      });
      if (ok) {
        result.enriched++;
      } else {
        result.errors++;
      }
    } catch (err) {
      result.errors++;
      console.warn(
        `[cr-contact-writeback] erreur pour « ${fullName} » : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
