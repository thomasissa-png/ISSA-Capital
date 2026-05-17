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

// ============================================================
// Caches mémoire
// ============================================================

/** Cache fichier : clé = "folderPath/filename" → contenu */
const fileCache = new Map<string, CachedItem<VaultFileResult>>();

/** Cache contact : clé = email normalisé → ContactMatch | null */
const contactCache = new Map<string, CachedItem<ContactMatch | null>>();

/** Cache dossier : clé = folderPath → liste d'entrées */
const folderCache = new Map<string, CachedItem<VaultFolderEntry[]>>();

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
 * Invalide tout le cache vault-reader (fichiers, contacts, dossiers).
 */
export function invalidateAllVaultCache(): void {
  fileCache.clear();
  contactCache.clear();
  folderCache.clear();
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
 * Retourne le nombre total d'entrées en cache (pour les tests).
 */
export function getVaultCacheSize(): {
  files: number;
  contacts: number;
  folders: number;
} {
  return {
    files: fileCache.size,
    contacts: contactCache.size,
    folders: folderCache.size,
  };
}
