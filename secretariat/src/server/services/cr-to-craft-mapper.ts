/**
 * Mapper CR → payload Craft (Phase 4).
 *
 * Transforme un `CRDraft` (JSON validé par Zod, produit par Phase 3) en
 * un `CraftDocumentPayload` prêt à pousser sur l'API Craft.
 *
 * Source de vérité format markdown :
 *   - `docs/ia/secretariat-system-prompt.md` Section 4 (template canonique)
 *   - `docs/BRIEF_CLAUDE_CODE_SECRETARIAT_ISSA.md` section "FORMAT MARKDOWN À
 *     PUBLIER DANS CRAFT" (format alternatif avec tableau metadata)
 *   - `docs/legal/secretariat-agent-legal-audit.md` Bloc 6 (footer + mention
 *     Art. 39-1 CGI obligatoire, classification CONFIDENTIEL)
 *
 * Choix d'implémentation :
 *  - Le template retenu est celui de `secretariat-system-prompt.md` Section 4
 *    (plus complet, validé par @legal, avec footer RGPD + DGFiP).
 *  - L'horodatage RFC 3161 est un PLACEHOLDER en Phase 4 (Phase 6 l'activera).
 *  - La signature PNG est un PLACEHOLDER en Phase 4 (upload via admin Phase 5).
 *  - Les helpers de formatage sont locaux à ce fichier (pas de lib externe).
 *
 * Fonction pure : aucun I/O, aucun appel externe. 100% déterministe pour
 * faciliter les tests unitaires.
 */

import { createHash } from 'node:crypto';

import type { CRDraft, Entite, Participant, TypeReunion } from './anthropic.types';
import type { CraftDocumentPayload } from './craft.types';

// ============================================================
// Helpers de formatage (purs, testables isolément)
// ============================================================

/**
 * Mappe un code entité vers son nom complet légal.
 * Source : docs/ia/secretariat-system-prompt.md Section 6 + project-context.
 */
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

/**
 * Mappe un code type de réunion vers son libellé français.
 */
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

/**
 * Mappe un code type de réunion vers son slug (kebab-case) pour le filename.
 * Source : convention nommage @moi (architecture §8.5).
 */
export function typeReunionSlug(code: TypeReunion): string {
  // Les valeurs du Zod enum sont déjà en kebab-case → on les réutilise telles
  // quelles. "dejeuner", "visite-immo", "signature-contrat", etc.
  return code;
}

/**
 * Formate une date ISO YYYY-MM-DD en français long : "8 avril 2026".
 * Utilise Intl.DateTimeFormat natif Node pour éviter toute dépendance.
 */
export function dateFormatFr(iso: string): string {
  // On construit la date en UTC pour éviter les dérives de timezone —
  // l'input est YYYY-MM-DD sans timezone, on le traite comme calendrier civil.
  const [year, month, day] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return iso; // fallback si format inattendu
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Formate un timestamp ISO complet en français : "8 avril 2026 à 14:32 UTC".
 */
export function dateTimeFormatFr(iso: string): string {
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
 * Formate la liste des participants au format légal (un par ligne).
 *  "- Prénom Nom, Titre, Société (qualité_relation)"
 */
export function formatParticipants(participants: readonly Participant[]): string {
  return participants
    .map(
      (p) =>
        `- ${p.prenom} ${p.nom}, ${p.titre}, ${p.societe} (${p.qualite_relation})`,
    )
    .join('\n');
}

/**
 * Génère le slug interlocuteur pour le filename.
 * - Prénom + nom du premier participant
 * - Minuscules, accents retirés, espaces → tirets
 * - Filtre les caractères non alphanumériques ou tiret
 */
export function participantSlug(participant: Participant): string {
  const raw = `${participant.prenom} ${participant.nom}`;
  // Retire les accents via normalisation Unicode NFD
  const noAccents = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Construit le filename selon la convention @moi :
 *   YYYY-MM-DD-[type]-[entite]-[interlocuteur_slug].md
 * Exemple : 2026-04-08-dejeuner-IC-karim-benmoussa.md
 */
export function buildCraftFilename(cr: CRDraft): string {
  const firstParticipant = cr.participants[0];
  if (firstParticipant === undefined) {
    // participants.min(1) garanti par Zod — ce cas ne peut pas arriver,
    // mais on garde un fallback défensif.
    return `${cr.date_reunion}-${typeReunionSlug(cr.type_reunion)}-${cr.entite}-interne.md`;
  }
  const slug = participantSlug(firstParticipant);
  const fallbackSlug = slug.length > 0 ? slug : 'interne';
  return `${cr.date_reunion}-${typeReunionSlug(cr.type_reunion)}-${cr.entite}-${fallbackSlug}.md`;
}

// ============================================================
// Rendu markdown complet
// ============================================================

/**
 * Assemble le markdown final du CR.
 * Inclut frontmatter CONFIDENTIEL, header, body (sections 1-4), footer DGFiP.
 *
 * Section 4 est OMISE si `section_4_suites_a_donner` est null
 * (cf test case 4 du system prompt — "Section 4 OMISE entièrement").
 */
export function renderCrMarkdown(params: {
  cr: CRDraft;
  reference: string;
  dateEtablissement: string; // ISO timestamp complet
  signaturePngUrl?: string;
  rfc3161Token?: string;
}): string {
  const { cr, reference, dateEtablissement } = params;
  const signatureUrl = params.signaturePngUrl ?? '[signature à uploader via admin]';
  const rfc3161 = params.rfc3161Token ?? '[non horodaté — Phase 6]';

  const sections: string[] = [];

  // --- Frontmatter classification ---
  sections.push('---');
  sections.push('classification: CONFIDENTIEL');
  sections.push('---');
  sections.push('');

  // --- Header ---
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

  // --- Section 1 : Objet + Art. 39-1 CGI ---
  sections.push("## 1. Objet et lien avec l'intérêt social");
  sections.push('');
  sections.push(cr.section_1_objet_art_39_1);
  sections.push('');

  // --- Section 2 : Points abordés ---
  sections.push('## 2. Points abordés');
  sections.push('');
  sections.push(cr.section_2_points_abordes);
  sections.push('');

  // --- Section 3 : Décisions ---
  sections.push('## 3. Décisions et conclusions');
  sections.push('');
  sections.push(cr.section_3_decisions);
  sections.push('');

  // --- Section 4 : Suites à donner (CONDITIONNELLE) ---
  if (cr.section_4_suites_a_donner !== null) {
    sections.push('## 4. Suites à donner');
    sections.push('');
    sections.push(cr.section_4_suites_a_donner);
    sections.push('');
  }

  // --- Footer DGFiP ---
  sections.push('---');
  sections.push('');
  sections.push(
    `En foi de quoi, le présent compte rendu a été établi et certifié exact par Thomas Issa, Président — ${entiteNomComplet(cr.entite)}.`,
  );
  sections.push('');
  sections.push(`![Signature Thomas Issa](${signatureUrl})`);
  sections.push('');
  sections.push(`**Horodaté le** : ${dateTimeFormatFr(dateEtablissement)}`);
  sections.push(`**Token RFC 3161** : \`${rfc3161}\``);
  sections.push('**Provider** : Universign');
  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push(
    'Ce document contient des données à caractère personnel traitées par ISSA Capital SAS conformément',
  );
  sections.push(
    'au Règlement (UE) 2016/679 (RGPD). Finalité : documentation professionnelle et preuve fiscale',
  );
  sections.push(
    "(Art. 39-1 CGI). Conservation : 10 ans. Droits d'accès et de rectification : dpo@issa-capital.com.",
  );
  sections.push('');
  sections.push(
    'Document établi à titre de justificatif interne — se reporter aux pièces comptables associées',
  );
  sections.push('(factures, notes de frais) pour la déductibilité fiscale.');

  return sections.join('\n');
}

// ============================================================
// Mapping principal : CR → CraftDocumentPayload
// ============================================================

export interface MapCrToCraftInput {
  cr: CRDraft;
  draftId: string;
  reference: string;
  dateEtablissement: string; // ISO timestamp
  userPhone: string;
}

/**
 * Transforme un CR draft validé en payload Craft prêt à publier.
 *
 * Calcule le SHA-256 du markdown final pour preuve d'intégrité DGFiP
 * (stocké en `cr_published.markdown_sha256`).
 */
export function mapCrToCraftPayload(input: MapCrToCraftInput): CraftDocumentPayload {
  const { cr, draftId, reference, dateEtablissement, userPhone } = input;

  const markdown = renderCrMarkdown({
    cr,
    reference,
    dateEtablissement,
  });

  const markdownSha256 = createHash('sha256').update(markdown, 'utf8').digest('hex');

  return {
    markdown,
    position: { position: 'end' },
    internalTitle: buildCraftFilename(cr),
    internalMetadata: {
      draftId,
      reference,
      entite: cr.entite,
      typeReunion: cr.type_reunion,
      dateReunion: cr.date_reunion,
      userPhone,
      markdownSha256,
    },
  };
}
