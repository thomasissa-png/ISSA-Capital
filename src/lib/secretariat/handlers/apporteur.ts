/**
 * Handler email-ingest : apporteur.
 *
 * Gère les emails identifiés comme provenant d'un apporteur d'affaires.
 * Extrait les informations bien (adresse, prix, surface, rendement)
 * via regex depuis le corps de l'email, puis crée une fiche bien stub
 * dans le dossier Opportunités.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §4.
 * Fix Jalon 4D-1 : path corrigé vers VAULT_PATHS.opportunitesApporteurs.
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';
import {
  VAULT_PATHS,
  slugifyVaultFilename,
  buildEmailRef,
  buildHistoriqueTitle,
  EM_DASH,
} from './vault-paths';

// ============================================================
// Handler principal
// ============================================================

/**
 * Génère les actions pour un email classé "apporteur".
 *
 * 1. Extrait les infos bien depuis le corps de l'email
 * 2. Crée une fiche bien stub dans le pipeline
 * 3. Si infos critiques manquantes → add_todo
 */
export async function handleApporteur(
  triage: TriageResult,
  email: EmailMessage,
): Promise<ActionProposal[]> {
  const date = email.receivedAt.toISOString().slice(0, 10);
  const infos = extractBienInfos(email.bodyPlain);
  const stubName = buildStubName(date, infos.adresse);
  const filename = `${slugifyVaultFilename(stubName)}.md`;
  const target = `${VAULT_PATHS.opportunitesApporteurs}/${filename}`;

  const content = buildBienStubContent(email, triage, infos, date);

  const actions: ActionProposal[] = [
    {
      type: 'create_file',
      target,
      payload: { content, filename },
      description: `Créer fiche bien pipeline : ${stubName}`,
    },
  ];

  // Infos critiques manquantes : au moins adresse OU prix manquant
  if (!infos.adresse || !infos.prix) {
    const missing: string[] = [];
    if (!infos.adresse) missing.push('adresse');
    if (!infos.prix) missing.push('prix');

    actions.push({
      type: 'add_todo',
      target: null,
      payload: {
        task: `Compléter fiche bien ${stubName} (manque : ${missing.join(', ')})`,
        priority: 'P2',
      },
      description: `Infos manquantes sur le bien : ${missing.join(', ')}`,
    });
  }

  actions.push({
    type: 'mark_processed',
    target: null,
    payload: { messageId: email.id },
    description: 'Marquer l\'email comme traité dans Gmail',
  });

  return actions;
}

// ============================================================
// Extraction des informations bien
// ============================================================

export interface BienInfos {
  adresse: string | null;
  prix: string | null;
  surface: string | null;
  rendement: string | null;
}

/**
 * Extrait les informations d'un bien immobilier depuis le corps
 * d'un email en texte brut via des patterns regex simples.
 */
export function extractBienInfos(bodyPlain: string): BienInfos {
  return {
    adresse: extractAdresse(bodyPlain),
    prix: extractPrix(bodyPlain),
    surface: extractSurface(bodyPlain),
    rendement: extractRendement(bodyPlain),
  };
}

/**
 * Extrait une adresse depuis le corps de l'email.
 *
 * Stratégie : cherche une ligne contenant un mot-clé d'adresse
 * (adresse, rue, avenue, boulevard) OU un code postal 5 chiffres.
 */
function extractAdresse(body: string): string | null {
  const lines = body.split('\n');

  // Cherche une ligne avec mot-clé d'adresse
  const addressKeywords = /\b(adresse|rue|avenue|boulevard|allée|impasse|place|chemin|route)\b/i;
  for (const line of lines) {
    if (addressKeywords.test(line)) {
      const cleaned = line
        .replace(/^[\s*>-]+/, '')
        .replace(/adresse\s*[:=]\s*/i, '')
        .trim();
      if (cleaned.length > 5 && cleaned.length < 200) {
        return cleaned;
      }
    }
  }

  // Cherche une ligne avec code postal 5 chiffres
  const postalCodePattern = /\b\d{5}\b/;
  for (const line of lines) {
    if (postalCodePattern.test(line)) {
      const cleaned = line.replace(/^[\s*>-]+/, '').trim();
      if (cleaned.length > 5 && cleaned.length < 200) {
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * Extrait un prix depuis le corps de l'email.
 *
 * Patterns supportés :
 * - 150 000 € / 150.000 € / 150000 €
 * - 150k € / 150 k€
 */
function extractPrix(body: string): string | null {
  const match = body.match(
    /(\d{2,3}[\s.]?\d{3}[\s.]?\d{3}|\d{2,4}\s?k)\s*€/i,
  );
  return match ? match[0].trim() : null;
}

/**
 * Extrait une surface depuis le corps de l'email.
 *
 * Patterns supportés : 85 m², 85m2, 85 m2
 */
function extractSurface(body: string): string | null {
  const match = body.match(/\d{2,4}\s?m[²2]/i);
  return match ? match[0].trim() : null;
}

/**
 * Extrait un rendement depuis le corps de l'email.
 *
 * Patterns supportés : 7%, 7.5%, 7,5 %
 */
function extractRendement(body: string): string | null {
  const match = body.match(/\d{1,2}([,.]\d{1,2})?\s?%/);
  return match ? match[0].trim() : null;
}

// ============================================================
// Construction du stub
// ============================================================

/**
 * Construit le nom du fichier stub (sans extension).
 * Format : YYYY-MM-DD - <adresse-courte>
 */
function buildStubName(date: string, adresse: string | null): string {
  if (!adresse) {
    return `${date} - Bien à identifier`;
  }

  // Prend les 50 premiers caractères de l'adresse, nettoyés
  const short = adresse
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
    .trim();

  return `${date} - ${short || 'Bien à identifier'}`;
}

/**
 * Construit le contenu Markdown de la fiche bien stub.
 * Inclut une section Historique avec em-dash et ref email (Cowork D3).
 */
function buildBienStubContent(
  email: EmailMessage,
  triage: TriageResult,
  infos: BienInfos,
  date: string,
): string {
  const fromDisplay = email.from.name
    ? `${email.from.name} <${email.from.email}>`
    : email.from.email;
  const emailRef = buildEmailRef(email.source, email.id);

  return [
    '---',
    `statut: a qualifier`,
    `source: email-ingest`,
    `apporteur: "${fromDisplay}"`,
    `date_reception: ${date}`,
    infos.adresse ? `adresse: "${infos.adresse}"` : 'adresse: ""',
    infos.prix ? `prix: "${infos.prix}"` : 'prix: ""',
    infos.surface ? `surface: "${infos.surface}"` : 'surface: ""',
    infos.rendement ? `rendement: "${infos.rendement}"` : 'rendement: ""',
    '---',
    '',
    `# Bien ${EM_DASH} ${infos.adresse || 'Adresse à compléter'}`,
    '',
    '## Informations clés',
    '',
    `- **Adresse** : ${infos.adresse || 'À compléter'}`,
    `- **Prix** : ${infos.prix || 'À compléter'}`,
    `- **Surface** : ${infos.surface || 'À compléter'}`,
    `- **Rendement** : ${infos.rendement || 'À compléter'}`,
    `- **Apporteur** : ${fromDisplay}`,
    '',
    '## Source',
    '',
    `**De** : ${fromDisplay}`,
    `**Date** : ${email.receivedAt.toLocaleDateString('fr-FR')}`,
    `**Lien** : ${email.rawRef}`,
    '',
    '## Historique',
    '',
    buildHistoriqueTitle(date, 'Réception opportunité'),
    '',
    `${triage.summary} ${emailRef}`,
    '',
  ].join('\n');
}
