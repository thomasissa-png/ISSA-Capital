/**
 * Vault reader — abstraction lecture vault Drive avec cache TTL.
 *
 * Fournit un cache read-through (TTL 1h en mémoire) au-dessus des
 * modules vault-client existants. Utilisé par :
 *   - contacts-cache.ts (chargement contacts pour le triage)
 *   - draft-composer.ts (lecture fiche contact pour tonalité)
 *   - tout futur module qui lit le vault
 *
 * En runtime production : appelle le vault-client existant (Google Drive API
 * via OAuth2 + fetch). Pas de dépendance MCP Claude Code.
 * En test : les modules vault-client sont mockés via vitest.
 *
 * Jalon 5D — Session 15.
 */

import { findContactByEmail as vaultFindContact } from './vault-client';
import type { ContactMatch } from './vault-client';
import { listMarkdownFiles } from './vault-client/drive-resolver';
import { readFileById } from './vault-client/obsidian-file';
import { getAccessToken } from './drive-upload';

// ============================================================
// Constantes
// ============================================================

/** TTL cache fichier : 1 heure */
const FILE_CACHE_TTL_MS = 60 * 60 * 1_000;

/** TTL cache contact lookup : 1 heure */
const CONTACT_CACHE_TTL_MS = 60 * 60 * 1_000;

/** TTL cache listing dossier : 1 heure */
const FOLDER_CACHE_TTL_MS = 60 * 60 * 1_000;

/** TTL cache fiche Projet : 1 heure (cohérent avec contacts-cache pattern) */
const PROJET_FICHE_CACHE_TTL_MS = 60 * 60 * 1_000;

/**
 * Chemin logique du dossier des fiches Projet vault (relatif à DRIVE_VAULT_ROOT_ID = "00. Me/").
 * Source de vérité : docs/session-s16-thomas-actions.md ("00. Me/02. Projets/02. Pro/<projet>.md").
 */
const PROJET_FICHE_FOLDER_PATH = '02. Projets/02. Pro';

/**
 * Mapping entité → nom de fiche Projet vault.
 *
 * Note (R7) : ce mapping est une **convention humaine stable** (code court entité ↔ nom
 * projet), pas un fileId Drive. Il survit aux renommages de fichiers (tant que Thomas
 * garde le nom canonique). Si Thomas renomme une fiche, on cherche par le nom canonique
 * via `searchByName`. Si le nom canonique change, c'est ici qu'il faut le mettre à jour
 * (1 ligne).
 *
 * Extensible : ajouter Versimo (VM), Immocrew (IM) si fiches Projet créées dans le vault.
 */
const ENTITE_TO_FICHE_NAME: Record<string, string> = {
  IC: 'ISSA Capital',
  GO: 'Gradient One',
  VI: 'Versi Immobilier',
  VV: 'Versi Invest',
};

// ============================================================
// Types
// ============================================================

interface CachedItem<T> {
  data: T;
  ts: number;
}

export interface VaultFileResult {
  success: boolean;
  content?: string;
  fileId?: string;
  error?: string;
}

export interface VaultFolderEntry {
  id: string;
  name: string;
}

export interface ProjetFicheResult {
  /** fileId Drive de la fiche Projet trouvée */
  fileId: string;
  /** Nom canonique de la fiche (ex: "ISSA Capital") */
  ficheName: string;
  /** Nom de fichier réel trouvé dans le vault (peut différer si renommé en .md) */
  resolvedFilename: string;
}

// ============================================================
// Caches mémoire
// ============================================================

/** Cache fichier : clé = "folderPath/filename" → contenu */
const fileCache = new Map<string, CachedItem<VaultFileResult>>();

/** Cache contact : clé = email normalisé → ContactMatch | null */
const contactCache = new Map<string, CachedItem<ContactMatch | null>>();

/** Cache dossier : clé = folderPath → liste d'entrées */
const folderCache = new Map<string, CachedItem<VaultFolderEntry[]>>();

/**
 * Cache fiche Projet : clé = entiteCode normalisé (uppercase) → ProjetFicheResult | null.
 * Identifiant explicite `__issa_projet_fiche_cache__` cohérent avec le pattern
 * `contacts-cache.ts` (S14) pour reconnaissance grep cross-projet.
 */
const __issa_projet_fiche_cache__ = new Map<
  string,
  CachedItem<ProjetFicheResult | null>
>();

// ============================================================
// API publique — Lecture fichier avec cache
// ============================================================

/**
 * Lit un fichier du vault avec cache TTL 1h.
 *
 * @param folderPath Chemin logique du dossier (ex: "07. Contacts/03. Pro")
 * @param filename Nom du fichier (ex: "Martin Yhuel.md")
 * @returns Contenu du fichier ou erreur
 */
export async function readVaultFile(
  folderPath: string,
  filename: string,
): Promise<VaultFileResult> {
  const cacheKey = `${folderPath}/${filename}`;

  // Cache hit ?
  const cached = fileCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < FILE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // Fallback : retourner le dernier cache s'il existe (stale)
      if (cached) {
        console.warn(`[vault-reader] pas de token — retour cache stale pour ${cacheKey}`);
        return cached.data;
      }
      return { success: false, error: 'Drive désactivé — credentials OAuth2 manquants' };
    }

    // Résoudre le fichier via listing du dossier
    const files = await listMarkdownFiles(folderPath);
    const file = files.find(
      (f) => f.name.toLowerCase() === filename.toLowerCase(),
    );

    if (!file) {
      const result: VaultFileResult = {
        success: false,
        error: `Fichier "${filename}" non trouvé dans "${folderPath}"`,
      };
      fileCache.set(cacheKey, { data: result, ts: Date.now() });
      return result;
    }

    const readResult = await readFileById(accessToken, file.id);
    const result: VaultFileResult = {
      success: readResult.success,
      content: readResult.content,
      fileId: file.id,
      error: readResult.error,
    };

    fileCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn(
      `[vault-reader] erreur lecture ${cacheKey} : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Fallback stale
    if (cached) {
      console.warn(`[vault-reader] retour cache stale pour ${cacheKey}`);
      return cached.data;
    }
    return { success: false, error: String(err) };
  }
}

// ============================================================
// API publique — Listing dossier avec cache
// ============================================================

/**
 * Liste les fichiers .md d'un dossier vault avec cache TTL 1h.
 *
 * @param folderPath Chemin logique du dossier
 * @returns Liste des fichiers { id, name }
 */
export async function listVaultFolder(
  folderPath: string,
): Promise<VaultFolderEntry[]> {
  // Cache hit ?
  const cached = folderCache.get(folderPath);
  if (cached && Date.now() - cached.ts < FOLDER_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const files = await listMarkdownFiles(folderPath);
    folderCache.set(folderPath, { data: files, ts: Date.now() });
    return files;
  } catch (err) {
    console.warn(
      `[vault-reader] erreur listing ${folderPath} : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Fallback stale
    if (cached) {
      console.warn(`[vault-reader] retour cache stale pour listing ${folderPath}`);
      return cached.data;
    }
    return [];
  }
}

// ============================================================
// API publique — Recherche contact avec cache
// ============================================================

/**
 * Cherche un contact par email avec cache TTL 1h.
 *
 * Wraps vault-client findContactByEmail avec un cache mémoire.
 * Si le vault est indisponible, retourne le dernier résultat caché.
 *
 * @param email Adresse email à chercher
 * @returns ContactMatch ou null
 */
export async function findContactCached(
  email: string,
): Promise<ContactMatch | null> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.includes('@')) return null;

  // Cache hit ?
  const cached = contactCache.get(normalizedEmail);
  if (cached && Date.now() - cached.ts < CONTACT_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const result = await vaultFindContact(normalizedEmail);
    contactCache.set(normalizedEmail, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn(
      `[vault-reader] erreur findContact ${normalizedEmail} : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Fallback stale
    if (cached) {
      console.warn(`[vault-reader] retour cache stale pour contact ${normalizedEmail}`);
      return cached.data;
    }
    return null;
  }
}

// ============================================================
// Invalidation du cache
// ============================================================

/**
 * Invalide tout le cache vault-reader (fichiers, contacts, dossiers, fiches Projet).
 */
export function invalidateAllVaultCache(): void {
  fileCache.clear();
  contactCache.clear();
  folderCache.clear();
  __issa_projet_fiche_cache__.clear();
}

/**
 * Invalide le cache d'un fichier spécifique.
 */
export function invalidateFileCache(folderPath: string, filename: string): void {
  fileCache.delete(`${folderPath}/${filename}`);
}

/**
 * Invalide le cache d'un contact spécifique.
 */
export function invalidateContactCache(email: string): void {
  contactCache.delete(email.toLowerCase().trim());
}

/**
 * Invalide le cache d'un dossier spécifique.
 */
export function invalidateFolderCache(folderPath: string): void {
  folderCache.delete(folderPath);
}

/**
 * Invalide le cache de la fiche Projet d'une entité spécifique.
 */
export function invalidateProjetFicheCache(entiteCode?: string): void {
  if (entiteCode) {
    __issa_projet_fiche_cache__.delete(entiteCode.toUpperCase().trim());
  } else {
    __issa_projet_fiche_cache__.clear();
  }
}

/**
 * Retourne le nombre total d'entrées en cache (pour les tests).
 */
export function getVaultCacheSize(): {
  files: number;
  contacts: number;
  folders: number;
  projetFiches: number;
} {
  return {
    files: fileCache.size,
    contacts: contactCache.size,
    folders: folderCache.size,
    projetFiches: __issa_projet_fiche_cache__.size,
  };
}

// ============================================================
// API publique — Résolution fiche Projet par code entité
// ============================================================

/**
 * Résout dynamiquement la fiche Projet vault correspondant à un code entité.
 *
 * Pipeline :
 *   1. Mapping entité → nom canonique (ex: IC → "ISSA Capital")
 *   2. Listing du dossier `02. Projets/02. Pro/` (live, avec cache TTL 1h)
 *   3. Match par nom (avec ou sans `.md`)
 *   4. Cache résultat 1h
 *
 * Fallback gracieux : si entité inconnue, dossier introuvable, ou fiche absente
 * → return `null` + log warn. Ne throw jamais.
 *
 * R7 : remplace l'ancien hardcoded `PROJET_FICHE_FILE_IDS`. Suit les renommages
 * de fichier Obsidian tant que le nom canonique reste cohérent.
 *
 * @param entiteCode Code entité (IC | GO | VI | VV — extensible)
 * @returns ProjetFicheResult avec fileId Drive, ou null si non trouvable
 */
export async function findProjetFicheByEntite(
  entiteCode: string,
): Promise<ProjetFicheResult | null> {
  const code = entiteCode?.toUpperCase().trim();
  if (!code) {
    console.warn('[vault-reader] findProjetFicheByEntite : entiteCode vide');
    return null;
  }

  // Cache hit ?
  const cached = __issa_projet_fiche_cache__.get(code);
  if (cached && Date.now() - cached.ts < PROJET_FICHE_CACHE_TTL_MS) {
    return cached.data;
  }

  // Lookup nom canonique
  const ficheName = ENTITE_TO_FICHE_NAME[code];
  if (!ficheName) {
    console.warn(
      `[vault-reader] entité inconnue "${code}" — codes connus : ${Object.keys(ENTITE_TO_FICHE_NAME).join(', ')}`,
    );
    // Cache du null pour éviter de retenter sur la même entité inconnue
    __issa_projet_fiche_cache__.set(code, { data: null, ts: Date.now() });
    return null;
  }

  try {
    // Lister le dossier des fiches Projet (utilise le cache folderCache via listVaultFolder)
    // Note S20.D : on ne fait PLUS d'early-return sur entries vide, car le refactor
    // sous-dossiers par entité peut laisser le dossier parent sans .md à plat. Le
    // fallback sous-dossier (Tentative 2) doit toujours pouvoir s'exécuter.
    const entries = await listVaultFolder(PROJET_FICHE_FOLDER_PATH);

    // Recherche : match exact "Nom.md" puis match par strip d'extension (case-insensitive)
    const targetWithExt = `${ficheName}.md`.toLowerCase();
    const targetBase = ficheName.toLowerCase();

    const matchFiche = (e: VaultFolderEntry): boolean => {
      const name = e.name.toLowerCase();
      return name === targetWithExt || name.replace(/\.md$/, '') === targetBase;
    };

    // Tentative 1 — Fiche à plat dans `02. Pro/<FicheName>.md` (structure historique)
    let found: VaultFolderEntry | undefined = entries.find(matchFiche);

    // Tentative 2 (S20.D) — Fiche dans sous-dossier `02. Pro/<FicheName>/<FicheName>.md`
    // (structure cible refactor Thomas : un sous-dossier par entité).
    //
    // Note implémentation : `listMarkdownFiles` (sous-jacent à `listVaultFolder`) ne
    // retourne QUE les fichiers .md d'un dossier, jamais les sous-dossiers. On ne peut
    // donc pas pré-filtrer la liste sur le mimeType. Stratégie : tenter directement le
    // listing du sous-dossier candidat — si le path n'existe pas, `resolvePath` renvoie
    // un échec gracieux et `listVaultFolder` renvoie `[]`. Pas de coût supplémentaire.
    if (!found) {
      const subfolderPath = `${PROJET_FICHE_FOLDER_PATH}/${ficheName}`;
      const subEntries = await listVaultFolder(subfolderPath);
      found = subEntries.find(matchFiche);
    }

    if (!found) {
      console.warn(
        `[vault-reader] fiche Projet "${ficheName}" non trouvée dans ${PROJET_FICHE_FOLDER_PATH} (ni à plat, ni dans sous-dossier "${ficheName}/") — entité ${code}`,
      );
      __issa_projet_fiche_cache__.set(code, { data: null, ts: Date.now() });
      return null;
    }

    const result: ProjetFicheResult = {
      fileId: found.id,
      ficheName,
      resolvedFilename: found.name,
    };

    __issa_projet_fiche_cache__.set(code, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.warn(
      `[vault-reader] erreur findProjetFicheByEntite(${code}) : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Fallback stale si existant
    if (cached) {
      console.warn(`[vault-reader] retour cache stale pour fiche Projet ${code}`);
      return cached.data;
    }
    return null;
  }
}

/**
 * Exporte les internals pour les tests (mapping + chemin dossier).
 * À utiliser exclusivement dans les fichiers `__tests__/`.
 */
export const _vaultReaderInternals = {
  ENTITE_TO_FICHE_NAME,
  PROJET_FICHE_FOLDER_PATH,
};
