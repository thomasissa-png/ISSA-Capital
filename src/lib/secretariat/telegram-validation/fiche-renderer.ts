/**
 * Rendu de fiche contact aligné sur les templates du vault Drive.
 *
 * Source de vérité (templates) :
 *  - `Templates/Contact pro.md`        — type='pro'         (RBAC, entites_visibles)
 *  - `Templates/Contact relationnel.md` — type='famille'|'amis'|'autres'
 *
 * Anya ne lit pas les templates au runtime (hardcodé ici). Toute évolution
 * STRUCTURELLE des templates côté vault DOIT être propagée ici par une PR.
 *
 * Couvre les 2 chemins de création de fiche :
 *  - `contact-fiche-synth.ts:renderEnrichedFiche` (email → no-match)
 *  - `callback-handler.ts:buildWhatsappFiche`    (WhatsApp → no-match)
 *
 * S25 (2026-05-29) : création initiale. Avant : rendu hardcodé divergent
 * dans chaque caller, drift avec templates documenté mais jamais corrigé.
 */

import type { ContactType } from './no-match-card';

// ============================================================
// Types publics
// ============================================================

/**
 * Données utiles à la création d'une fiche, neutres vis-à-vis de la source
 * (email ou WhatsApp). Tout champ vide / inconnu = omis du rendu (frontmatter
 * laissé vide = clé présente sans valeur, comme dans le template).
 */
export interface FicheRenderData {
  /** Nom affiché en titre (h1). */
  displayName: string;
  /** Société / organisation (pro uniquement). */
  societe?: string;
  /** Rôle / fonction (pro uniquement). */
  role?: string;
  /** Email principal connu (pro/relationnel — vide pour création WhatsApp). */
  email?: string;
  /** Téléphone connu. */
  telephone?: string;
  /** Langue (code ISO court : fr/en/ar). Défaut `fr`. */
  langue?: string;
  /** Comment Thomas a rencontré le contact (ex: "Email", "WhatsApp"). */
  rencontreVia?: string;
  /** Sujets récurrents extraits par LLM (pro — alimente ## Notes). */
  sujets?: string[];
  /** Autre email repéré (alimente ## Notes). */
  autreEmail?: string;
  /** Note sur le nom (ex: codes type "OMS" écartés du nom). */
  nameNotes?: string;
  /** Texte libre fourni par Thomas via reply Telegram (alimente ## Qui c'est). */
  userContext?: string;
  /** Résumé Anya — fallback ## Qui c'est si pas de userContext (cas WhatsApp). */
  fallbackQuiCest?: string;
}

export interface FicheRenderContext {
  /** Date au format YYYY-MM-DD. */
  today: string;
  /** Titre de la 1re ligne d'historique (ex: "Fiche créée (synthèse emails)"). */
  historiqueTitle: string;
  /** Contenu de la 1re ligne d'historique. */
  historiqueContent: string;
}

// ============================================================
// API publique
// ============================================================

/**
 * Rend une fiche contact complète (frontmatter + corps markdown), alignée sur
 * le template du vault correspondant au type.
 *
 * @param type    Catégorie de contact (pilote le choix de template).
 * @param data    Données factuelles connues (zéro invention côté appelant).
 * @param ctx     Contexte de création (date, première entrée d'historique).
 * @returns       Contenu Markdown complet, prêt à être écrit dans le vault.
 */
export function renderFicheContent(
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string {
  if (type === 'pro') {
    return buildProFrontmatter(data, ctx) + buildProSections(data, ctx);
  }
  return buildRelationalFrontmatter(type, data, ctx) + buildRelationalSections(data, ctx);
}

// ============================================================
// Helpers — frontmatter
// ============================================================

/**
 * Aligne la valeur `categorie` côté frontmatter sur le template du vault
 * (singulier, sans accent). Le `ContactType` côté code reste pluriel pour
 * compat historique des callbacks Telegram.
 */
function categorieFor(type: ContactType): string {
  switch (type) {
    case 'pro':
      return 'pro';
    case 'famille':
      return 'famille';
    case 'amis':
      return 'ami';
    case 'autres':
      return 'autre';
  }
}

/** Tag aligné sur `categorie` (singulier). */
function tagFor(type: ContactType): string {
  return categorieFor(type);
}

/**
 * Frontmatter aligné sur `Templates/Contact pro.md` v3 :
 *   type / categorie / sous_categorie / societe / role / email / telephone /
 *   langue / rencontre_via / date_premier_contact / date_derniere_interaction /
 *   canal_préféré / fréquence_échanges / entites_visibles / classification / tags
 *
 * Convention template : champs vides = clé présente sans valeur (Anya remplit
 * au fil de l'eau via `updateLastInteraction` etc.).
 */
function buildProFrontmatter(data: FicheRenderData, ctx: FicheRenderContext): string {
  const langue = data.langue ?? 'fr';
  return [
    '---',
    'type: contact',
    'categorie: pro',
    'sous_categorie: ',
    `societe: ${data.societe ?? ''}`,
    `role: ${data.role ?? ''}`,
    `email: ${data.email ?? ''}`,
    `telephone: ${data.telephone ?? ''}`,
    `langue: ${langue}`,
    `rencontre_via: ${data.rencontreVia ?? ''}`,
    `date_premier_contact: ${ctx.today}`,
    `date_derniere_interaction: ${ctx.today}`,
    'canal_préféré: ',
    'fréquence_échanges: ',
    'entites_visibles: []',
    'classification: ',
    'tags:',
    `  - ${tagFor('pro')}`,
    '---',
    '',
    `# ${data.displayName}`,
    '',
  ].join('\n');
}

/**
 * Frontmatter aligné sur `Templates/Contact relationnel.md` (famille/amis/autres) :
 *   type / categorie / sous_categorie / date_naissance / date_anniversaire /
 *   lieu_residence / adresse / telephone / email / langue / rencontre_via /
 *   date_derniere_interaction / canal_préféré / fréquence_échanges / tags
 *
 * Pas de `societe`/`role`/`classification`/`entites_visibles` (perso).
 * Pas de `date_premier_contact` non plus (template relationnel l'omet).
 */
function buildRelationalFrontmatter(
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string {
  const langue = data.langue ?? 'fr';
  return [
    '---',
    'type: contact',
    `categorie: ${categorieFor(type)}`,
    'sous_categorie: ',
    'date_naissance: ',
    'date_anniversaire: ',
    'lieu_residence: ',
    'adresse: ',
    `telephone: ${data.telephone ?? ''}`,
    `email: ${data.email ?? ''}`,
    `langue: ${langue}`,
    `rencontre_via: ${data.rencontreVia ?? ''}`,
    `date_derniere_interaction: ${ctx.today}`,
    'canal_préféré: ',
    'fréquence_échanges: ',
    'tags:',
    `  - ${tagFor(type)}`,
    '---',
    '',
    `# ${data.displayName}`,
    '',
  ].join('\n');
}

// ============================================================
// Helpers — sections markdown
// ============================================================

/**
 * Sections markdown alignées sur `Contact pro.md` v3 :
 *   ## Qui c'est → ## Statut courant → ## Projets liés → ## Notes →
 *   ## Tonalité de communication → ## Historique
 *
 * Toutes TOUJOURS présentes, même vides (convention template :
 * « Sections de base : TOUJOURS présentes. Les fiches évoluent. »).
 */
function buildProSections(data: FicheRenderData, ctx: FicheRenderContext): string {
  const lines: string[] = [];

  // ## Qui c'est — userContext si fourni, sinon vide (Thomas remplira)
  lines.push("## Qui c'est", '');
  if (data.userContext && data.userContext.trim().length > 0) {
    lines.push(data.userContext.trim());
  }
  lines.push('');

  // ## Statut courant — toujours présente, à remplir par Thomas
  lines.push('## Statut courant', '');

  // ## Projets liés — toujours présente
  lines.push('## Projets liés', '');

  // ## Notes — alimentée par les sujets/extras extraits par LLM (si dispo)
  lines.push('## Notes', '');
  const notes = buildNotesBullets(data);
  if (notes.length > 0) {
    lines.push(...notes);
    lines.push('');
  }

  // ## Tonalité de communication — toujours présente, structurée
  lines.push(...buildTonaliteSection(data));

  // ## Historique — première entrée
  lines.push(...buildHistoriqueSection(ctx));

  return lines.join('\n');
}

/**
 * Sections markdown alignées sur `Contact relationnel.md` :
 *   ## Qui c'est → ## Famille / Liens → ## Notes →
 *   ## Tonalité de communication → ## Historique
 *
 * Pas de `## Statut courant` (template perso simplifié).
 * Pas de `## Projets liés` en section de base (optionnelle).
 */
function buildRelationalSections(data: FicheRenderData, ctx: FicheRenderContext): string {
  const lines: string[] = [];

  // ## Qui c'est
  lines.push("## Qui c'est", '');
  if (data.userContext && data.userContext.trim().length > 0) {
    lines.push(data.userContext.trim());
  } else if (data.fallbackQuiCest && data.fallbackQuiCest.trim().length > 0) {
    lines.push(data.fallbackQuiCest.trim());
  }
  lines.push('');

  // ## Famille / Liens — toujours présente
  lines.push('## Famille / Liens', '');

  // ## Notes — sujets / autres infos
  lines.push('## Notes', '');
  const notes = buildNotesBullets(data);
  if (notes.length > 0) {
    lines.push(...notes);
    lines.push('');
  }

  // ## Tonalité de communication — toujours présente
  lines.push(...buildTonaliteSection(data));

  // ## Historique
  lines.push(...buildHistoriqueSection(ctx));

  return lines.join('\n');
}

/**
 * Bullets pour ## Notes — sujets récurrents, autre email, note sur le nom.
 * Renvoie [] si rien à dire (section présente mais vide, conforme template).
 */
function buildNotesBullets(data: FicheRenderData): string[] {
  const out: string[] = [];
  if (data.sujets && data.sujets.length > 0) {
    out.push(`- **Sujets récurrents** : ${data.sujets.join(', ')}`);
  }
  if (data.autreEmail) {
    out.push(`- **Autre email** : ${data.autreEmail}`);
  }
  if (data.nameNotes) {
    out.push(`- **Note (nom)** : ${data.nameNotes}`);
  }
  return out;
}

/**
 * ## Tonalité de communication — 5 sous-bullets canoniques, vides par défaut.
 * Si la langue est connue, on la pré-remplit (le LLM peut la déduire des
 * signatures email). Le reste reste vide jusqu'à ce que Thomas le renseigne.
 */
function buildTonaliteSection(data: FicheRenderData): string[] {
  const langueDisplay = displayLangue(data.langue);
  return [
    '## Tonalité de communication',
    '',
    '- Canal préféré : ',
    '- Tu/Vous : ',
    `- Langue : ${langueDisplay}`,
    '- Ton : ',
    '- À éviter : ',
    '',
  ];
}

/**
 * Convertit le code langue frontmatter en libellé lisible pour la section
 * Tonalité (le template demande le clair, ex: "Français", "Anglais").
 */
function displayLangue(langue: string | undefined): string {
  switch (langue) {
    case 'fr':
    case undefined:
      return 'Français';
    case 'en':
      return 'Anglais';
    case 'ar':
      return 'Arabe';
    default:
      // Codes multilingues type 'fr,en' → libellé direct
      return langue;
  }
}

/**
 * ## Historique — première entrée à la création.
 */
function buildHistoriqueSection(ctx: FicheRenderContext): string[] {
  return [
    '## Historique',
    '',
    `### ${ctx.today} — ${ctx.historiqueTitle}`,
    '',
    ctx.historiqueContent,
    '',
  ];
}
