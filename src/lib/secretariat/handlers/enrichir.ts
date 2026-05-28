/**
 * Commande Telegram `/enrichir <nom>` (S24).
 *
 * Enrichit À LA DEMANDE une fiche contact EXISTANTE : scanne les 3 boîtes,
 * synthétise, et complète les champs frontmatter VIDES (société, rôle,
 * téléphone). Affiche à Thomas ce qui a été trouvé.
 *
 * 🔒 IDEMPOTENT & NON DESTRUCTIF : ne remplace JAMAIS un champ déjà renseigné
 * (Thomas a pu corriger la fiche à la main), ne réécrit pas le corps, n'ajoute
 * pas d'historique. Relancer la commande ne fait que re-remplir d'éventuels
 * champs encore vides → no-op si tout est déjà rempli.
 */

import { getVaultContacts, type VaultContact } from '../vault-contacts';
import { enrichContact, buildEnrichPreviewLines } from '../contact-enrich';
import {
  updateFrontmatter,
  readFile,
  writeFile,
  insertH2SectionBefore,
} from '../vault-client';
import { sendTelegramMessage } from '../telegram';
import type { ContactType } from '../telegram-validation/no-match-card';

/** Marques diacritiques combinantes (U+0300–U+036F) — décomposées par NFD. */
const DIACRITICS_RE = /[̀-ͯ]/g;

/** Normalise pour comparaison floue : minuscule, sans accents, espaces simples. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fullName(c: VaultContact): string {
  return `${c.prenom} ${c.nom}`.trim();
}

/**
 * Cherche les contacts dont le nom matche la requête (prénom, nom, ou complet ;
 * tolère casse + accents ; match par sous-chaîne dans les deux sens).
 */
export function matchContacts(contacts: VaultContact[], query: string): VaultContact[] {
  const q = normalize(query);
  if (!q) return [];
  return contacts.filter((c) => {
    const full = normalize(fullName(c));
    const prenom = normalize(c.prenom);
    const nom = normalize(c.nom);
    return (
      full === q ||
      full.includes(q) ||
      q.includes(full) ||
      prenom === q ||
      nom === q ||
      (q.length >= 3 && (prenom.includes(q) || nom.includes(q)))
    );
  });
}

function categorieToType(categorie?: string): ContactType {
  switch ((categorie ?? '').toLowerCase()) {
    case 'famille':
      return 'famille';
    case 'amis':
      return 'amis';
    case 'autres':
      return 'autres';
    default:
      return 'pro';
  }
}

/**
 * Traite `/enrichir <nom>`. Ne throw jamais (répond toujours à Thomas).
 */
export async function handleEnrichirCommand(chatId: number, query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    await sendTelegramMessage(
      chatId,
      'Usage : `/enrichir <nom>` — ex : `/enrichir Marc Gernot`.',
    );
    return;
  }

  let contacts: VaultContact[];
  try {
    contacts = await getVaultContacts();
  } catch (err) {
    await sendTelegramMessage(
      chatId,
      `Impossible de lire les contacts du vault : ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  const matches = matchContacts(contacts, trimmed);

  if (matches.length === 0) {
    await sendTelegramMessage(chatId, `Aucune fiche contact ne correspond à « ${trimmed} ».`);
    return;
  }
  if (matches.length > 1) {
    const list = matches
      .slice(0, 8)
      .map((c) => `\u{2022} ${fullName(c)}${c.email ? ` <${c.email}>` : ''}`)
      .join('\n');
    await sendTelegramMessage(
      chatId,
      `Plusieurs fiches correspondent à « ${trimmed} ». Précise :\n${list}`,
    );
    return;
  }

  const contact = matches[0]!;
  const name = fullName(contact);

  if (!contact.email) {
    await sendTelegramMessage(
      chatId,
      `La fiche « ${name} » n'a pas d'email — impossible de scanner les boîtes. Ajoute l'email puis relance.`,
    );
    return;
  }
  if (!contact.folderPath || !contact.filename) {
    await sendTelegramMessage(
      chatId,
      `Impossible de localiser le fichier de « ${name} » dans le vault.`,
    );
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const enriched = await enrichContact({
    email: contact.email,
    nameFrom: name,
    type: categorieToType(contact.categorie),
    today,
    emailThreadRef: '',
  });

  if (!enriched) {
    await sendTelegramMessage(
      chatId,
      `Aucun email trouvé pour « ${name} » <${contact.email}> dans les 3 boîtes — rien à enrichir.`,
    );
    return;
  }

  // Remplit UNIQUEMENT les champs frontmatter vides (non destructif, idempotent).
  const fields: Record<string, string> = {};
  if (!contact.societe && enriched.data.societe) fields['societe'] = enriched.data.societe;
  if (!contact.titre && enriched.data.role) fields['role'] = enriched.data.role;
  if (!contact.telephone && enriched.data.telephone) fields['telephone'] = enriched.data.telephone;

  let updated = false;
  if (Object.keys(fields).length > 0) {
    updated = await updateFrontmatter({
      folderPath: contact.folderPath,
      filename: contact.filename,
      fields,
      trigger: `enrichir:${name}`,
    });
  }

  // S25.1 — Aligne la fiche existante sur le template `Contact pro.md` v3 :
  // insère une section `## Statut courant` vide juste avant `## Synthèse` si absente.
  // Idempotent (helper `insertH2SectionBefore` no-op si la section existe déjà,
  // même si Thomas a mis du contenu). Fail-safe : ne fait rien si `## Synthèse` absent.
  let statutSectionInserted = false;
  try {
    const read = await readFile(contact.folderPath, contact.filename);
    if (read.success && read.content) {
      const patched = insertH2SectionBefore(
        read.content,
        'Statut courant',
        'Synthèse',
        '_À renseigner._',
      );
      if (patched !== read.content) {
        const write = await writeFile(contact.folderPath, contact.filename, patched);
        statutSectionInserted = write.success;
      }
    }
  } catch (err) {
    // Non bloquant : on log et on continue (le récap Telegram signale juste l'échec).
    console.warn(
      `[enrichir] insertion ## Statut courant KO pour ${name} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Récapitulatif à Thomas.
  const previewLines = buildEnrichPreviewLines(enriched.data);
  const lines: string[] = [`\u{1F50D} Enrichissement « ${name} »`];
  if (previewLines.length > 0) {
    lines.push('', 'Trouvé :', ...previewLines);
  } else {
    lines.push('', 'Aucune info clé extraite des emails.');
  }
  const filled = Object.keys(fields);
  if (filled.length > 0) {
    lines.push(
      '',
      updated
        ? `\u{2705} Champs complétés : ${filled.join(', ')}`
        : `\u{26A0}\u{FE0F} Échec MAJ frontmatter (${filled.join(', ')}).`,
    );
  } else {
    lines.push('', 'Champs frontmatter déjà renseignés — rien à compléter.');
  }
  if (statutSectionInserted) {
    lines.push('\u{2795} Section « Statut courant » ajoutée (vide).');
  }
  lines.push(`\u{1F4E5} ${enriched.scanned} email(s) — ${enriched.sources.join(', ') || 'aucune source'}`);

  await sendTelegramMessage(chatId, lines.join('\n'));
}
