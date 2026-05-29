/**
 * Rendu de fiche contact aligné sur les templates du vault Drive.
 *
 * Source de vérité (templates) :
 *  - `Templates/Contact pro.md`        — type='pro'         (RBAC, entites_visibles)
 *  - `Templates/Contact relationnel.md` — type='famille'|'amis'|'autres'
 *
 * S25 (2026-05-29) P1 #3 : la STRUCTURE (ordre des clés frontmatter et des
 * sections H2) est lue au RUNTIME via `templates/template-loader.ts` (cache
 * 1h + fallback hardcodé). Ce fichier ne porte plus que la logique de VALEUR
 * par clé/section. Une clé ou un titre inconnu de ce fichier sort vide (jamais
 * de placeholder — Cmd #2). Rendu nominal bit-pour-bit identique à l'historique
 * tant que les templates vault matchent le fallback.
 *
 * Couvre les 2 chemins de création de fiche :
 *  - `contact-fiche-synth.ts:renderEnrichedFiche` (email → no-match)
 *  - `callback-handler.ts:buildWhatsappFiche`     (WhatsApp → no-match)
 *  - `callback-handler.ts:buildStubFiche`         (fallback email → no-match)
 */

import type { ContactType } from './no-match-card';
import { loadTemplate, type TemplateName } from '../templates/template-loader';

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
 * le template du vault correspondant au type. Lit la STRUCTURE depuis Drive au
 * runtime (cache 1h, fallback hardcodé).
 *
 * @param type    Catégorie de contact (pilote le choix de template).
 * @param data    Données factuelles connues (zéro invention côté appelant).
 * @param ctx     Contexte de création (date, première entrée d'historique).
 * @returns       Contenu Markdown complet, prêt à être écrit dans le vault.
 */
export async function renderFicheContent(
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): Promise<string> {
  const templateName: TemplateName = type === 'pro' ? 'Contact pro' : 'Contact relationnel';
  const structure = await loadTemplate(templateName);

  const frontmatter = buildFrontmatter(structure.frontmatterKeys, type, data, ctx);
  const body = buildBody(structure.sections, type, data, ctx);

  return frontmatter + body;
}

// ============================================================
// Frontmatter — assemblage piloté par la structure
// ============================================================

function buildFrontmatter(
  keys: string[],
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string {
  const lines: string[] = ['---'];
  for (const key of keys) {
    lines.push(...renderFrontmatterValue(key, type, data, ctx));
  }
  lines.push('---', '', `# ${data.displayName}`, '');
  return lines.join('\n');
}

/**
 * Rend la (ou les) ligne(s) YAML pour une clé donnée. Clé inconnue → `key: `.
 * Le rendu spécial `tags` retourne 2 lignes (bloc multi-ligne). `entites_visibles`
 * renvoie `[]` côté pro.
 */
function renderFrontmatterValue(
  key: string,
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string[] {
  const langue = data.langue ?? 'fr';

  switch (key) {
    case 'type':
      return ['type: contact'];
    case 'categorie':
      return [`categorie: ${categorieFor(type)}`];
    case 'societe':
      return [`societe: ${data.societe ?? ''}`];
    case 'role':
      return [`role: ${data.role ?? ''}`];
    case 'email':
      return [`email: ${data.email ?? ''}`];
    case 'telephone':
      return [`telephone: ${data.telephone ?? ''}`];
    case 'langue':
      return [`langue: ${langue}`];
    case 'rencontre_via':
      return [`rencontre_via: ${data.rencontreVia ?? ''}`];
    case 'date_premier_contact':
      return [`date_premier_contact: ${ctx.today}`];
    case 'date_derniere_interaction':
      return [`date_derniere_interaction: ${ctx.today}`];
    case 'entites_visibles':
      return ['entites_visibles: []'];
    case 'tags':
      return ['tags:', `  - ${tagFor(type)}`];
    // Clés présentes dans les templates mais laissées vides à la création
    // (Anya les remplit au fil de l'eau). Pas d'invention ici.
    case 'sous_categorie':
    case 'canal_préféré':
    case 'fréquence_échanges':
    case 'classification':
    case 'date_naissance':
    case 'date_anniversaire':
    case 'lieu_residence':
    case 'adresse':
      return [`${key}: `];
    default:
      // Clé inconnue (ajoutée au template sans support code) → ligne vide pour
      // ne pas casser le YAML ni inventer. Le drift sera visible côté Obsidian
      // et corrigé dans une PR future.
      return [`${key}: `];
  }
}

// ============================================================
// Corps — assemblage piloté par la structure
// ============================================================

function buildBody(
  sections: string[],
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string {
  const lines: string[] = [];
  for (const heading of sections) {
    lines.push(...renderSectionContent(heading, type, data, ctx));
  }
  return lines.join('\n');
}

/**
 * Rend une section complète (titre `## ...` + contenu). Section inconnue →
 * `## Titre` suivi d'une ligne vide (présence garantie, pas de placeholder).
 */
function renderSectionContent(
  heading: string,
  type: ContactType,
  data: FicheRenderData,
  ctx: FicheRenderContext,
): string[] {
  switch (heading) {
    case "Qui c'est":
      return buildQuiCestSection(type, data);
    case 'Statut courant':
      return ['## Statut courant', ''];
    case 'Projets liés':
      return ['## Projets liés', ''];
    case 'Famille / Liens':
      return ['## Famille / Liens', ''];
    case 'Notes':
      return buildNotesSection(data);
    case 'Tonalité de communication':
      return buildTonaliteSection(data);
    case 'Historique':
      return buildHistoriqueSection(ctx);
    default:
      return [`## ${heading}`, ''];
  }
}

// ============================================================
// Helpers — sections
// ============================================================

function buildQuiCestSection(type: ContactType, data: FicheRenderData): string[] {
  const lines: string[] = ["## Qui c'est", ''];
  if (data.userContext && data.userContext.trim().length > 0) {
    lines.push(data.userContext.trim());
  } else if (type !== 'pro' && data.fallbackQuiCest && data.fallbackQuiCest.trim().length > 0) {
    // fallbackQuiCest n'a de sens que côté relationnel (cas WhatsApp).
    lines.push(data.fallbackQuiCest.trim());
  }
  lines.push('');
  return lines;
}

function buildNotesSection(data: FicheRenderData): string[] {
  const lines: string[] = ['## Notes', ''];
  const notes = buildNotesBullets(data);
  if (notes.length > 0) {
    lines.push(...notes);
    lines.push('');
  }
  return lines;
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
