/**
 * Lecture des fiches locataires depuis Google Drive.
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
 * Scope OAuth requis : drive.readonly (Thomas le migre manuellement via /api/drive-auth).
 */

import { getAccessToken } from '../drive-upload';
import type { Locataire } from './types';

// ============================================================
// Constantes Drive
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';

/**
 * Dossiers de recherche, dans l'ordre de priorité.
 * Le script Python cherche dans 01. Actuels/ puis _Candidats/.
 */
const LOCATAIRE_FOLDERS = [
  '01. Actuels',
  '_Candidats',
];

/** Regex pour extraire le frontmatter YAML d'un fichier Markdown */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

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
// API Drive
// ============================================================

/**
 * Recherche des fichiers .md dans un dossier Drive donné.
 *
 * @param accessToken Token OAuth2 valide
 * @param parentPath Chemin du dossier parent (ex: "07. Contacts/05. Locataires/01. Actuels")
 * @param query Optionnel : fragment de nom de fichier pour filtrer
 * @returns Liste de fichiers avec id et name
 */
async function searchDriveFiles(
  accessToken: string,
  folderQuery: string,
  nameFragment?: string,
): Promise<Array<{ id: string; name: string }>> {
  let q = `${folderQuery} and mimeType='text/markdown' and trashed=false`;
  if (nameFragment) {
    const escaped = nameFragment.replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=50`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error(`[locataires] search Drive échoué : HTTP ${response.status} — ${err.slice(0, 200)}`);
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
async function findDriveFolderByName(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string | null> {
  const escaped = folderName.replace(/'/g, "\\'");
  const q = `name='${escaped}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
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
 *
 * @param accessToken Token OAuth2
 * @param rootFolderId ID du dossier racine Obsidian (DRIVE_INBOX_FOLDER_ID parent ou My Drive root)
 * @param subfolder Nom du sous-dossier final ("01. Actuels" ou "_Candidats")
 * @returns ID du dossier trouvé, ou null
 */
async function navigateToLocataireFolder(
  accessToken: string,
  rootFolderId: string,
  subfolder: string,
): Promise<string | null> {
  // Naviguer dans l'arborescence : root → 07. Contacts → 05. Locataires → subfolder
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

/**
 * Recherche un locataire par nom dans le Drive.
 *
 * Ordre de recherche (port fidèle du Python) :
 * 1. 07. Contacts/05. Locataires/01. Actuels/
 * 2. 07. Contacts/05. Locataires/_Candidats/
 *
 * @param query Nom ou fragment (ex: "Kenan", "Kenan Beguigneau")
 * @returns Locataire parsé ou null si non trouvé / frontmatter invalide
 */
export async function rechercherLocataire(
  query: string,
): Promise<{ locataire: Locataire | null; alternatives: string[] }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('[locataires] pas de token OAuth2 pour Drive');
    return { locataire: null, alternatives: [] };
  }

  // ID du dossier racine Obsidian — on utilise le parent du dossier Inbox
  // ou le dossier spécifié dans DRIVE_VAULT_ROOT_ID
  const rootFolderId = process.env.DRIVE_VAULT_ROOT_ID ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!rootFolderId) {
    console.error('[locataires] DRIVE_VAULT_ROOT_ID ou DRIVE_INBOX_FOLDER_ID manquant');
    return { locataire: null, alternatives: [] };
  }

  for (const subfolder of LOCATAIRE_FOLDERS) {
    const folderId = await navigateToLocataireFolder(accessToken, rootFolderId, subfolder);
    if (!folderId) continue;

    // Chercher les fichiers .md dans ce dossier
    const q = `'${folderId}' in parents`;
    const files = await searchDriveFiles(accessToken, q, query);

    if (files.length === 0) continue;

    // Match exact (insensible à la casse, sans extension .md)
    const normalizedQuery = query.toLowerCase().trim();
    const exactMatch = files.find(
      (f) => f.name.replace(/\.md$/i, '').toLowerCase() === normalizedQuery,
    );

    if (exactMatch) {
      const content = await readDriveFileContent(accessToken, exactMatch.id);
      if (!content) continue;
      const locataire = parseFicheLocataire(content, exactMatch.name);
      return { locataire, alternatives: [] };
    }

    // Match partiel — si un seul résultat, on le prend
    if (files.length === 1 && files[0]) {
      const content = await readDriveFileContent(accessToken, files[0].id);
      if (!content) continue;
      const locataire = parseFicheLocataire(content, files[0].name);
      return { locataire, alternatives: [] };
    }

    // Plusieurs résultats — retourner les alternatives
    return {
      locataire: null,
      alternatives: files.map((f) => f.name.replace(/\.md$/i, '')),
    };
  }

  return { locataire: null, alternatives: [] };
}

/**
 * Liste tous les locataires actuels depuis le Drive.
 *
 * @returns Liste de noms de fichiers (sans extension)
 */
export async function listerLocatairesActuels(): Promise<string[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  const rootFolderId = process.env.DRIVE_VAULT_ROOT_ID ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!rootFolderId) return [];

  const folderId = await navigateToLocataireFolder(accessToken, rootFolderId, '01. Actuels');
  if (!folderId) return [];

  const q = `'${folderId}' in parents`;
  const files = await searchDriveFiles(accessToken, q);

  return files
    .map((f) => f.name.replace(/\.md$/i, ''))
    .filter((name) => !name.startsWith('_'))
    .sort();
}
