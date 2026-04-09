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
 */
export function renderCrForTelegram(cr: CRDraft): string {
  const lines: string[] = [];

  lines.push(`*COMPTE RENDU DE RÉUNION*`);
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

  lines.push('---');
  lines.push(
    `Établi par Thomas Issa, Président — ${entiteNomComplet(cr.entite)}`,
  );

  return lines.join('\n');
}
