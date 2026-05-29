/**
 * Validators déterministes pour les CR réunion.
 *
 * Garde-fous côté CODE (vs LLM) basés sur la §6 du Workflow CR Réunion v3 :
 *  - §6.1 Cohérence entité (red line : « ISSA Capital » interdit dans CR GO/VI/VV)
 *  - §6.4 Formules à bannir B1-B12 (warnings)
 *  - §6.5 RBAC entité (Carl/Maxime jamais sur IC)
 *  - §3.3 / Section 1 légale : Art. 39-1 CGI + justif repas + montant si dépense
 *
 * Toutes les fonctions sont PURES : aucun I/O, aucune dépendance runtime.
 * Conçues pour être testables en isolation et appelées dans le webhook
 * avant génération de référence/PDF.
 */

import type { CRDraft, Entite, TypeReunion } from '../types';

// ============================================================
// Entités
// ============================================================

export const ENTITES = ['IC', 'GO', 'VI', 'VV'] as const;

export function isValidEntite(x: unknown): x is Entite {
  return typeof x === 'string' && (ENTITES as readonly string[]).includes(x);
}

// ============================================================
// Types de réunion
// ============================================================

export const TYPES_REUNION = [
  'dejeuner',
  'diner',
  'conseil',
  'appel',
  'interne',
  'visite-immo',
  'signature-contrat',
] as const;

export function isValidType(x: unknown): x is TypeReunion {
  return typeof x === 'string' && (TYPES_REUNION as readonly string[]).includes(x);
}

// ============================================================
// §6.5 RBAC entité
// ============================================================

/**
 * Vérifie qu'un requester a le droit de créer un CR pour une entité.
 * Règle dure : Carl et Maxime n'ont jamais accès à l'entité IC (ISSA Capital).
 *
 * @param requester identifiant du demandeur (tolérant casse / accents)
 * @param entite entité ciblée par le CR
 */
export function checkRbac(
  requester: string | undefined | null,
  entite: Entite,
): { ok: boolean; reason?: string } {
  if (!requester || typeof requester !== 'string') {
    return { ok: true }; // requester non fourni — par défaut Thomas (full access)
  }
  const normalized = requester.trim().toLowerCase();
  const isCarlOuMaxime = normalized === 'carl' || normalized === 'maxime';
  if (isCarlOuMaxime && entite === 'IC') {
    return {
      ok: false,
      reason: `RBAC : « ${requester} » n'est pas autorisé sur l'entité IC (ISSA Capital hors périmètre).`,
    };
  }
  return { ok: true };
}

// ============================================================
// §6.1 Cohérence entité
// ============================================================

const ISSA_CAPITAL_PATTERN = /issa\s*capital/i;

/**
 * Vérifie la cohérence entité du CR.
 * Red line : si l'entité n'est pas IC, AUCUNE occurrence de « ISSA Capital »
 * ne doit apparaître dans :
 *   - participants[].societe ou participants[].titre
 *   - sections de corps (1, 2, 3, 4)
 *
 * Retourne la liste des violations (vide si tout est conforme).
 */
export function checkEntiteCoherence(cr: CRDraft): string[] {
  const violations: string[] = [];
  if (cr.entite === 'IC') {
    return violations;
  }

  // Participants
  for (const [idx, p] of cr.participants.entries()) {
    if (ISSA_CAPITAL_PATTERN.test(p.societe)) {
      violations.push(
        `§6.1 — Participant #${idx + 1} (${p.prenom} ${p.nom}) : société « ${p.societe} » mentionne ISSA Capital alors que l'entité du CR est ${cr.entite}.`,
      );
    }
    if (ISSA_CAPITAL_PATTERN.test(p.titre)) {
      violations.push(
        `§6.1 — Participant #${idx + 1} (${p.prenom} ${p.nom}) : titre « ${p.titre} » mentionne ISSA Capital alors que l'entité du CR est ${cr.entite}.`,
      );
    }
  }

  // Sections de corps
  const sections: Array<[string, string | null]> = [
    ['Section 1 (objet/Art. 39-1)', cr.section_1_objet_art_39_1],
    ['Section 2 (points abordés)', cr.section_2_points_abordes],
    ['Section 3 (décisions)', cr.section_3_decisions],
    ['Section 4 (suites)', cr.section_4_suites_a_donner],
  ];
  for (const [label, content] of sections) {
    if (content && ISSA_CAPITAL_PATTERN.test(content)) {
      violations.push(
        `§6.1 — ${label} mentionne « ISSA Capital » alors que l'entité du CR est ${cr.entite} (red line absolue).`,
      );
    }
  }

  return violations;
}

// ============================================================
// §6.4 Formules à bannir B1-B12
// ============================================================

/**
 * Liste B1-B12 (workflow v3 §6.4) — formules vagues/approximatives à proscrire.
 * Insensibles à la casse, match segment/mot.
 */
// Note : on n'utilise PAS \b car \b en JS = frontière entre [A-Za-z0-9_] et non-mot.
// Les accentuées (à, é) et apostrophes (c'est) ne sont PAS dans \w → \b casse les
// patterns du genre `\bà peu près\b` ou `\bc'est noté\b` (faux négatif silencieux).
// On utilise donc des sentinelles « début/non-lettre » via lookaround simples :
// (?<![A-Za-zÀ-ÿ]) et (?![A-Za-zÀ-ÿ]) — couvrent l'alphabet latin étendu.
const W_START = '(?<![A-Za-zÀ-ÿ])';
const W_END = '(?![A-Za-zÀ-ÿ])';
function mkPattern(core: string): RegExp {
  return new RegExp(`${W_START}${core}${W_END}`, 'i');
}

const FORMULES_BANNIES: Array<{ pattern: RegExp; libelle: string }> = [
  { pattern: mkPattern('globalement'), libelle: 'globalement' },
  { pattern: mkPattern('à\\s+peu\\s+près'), libelle: 'à peu près' },
  { pattern: mkPattern('environ'), libelle: 'environ' },
  { pattern: mkPattern('on\\s+a\\s+parlé\\s+de'), libelle: 'on a parlé de' },
  { pattern: mkPattern('il\\s+faudrait\\s+peut-être'), libelle: 'il faudrait peut-être' },
  { pattern: mkPattern('etc\\.?'), libelle: 'etc.' },
  { pattern: mkPattern('vu\\s+ensemble'), libelle: 'vu ensemble' },
  // Apostrophe droite ou typographique. Le « c » est précédé d'un W_START.
  { pattern: mkPattern("c['’]est\\s+noté"), libelle: "c'est noté" },
  { pattern: mkPattern('on\\s+verra'), libelle: 'on verra' },
  { pattern: mkPattern('à\\s+voir'), libelle: 'à voir' },
  { pattern: mkPattern('en\\s+gros'), libelle: 'en gros' },
  { pattern: mkPattern('super'), libelle: 'super (qualificatif émotionnel)' },
];

/**
 * Détecte les formules bannies §6.4 dans un texte arbitraire.
 * Retourne les libellés trouvés (dédupliqués, ordre stable).
 */
export function detectBannedFormulas(text: string | null | undefined): string[] {
  if (!text || typeof text !== 'string') return [];
  const found = new Set<string>();
  for (const { pattern, libelle } of FORMULES_BANNIES) {
    if (pattern.test(text)) {
      found.add(libelle);
    }
  }
  return Array.from(found);
}

/**
 * Variante CR-aware : scanne toutes les sections du corps.
 */
function detectBannedInCr(cr: CRDraft): string[] {
  const allText = [
    cr.section_1_objet_art_39_1,
    cr.section_2_points_abordes,
    cr.section_3_decisions,
    cr.section_4_suites_a_donner ?? '',
  ].join('\n');
  return detectBannedFormulas(allText);
}

// ============================================================
// §3.3 / Section 1 légale
// ============================================================

const ART_39_1_PATTERN = /(art\.?\s*39-?1|article\s+39-?1)/i;
const REPAS_JUSTIF_PATTERN =
  /(format\s+(repas\s+)?(?:retenu|choisi|adopté)|ce\s+format|compte\s+tenu|en\s+raison\s+de|justifi)/i;
const TIIME_PATTERN = /\btiime\b/i;
const MONTANT_PATTERN = /(\d+[.,]?\d*\s*(?:€|eur|euros)|ttc|ht)/i;

/**
 * Valide la Section 1 (objet + Art. 39-1 CGI).
 * Règles :
 *  - mention « Art. 39-1 » (ou « article 39-1 ») obligatoire
 *  - si type ∈ {dejeuner, diner} → justification du format repas exigée
 *  - si montant_ttc_eur non null → mention montant OU renvoi « Tiime »
 *
 * Retourne la liste des violations.
 */
export function checkSection1Legal(cr: CRDraft): string[] {
  const violations: string[] = [];
  const s1 = cr.section_1_objet_art_39_1 ?? '';

  if (!ART_39_1_PATTERN.test(s1)) {
    violations.push(
      '§3.3 — Section 1 doit citer « Art. 39-1 » (ou « article 39-1 ») du CGI.',
    );
  }

  if (cr.type_reunion === 'dejeuner' || cr.type_reunion === 'diner') {
    if (!REPAS_JUSTIF_PATTERN.test(s1)) {
      violations.push(
        `§3.3 — Section 1 doit justifier le format repas (« ${cr.type_reunion} »).`,
      );
    }
  }

  if (cr.montant_ttc_eur != null) {
    const mentionneMontant = MONTANT_PATTERN.test(s1);
    const renvoiTiime = TIIME_PATTERN.test(s1);
    if (!mentionneMontant && !renvoiTiime) {
      violations.push(
        '§3.3 — Section 1 doit mentionner le montant TTC ou renvoyer vers « Tiime ».',
      );
    }
  }

  return violations;
}

// ============================================================
// Validation agrégée
// ============================================================

export interface ValidateCrResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidateCrOptions {
  requester?: string;
}

/**
 * Validation agrégée d'un payload CR.
 * Errors bloquantes (entité, type, RBAC, cohérence, Section 1 légale).
 * Warnings non bloquantes (formules bannies §6.4).
 */
export function validateCrPayload(
  cr: CRDraft,
  opts: ValidateCrOptions = {},
): ValidateCrResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isValidEntite(cr.entite)) {
    errors.push(`Entité invalide : « ${String(cr.entite)} » (attendu : ${ENTITES.join(', ')}).`);
  }
  if (!isValidType(cr.type_reunion)) {
    errors.push(
      `Type de réunion invalide : « ${String(cr.type_reunion)} » (attendu : ${TYPES_REUNION.join(', ')}).`,
    );
  }

  // Stop early si entité invalide : RBAC/cohérence n'ont plus de sens.
  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  if (opts.requester !== undefined) {
    const rbac = checkRbac(opts.requester, cr.entite);
    if (!rbac.ok && rbac.reason) {
      errors.push(rbac.reason);
    }
  }

  errors.push(...checkEntiteCoherence(cr));
  errors.push(...checkSection1Legal(cr));
  warnings.push(...detectBannedInCr(cr));

  return { ok: errors.length === 0, errors, warnings };
}

// ============================================================
// Déduplication
// ============================================================

function normalizeObjet(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface CrIdentity {
  entite: Entite;
  objet: string;
  date: string;
}

/**
 * Détecte un doublon : même entité + même date + objet équivalent (normalisé).
 */
export function isDuplicateCr(
  candidate: CrIdentity,
  existing: CrIdentity[],
): boolean {
  const candObjet = normalizeObjet(candidate.objet);
  return existing.some(
    (e) =>
      e.entite === candidate.entite &&
      e.date === candidate.date &&
      normalizeObjet(e.objet) === candObjet,
  );
}
