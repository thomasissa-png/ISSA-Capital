/**
 * Rendu markdown d'un CR — version allégée pour le webhook Next.js.
 *
 * Réutilise la logique de secretariat/src/server/services/cr-to-craft-mapper.ts
 * sans les dépendances Craft/SHA-256/etc.
 *
 * Source de vérité : docs/ia/secretariat-system-prompt.md Section 4.
 */

import type { CRDraft, Entite, Participant, TypeReunion } from './types';

export function entiteNomComplet(code: Entite): string {
  switch (code) {
    case 'IC':
      return 'ISSA Capital SAS';
    case 'GO':
      return 'Gradient One';
    case 'VI':
      return 'Versi Immobilier';
    case 'VV':
      return 'Versi Invest';
  }
}

export function typeReunionLibelle(code: TypeReunion): string {
  switch (code) {
    case 'dejeuner':
      return "Déjeuner d'affaires";
    case 'diner':
      return "Dîner d'affaires";
    case 'conseil':
      return 'Réunion de conseil';
    case 'appel':
      return 'Appel téléphonique / visioconférence';
    case 'interne':
      return 'Réunion interne';
    case 'visite-immo':
      return 'Visite immobilière';
    case 'signature-contrat':
      return 'Signature de contrat';
  }
}

export function dateFormatFr(iso: string): string {
  const parts = iso.split('-').map((s) => Number.parseInt(s, 10));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return iso;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatParticipants(participants: readonly Participant[]): string {
  return participants
    .map(
      (p) =>
        `- ${p.prenom} ${p.nom}, ${p.titre}, ${p.societe} (${p.qualite_relation})`,
    )
    .join('\n');
}

/**
 * Rend un CR en texte lisible pour Telegram (pas de markdown Craft,
 * juste un format clair et structuré pour lecture mobile).
 *
 * @param cr Le draft CR structuré
 * @param reference Référence séquentielle optionnelle (ex: "IC-CR-2026-0003").
 *   Si fournie, affichée dans l'en-tête du CR.
 */
export function renderCrForTelegram(cr: CRDraft, reference?: string): string {
  const lines: string[] = [];

  lines.push(`*COMPTE RENDU DE RÉUNION*`);
  if (reference) {
    lines.push(`*Réf.* ${reference}`);
  }
  lines.push('');
  lines.push(`*Entité* : ${entiteNomComplet(cr.entite)}`);
  lines.push(`*Date* : ${dateFormatFr(cr.date_reunion)}`);
  lines.push(`*Type* : ${typeReunionLibelle(cr.type_reunion)}`);
  lines.push(`*Lieu* : ${cr.lieu}`);
  if (cr.montant_ttc_eur !== null) {
    lines.push(`*Montant TTC* : ${cr.montant_ttc_eur} €`);
  }
  if (cr.etablissement_nom !== null) {
    lines.push(`*Établissement* : ${cr.etablissement_nom}`);
  }
  lines.push('');
  lines.push(`*Objet* : ${cr.objet}`);
  lines.push('');

  lines.push('*Participants* :');
  lines.push(formatParticipants(cr.participants));
  lines.push('');

  lines.push('---');
  lines.push('');

  lines.push("*1. Objet et lien avec l'intérêt social*");
  lines.push(cr.section_1_objet_art_39_1);
  lines.push('');

  lines.push('*2. Points abordés*');
  lines.push(cr.section_2_points_abordes);
  lines.push('');

  lines.push('*3. Décisions et conclusions*');
  lines.push(cr.section_3_decisions);
  lines.push('');

  if (cr.section_4_suites_a_donner !== null) {
    lines.push('*4. Suites à donner*');
    lines.push(cr.section_4_suites_a_donner);
    lines.push('');
  }

  // Annexes photographiques (si présentes)
  const annexes = cr.annexes_photographiques;
  if (annexes && annexes.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(`ANNEXES PHOTOGRAPHIQUES — ${annexes.length} photo${annexes.length > 1 ? 's' : ''} jointe${annexes.length > 1 ? 's' : ''}`);
    lines.push('');
    for (const annexe of annexes) {
      lines.push(`Photo ${annexe.numero} — ${annexe.legende}`);
    }
    lines.push('');
    lines.push(`Toutes prises par Thomas Issa, ${dateFormatFr(cr.date_reunion)}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `Établi par Thomas Issa, Président — ${entiteNomComplet(cr.entite)}`,
  );

  return lines.join('\n');
}

// ============================================================
// Rendu markdown Craft — format légal complet pour publication
// ============================================================

/**
 * Formate un timestamp ISO complet en français : "8 avril 2026 à 14:32 UTC".
 */
function dateTimeFormatFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const datePart = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${datePart} à ${hours}:${minutes} UTC`;
}

/**
 * Rend le markdown complet d'un CR au format légal pour publication Craft.
 *
 * Inclut frontmatter CONFIDENTIEL, header (référence, entité, participants),
 * body (sections 1-4), footer DGFiP (signature, horodatage, RGPD).
 *
 * Source de vérité : secretariat/src/server/services/cr-to-craft-mapper.ts
 * (même logique, adaptée sans dépendances Express/crypto).
 *
 * @param cr Le draft CR structuré
 * @param reference Référence séquentielle (ex: "IC-CR-2026-0003")
 * @param dateEtablissement Timestamp ISO de la publication
 */
export function renderCrForCraft(
  cr: CRDraft,
  reference: string,
  dateEtablissement: string,
): string {
  const sections: string[] = [];

  // Frontmatter classification
  sections.push('---');
  sections.push('classification: CONFIDENTIEL');
  sections.push('---');
  sections.push('');

  // Header
  sections.push('# COMPTE RENDU DE RÉUNION PROFESSIONNELLE');
  sections.push('');
  sections.push(`**Référence** : ${reference}`);
  sections.push(`**Entité** : ${entiteNomComplet(cr.entite)}`);
  sections.push(`**Date de la réunion** : ${dateFormatFr(cr.date_reunion)}`);
  sections.push(`**Date d'établissement** : ${dateTimeFormatFr(dateEtablissement)}`);
  sections.push(`**Type** : ${typeReunionLibelle(cr.type_reunion)}`);
  sections.push(`**Lieu** : ${cr.lieu}`);
  sections.push('**Classification** : CONFIDENTIEL — diffusion restreinte');
  sections.push('');
  sections.push('**Participants** :');
  sections.push(formatParticipants(cr.participants));
  sections.push('');
  sections.push('---');
  sections.push('');

  // Section 1 : Objet + Art. 39-1 CGI
  sections.push("## 1. Objet et lien avec l'intérêt social");
  sections.push('');
  sections.push(cr.section_1_objet_art_39_1);
  sections.push('');

  // Section 2 : Points abordés
  sections.push('## 2. Points abordés');
  sections.push('');
  sections.push(cr.section_2_points_abordes);
  sections.push('');

  // Section 3 : Décisions
  sections.push('## 3. Décisions et conclusions');
  sections.push('');
  sections.push(cr.section_3_decisions);
  sections.push('');

  // Section 4 : Suites à donner (conditionnelle)
  if (cr.section_4_suites_a_donner !== null) {
    sections.push('## 4. Suites à donner');
    sections.push('');
    sections.push(cr.section_4_suites_a_donner);
    sections.push('');
  }

  // Annexes photographiques (si présentes) — format liste (@design session 9 : pas de tableau)
  const annexes = cr.annexes_photographiques;
  if (annexes && annexes.length > 0) {
    const dateAnnexe = dateFormatFr(cr.date_reunion);
    sections.push('---');
    sections.push('');
    sections.push(`## Annexes photographiques — ${annexes.length} documents joints`);
    sections.push('');
    for (const annexe of annexes) {
      const fileRef = `${cr.entite}-CR-${cr.date_reunion}_photo_${String(annexe.numero).padStart(2, '0')}.jpg`;
      sections.push(`**Photo ${annexe.numero}** — ${annexe.legende}`);
      sections.push(`*Auteur : Thomas Issa — ${dateAnnexe} — Réf. fichier : ${fileRef}*`);
      sections.push('');
    }
    sections.push(
      `*Fichiers conservés dans la GED ${entiteNomComplet(cr.entite)}, dossier ${reference}, accès restreint Président.*`,
    );
    sections.push('');
  }

  // Footer DGFiP
  sections.push('---');
  sections.push('');
  sections.push(
    `En foi de quoi, le présent compte rendu a été établi et certifié exact par Thomas Issa, Président — ${entiteNomComplet(cr.entite)}.`,
  );
  sections.push('');
  sections.push(`**Horodaté le** : ${dateTimeFormatFr(dateEtablissement)}`);
  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push(
    `Ce document contient des données à caractère personnel traitées par ${entiteNomComplet(cr.entite)} conformément`,
  );
  sections.push(
    'au Règlement (UE) 2016/679 (RGPD). Finalité : documentation professionnelle et preuve fiscale',
  );
  sections.push(
    `(Art. 39-1 CGI). Conservation : 10 ans. Droits d'accès et de rectification : ${cr.entite === 'IC' ? 'contact@issa-capital.com' : 'contact@versi.fr'}.`,
  );
  sections.push('');
  sections.push(
    'Document établi à titre de justificatif interne — se reporter aux pièces comptables associées',
  );
  sections.push('(factures, notes de frais) pour la déductibilité fiscale.');

  return sections.join('\n');
}

/**
 * Construit le titre du document Craft.
 * Format : "CR {Type} — {Premier participant} — {Date}"
 *
 * @example "CR Déjeuner — Karim Benmoussa — 9 avril 2026"
 */
export function buildCraftTitle(cr: CRDraft): string {
  const typeName = typeReunionLibelle(cr.type_reunion);
  // Raccourcir le libellé du type (retirer "d'affaires", "téléphonique / visioconférence", etc.)
  const shortType = typeName
    .replace(" d'affaires", '')
    .replace(' téléphonique / visioconférence', '')
    .replace(' de contrat', '');

  const firstParticipant = cr.participants[0];
  const participantName = firstParticipant
    ? `${firstParticipant.prenom} ${firstParticipant.nom}`
    : 'Interne';

  const dateStr = dateFormatFr(cr.date_reunion);

  return `CR ${shortType} — ${participantName} — ${dateStr}`;
}
