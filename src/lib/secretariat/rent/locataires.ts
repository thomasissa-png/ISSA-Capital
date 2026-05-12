/**
 * Lecture des fiches locataires depuis Google Drive + recherche "futée".
 *
 * Source : Drive uniquement (décision verrouillée par Thomas).
 * Chemin Drive : 07. Contacts/05. Locataires/01. Actuels/<Prenom Nom>.md
 * Fallback : 07. Contacts/05. Locataires/_Candidats/<Prenom Nom>.md
 *
 * Chaque fiche est un fichier Markdown avec frontmatter YAML :
 * ---
 * civilite: Monsieur
 * nom_officiel: Kenan Beguigneau
 * adresse_bien: 2 bis boulevard de la Seine, Studio 7, 92000 Nanterre
 * montant_loyer: 590
 * montant_charges: 100
 * date_entree_bail: 2024-05-23
 * email: kenan@example.com
 * ---
 *
 * Scope OAuth requis : drive (Thomas l'a migré manuellement via /api/drive-auth).
 *
 * Recherche futée : normalisation accents/casse, startsWith, contains,
 * Levenshtein ≤ 2, match sur nom_officiel du frontmatter.
 */

import { getAccessToken } from '../drive-upload';
import type { Locataire, LocataireMatch, RechercheLocataireResult } from './types';

// ============================================================
// Constantes Drive
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';

/**
 * Dossiers de recherche, dans l'ordre de priorité.
 * Le script Python cherche dans 01. Actuels/ puis _Candidats/.
 */
const LOCATAIRE_FOLDERS = [
  { name: '01. Actuels', source: 'actuels' as const },
  { name: '_Candidats', source: 'candidats' as const },
];

/** Regex pour extraire le frontmatter YAML d'un fichier Markdown */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/** TTL du cache en ms (60 secondes) */
const CACHE_TTL_MS = 60_000;

// ============================================================
// YAML parser minimaliste (pas de dépendance)
// ============================================================

/**
 * Parse un frontmatter YAML simple (clé: valeur sur chaque ligne).
 *
 * Supporte : strings, nombres, dates (YYYY-MM-DD), strings entre guillemets.
 * Ne supporte PAS : listes, objets imbriqués, multiline (pas nécessaire pour les fiches locataires).
 */
function parseSimpleYaml(yaml: string): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // Retirer les guillemets
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (value === '' || value === 'null' || value === '~') {
      result[key] = null;
      continue;
    }

    // Essayer de parser comme nombre
    const num = Number(value);
    if (!Number.isNaN(num) && value !== '') {
      result[key] = num;
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Parse une date depuis une valeur YAML (string "YYYY-MM-DD" ou nombre).
 */
function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value);
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// ============================================================
// Normalisation de texte pour matching fuzzy
// ============================================================

/**
 * Normalise un texte pour la comparaison :
 * - lowercase
 * - suppression diacritiques (é→e, ç→c, etc.)
 * - suppression espaces multiples + trim
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// Levenshtein distance (implémentation native Wagner-Fischer)
// ============================================================

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 *
 * Implémentation native (~15 lignes) plutôt qu'un package npm :
 * - Usage borné (noms courts, max ~30 chars)
 * - Zéro dépendance pour un algorithme trivial et stable
 * - Ownership total, zéro risque supply chain
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Optimisation : si l'une des chaînes est vide
  if (m === 0) return n;
  if (n === 0) return m;

  // Matrice à 2 lignes (optimisation mémoire)
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,       // deletion
        curr[j - 1]! + 1,   // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}

// ============================================================
// API Drive
// ============================================================

/**
 * Recherche des fichiers .md dans un dossier Drive donné.
 * Ne filtre PAS par nom (on charge tout puis on matche localement).
 *
 * @param accessToken Token OAuth2 valide
 * @param folderQuery Condition de requête parent (ex: "'FOLDER_ID' in parents")
 * @returns Liste de fichiers avec id et name
 */
async function listDriveMarkdownFiles(
  accessToken: string,
  folderQuery: string,
): Promise<Array<{ id: string; name: string }>> {
  const q = `${folderQuery} and mimeType='text/markdown' and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error(`[locataires] list Drive échoué : HTTP ${response.status} — ${err.slice(0, 200)}`);
    return [];
  }

  const data = (await response.json()) as { files?: Array<{ id: string; name: string }> };
  return data.files ?? [];
}

/**
 * Recherche un dossier Drive par nom dans un dossier parent.
 *
 * @returns ID du dossier trouvé, ou null
 */
/**
 * Normalise un nom de dossier pour matching local : lowercase + suppression
 * diacritiques + collapse espaces multiples.
 */
function normalizeFolderName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function findDriveFolderByName(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string | null> {
  // Approche robuste : lister TOUS les sous-dossiers du parent puis matcher
  // localement (avec normalisation accents/casse/espaces). Évite tout bug lié
  // à la syntaxe `name='X'` côté Drive Query Language.
  const q = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=200`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error(`[locataires] findDriveFolderByName HTTP ${response.status} pour parent=${parentFolderId} — ${err.slice(0, 300)}`);
    return null;
  }

  const data = (await response.json()) as { files?: Array<{ id: string; name: string }> };
  const folders = data.files ?? [];

  // Diagnostic : log la liste effective des sous-dossiers visibles
  console.warn(`[locataires] parent ${parentFolderId} contient ${folders.length} sous-dossier(s) visible(s) : [${folders.map((f) => f.name).join(' | ')}]`);

  // 1. Match exact
  const exact = folders.find((f) => f.name === folderName);
  if (exact) {
    console.warn(`[locataires] match exact "${folderName}" → id=${exact.id}`);
    return exact.id;
  }

  // 2. Match normalisé (accents, casse, espaces)
  const target = normalizeFolderName(folderName);
  const normalized = folders.find((f) => normalizeFolderName(f.name) === target);
  if (normalized) {
    console.warn(`[locataires] match normalisé "${folderName}" → "${normalized.name}" (id=${normalized.id})`);
    return normalized.id;
  }

  console.warn(`[locataires] "${folderName}" introuvable dans ${parentFolderId} (sous-dossiers visibles ci-dessus)`);
  return null;
}

/**
 * Lit le contenu texte d'un fichier Drive.
 */
async function readDriveFileContent(
  accessToken: string,
  fileId: string,
): Promise<string | null> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(`[locataires] lecture fichier Drive ${fileId} échouée : HTTP ${response.status}`);
    return null;
  }

  return response.text();
}

/**
 * Navigue dans l'arborescence Drive pour trouver le dossier locataires.
 *
 * Chemin : root → "07. Contacts" → "05. Locataires" → subfolder
 */
async function navigateToLocataireFolder(
  accessToken: string,
  rootFolderId: string,
  subfolder: string,
): Promise<string | null> {
  const contactsId = await findDriveFolderByName(accessToken, rootFolderId, '07. Contacts');
  if (!contactsId) {
    console.warn(`[locataires] dossier "07. Contacts" non trouvé dans ${rootFolderId}`);
    return null;
  }

  const locatairesId = await findDriveFolderByName(accessToken, contactsId, '05. Locataires');
  if (!locatairesId) {
    console.warn(`[locataires] dossier "05. Locataires" non trouvé dans "07. Contacts"`);
    return null;
  }

  const subId = await findDriveFolderByName(accessToken, locatairesId, subfolder);
  if (!subId) {
    console.warn(`[locataires] sous-dossier "${subfolder}" non trouvé dans "05. Locataires"`);
    return null;
  }

  return subId;
}

/**
 * Parse le contenu Markdown d'une fiche locataire en objet Locataire.
 *
 * @param content Contenu Markdown complet (frontmatter + body)
 * @param filename Nom du fichier (ex: "Kenan Beguigneau.md")
 * @returns Locataire parsé ou null si frontmatter invalide/incomplet
 */
export function parseFicheLocataire(
  content: string,
  filename: string,
): Locataire | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match?.[1]) return null;

  const fm = parseSimpleYaml(match[1]);

  const loyer = fm['montant_loyer'];
  const adresse = fm['adresse_bien'];

  // Champs obligatoires : montant_loyer et adresse_bien
  if (loyer === null || loyer === undefined || !adresse) {
    return null;
  }

  const nomFichier = filename.replace(/\.md$/i, '');
  const nomOfficiel = fm['nom_officiel'];

  return {
    nomFichier,
    nomAffiche: typeof nomOfficiel === 'string' && nomOfficiel ? nomOfficiel : nomFichier,
    civilite: typeof fm['civilite'] === 'string' ? fm['civilite'] : null,
    email: typeof fm['email'] === 'string' ? fm['email'] : null,
    adresseBien: String(adresse),
    montantLoyer: Number(loyer),
    montantCharges: Number(fm['montant_charges'] ?? 0),
    dateEntreeBail: parseDate(fm['date_entree_bail']),
    dateFinBail: parseDate(fm['date_fin_bail']),
    moyenPaiement: typeof fm['moyen_paiement'] === 'string'
      ? fm['moyen_paiement']
      : 'Virement bancaire',
  };
}

// ============================================================
// Cache en mémoire pour les fiches locataires
// ============================================================

export interface CachedFiche {
  nomFichier: string;
  nomOfficiel: string | null;
  locataire: Locataire;
  source: 'actuels' | 'candidats';
}

export interface FichesCache {
  fiches: CachedFiche[];
  totaux: { actuels: number; candidats: number };
  loadedAt: number;
}

let fichesCache: FichesCache | null = null;

/**
 * Invalide le cache manuellement (utile après ajout/suppression de locataire).
 */
export function invalidateLocatairesCache(): void {
  fichesCache = null;
}

/**
 * Charge toutes les fiches locataires depuis Drive (avec cache TTL 60s).
 *
 * Charge les fichiers .md de 01. Actuels/ et _Candidats/, lit leur contenu,
 * parse le frontmatter. Skip silencieusement les fiches invalides.
 */
export async function loadAllFiches(forceRefresh = false): Promise<FichesCache> {
  const now = Date.now();

  // Retourner le cache s'il est valide
  if (!forceRefresh && fichesCache && (now - fichesCache.loadedAt) < CACHE_TTL_MS) {
    return fichesCache;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('[locataires] pas de token OAuth2 pour Drive');
    return { fiches: [], totaux: { actuels: 0, candidats: 0 }, loadedAt: now };
  }

  // DIAGNOSTIC : log du scope OAuth effectif (une fois par session)
  try {
    const scopeResp = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (scopeResp.ok) {
      const info = (await scopeResp.json()) as { scope?: string; email?: string };
      console.warn(`[locataires] OAuth scope actif : "${info.scope}" (compte: ${info.email ?? 'inconnu'})`);
    } else {
      console.warn(`[locataires] tokeninfo HTTP ${scopeResp.status}`);
    }
  } catch (err) {
    console.warn(`[locataires] tokeninfo erreur : ${err instanceof Error ? err.message : String(err)}`);
  }

  const rootFolderId = process.env.DRIVE_VAULT_ROOT_ID ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!rootFolderId) {
    console.error('[locataires] DRIVE_VAULT_ROOT_ID ou DRIVE_INBOX_FOLDER_ID manquant');
    return { fiches: [], totaux: { actuels: 0, candidats: 0 }, loadedAt: now };
  }
  console.warn(`[locataires] loadAllFiches : rootFolderId=${rootFolderId} (source=${process.env.DRIVE_VAULT_ROOT_ID ? 'VAULT_ROOT' : 'INBOX_FALLBACK'})`);

  const fiches: CachedFiche[] = [];
  const totaux = { actuels: 0, candidats: 0 };

  for (const folder of LOCATAIRE_FOLDERS) {
    const folderId = await navigateToLocataireFolder(accessToken, rootFolderId, folder.name);
    if (!folderId) continue;

    const q = `'${folderId}' in parents`;
    const files = await listDriveMarkdownFiles(accessToken, q);
    console.log(`[locataires] ${folder.name}: ${files.length} fichiers .md trouvés`);

    // Compter avant filtrage
    const mdFiles = files.filter((f) => !f.name.startsWith('_'));
    if (folder.source === 'actuels') {
      totaux.actuels = mdFiles.length;
    } else {
      totaux.candidats = mdFiles.length;
    }

    // Lire le contenu de chaque fiche
    for (const file of mdFiles) {
      const content = await readDriveFileContent(accessToken, file.id);
      if (!content) {
        console.warn(`[locataires] impossible de lire ${file.name} (id: ${file.id})`);
        continue;
      }

      const locataire = parseFicheLocataire(content, file.name);
      if (!locataire) {
        console.warn(`[locataires] frontmatter invalide pour ${file.name} — skip`);
        continue;
      }

      // Extraire nom_officiel du frontmatter (peut différer de nomAffiche si parseFicheLocataire le modifie)
      const fmMatch = FRONTMATTER_RE.exec(content);
      const fm = fmMatch?.[1] ? parseSimpleYaml(fmMatch[1]) : {};
      const nomOfficiel = typeof fm['nom_officiel'] === 'string' && fm['nom_officiel']
        ? fm['nom_officiel']
        : null;

      fiches.push({
        nomFichier: file.name.replace(/\.md$/i, ''),
        nomOfficiel,
        locataire,
        source: folder.source,
      });
    }
  }

  fichesCache = { fiches, totaux, loadedAt: now };
  return fichesCache;
}

// ============================================================
// Algorithme de matching fuzzy
// ============================================================

/**
 * Exécute le matching fuzzy sur une liste de fiches.
 * Exported pour les tests (permet de tester sans mock Drive).
 */
export function matchFiches(
  query: string,
  fiches: CachedFiche[],
): LocataireMatch[] {
  if (!query.trim()) return [];

  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return [];

  const matches: LocataireMatch[] = [];
  const seen = new Set<string>(); // éviter les doublons (même fichier matché plusieurs fois)

  function addMatch(fiche: CachedFiche, score: number, matchType: LocataireMatch['matchType']): void {
    // Garder le meilleur score si déjà vu
    const key = `${fiche.source}:${fiche.nomFichier}`;
    if (seen.has(key)) {
      const existing = matches.find((m) => `${m.source}:${m.nomFichier}` === key);
      if (existing && existing.score <= score) return; // existant est meilleur ou égal
      if (existing) {
        existing.score = score;
        existing.matchType = matchType;
        return;
      }
    }
    seen.add(key);
    matches.push({
      nomFichier: fiche.nomFichier,
      nomAffiche: fiche.nomOfficiel ?? fiche.nomFichier,
      source: fiche.source,
      score,
      matchType,
    });
  }

  for (const fiche of fiches) {
    const normalizedNomFichier = normalizeForSearch(fiche.nomFichier);
    const normalizedNomOfficiel = fiche.nomOfficiel
      ? normalizeForSearch(fiche.nomOfficiel)
      : null;

    // Extraire les parties du nom de fichier (prénom, nom de famille)
    const partsFichier = normalizedNomFichier.split(' ');
    const prenomFichier = partsFichier[0] ?? '';
    const nomFamilleFichier = partsFichier.length > 1
      ? partsFichier[partsFichier.length - 1]!
      : '';

    // --- Stratégie 1 : Exact match sur nom de fichier normalisé (score 0) ---
    if (normalizedNomFichier === normalizedQuery) {
      addMatch(fiche, 0, 'exact');
      continue;
    }

    // --- Stratégie 2 : Exact match sur nom_officiel normalisé (score 0) ---
    if (normalizedNomOfficiel && normalizedNomOfficiel === normalizedQuery) {
      addMatch(fiche, 0, 'nomOfficiel');
      continue;
    }

    // --- Stratégie 3 : StartsWith sur nom de fichier normalisé (score 1) ---
    if (normalizedNomFichier.startsWith(normalizedQuery)) {
      addMatch(fiche, 1, 'startsWith');
      continue;
    }

    // --- Stratégie 4 : StartsWith sur prénom seul (score 1) ---
    if (prenomFichier && prenomFichier.startsWith(normalizedQuery)) {
      addMatch(fiche, 1, 'startsWith');
      continue;
    }

    // --- Stratégie 5 : Contains sur nom de fichier normalisé (score 2) ---
    if (normalizedNomFichier.includes(normalizedQuery)) {
      addMatch(fiche, 2, 'contains');
      continue;
    }

    // --- Stratégie 6 : Contains sur nom_officiel normalisé (score 2) ---
    if (normalizedNomOfficiel && normalizedNomOfficiel.includes(normalizedQuery)) {
      addMatch(fiche, 2, 'contains');
      continue;
    }

    // --- Stratégie 7 : Levenshtein distance ≤ 2 sur nom complet, prénom ou nom de famille ---
    const queryParts = normalizedQuery.split(' ');

    // Levenshtein sur le nom complet de fichier
    const distFull = levenshtein(normalizedQuery, normalizedNomFichier);
    if (distFull <= 2) {
      addMatch(fiche, distFull, 'levenshtein');
      continue;
    }

    // Levenshtein sur le nom_officiel complet
    if (normalizedNomOfficiel) {
      const distOfficiel = levenshtein(normalizedQuery, normalizedNomOfficiel);
      if (distOfficiel <= 2) {
        addMatch(fiche, distOfficiel, 'levenshtein');
        continue;
      }
    }

    // Levenshtein sur le prénom seul (si query est un seul mot)
    if (queryParts.length === 1 && prenomFichier) {
      const distPrenom = levenshtein(normalizedQuery, prenomFichier);
      if (distPrenom <= 2) {
        addMatch(fiche, distPrenom, 'levenshtein');
        continue;
      }
    }

    // Levenshtein sur le nom de famille (si query est un seul mot)
    if (queryParts.length === 1 && nomFamilleFichier) {
      const distNom = levenshtein(normalizedQuery, nomFamilleFichier);
      if (distNom <= 2) {
        addMatch(fiche, distNom, 'levenshtein');
        continue;
      }
    }
  }

  // Trier par score croissant, puis par nom pour stabilité
  matches.sort((a, b) => a.score - b.score || a.nomFichier.localeCompare(b.nomFichier));

  // Top 5
  return matches.slice(0, 5);
}

// ============================================================
// API publique
// ============================================================

/**
 * Recherche un locataire par nom dans le Drive (recherche futée).
 *
 * Charge toutes les fiches (avec cache 60s), puis applique un matching
 * fuzzy : exact → startsWith → contains → Levenshtein ≤ 2.
 * Matche aussi le nom_officiel du frontmatter.
 *
 * @param query Nom ou fragment (ex: "Kenan", "Hélla", "Hella Atika Taoutaou")
 * @param forceRefresh Force le rechargement du cache Drive
 * @returns Locataire résolu si match unique, candidats si ambigu, totaux si zéro résultat
 */
export async function rechercherLocataire(
  query: string,
  forceRefresh = false,
): Promise<RechercheLocataireResult> {
  const emptyResult: RechercheLocataireResult = {
    locataire: null,
    candidats: [],
    totaux: { actuels: 0, candidats: 0 },
  };

  if (!query.trim()) return emptyResult;

  const cache = await loadAllFiches(forceRefresh);
  const matches = matchFiches(query, cache.fiches);

  // Décision : si 1 seul candidat avec score ≤ 1 → match évident
  if (matches.length === 1 && matches[0]!.score <= 1) {
    const match = matches[0]!;
    const fiche = cache.fiches.find(
      (f) => f.nomFichier === match.nomFichier && f.source === match.source,
    );
    return {
      locataire: fiche?.locataire ?? null,
      candidats: [],
      totaux: cache.totaux,
    };
  }

  // Si un seul candidat mais score > 1 → quand même retourner comme candidat
  // Si plusieurs candidats → retourner la liste
  if (matches.length > 0) {
    // Cas spécial : si le premier match est score 0 (exact) et le deuxième est > 0,
    // on prend le match exact directement
    if (matches[0]!.score === 0 && (matches.length === 1 || matches[1]!.score > 0)) {
      const match = matches[0]!;
      const fiche = cache.fiches.find(
        (f) => f.nomFichier === match.nomFichier && f.source === match.source,
      );
      return {
        locataire: fiche?.locataire ?? null,
        candidats: [],
        totaux: cache.totaux,
      };
    }

    return {
      locataire: null,
      candidats: matches,
      totaux: cache.totaux,
    };
  }

  // Zéro résultat
  return {
    locataire: null,
    candidats: [],
    totaux: cache.totaux,
  };
}

/**
 * Liste tous les locataires actuels depuis le Drive.
 *
 * @returns Liste de noms de fichiers (sans extension)
 */
export async function listerLocatairesActuels(): Promise<string[]> {
  const cache = await loadAllFiches();
  return cache.fiches
    .filter((f) => f.source === 'actuels')
    .map((f) => f.nomFichier)
    .sort();
}
