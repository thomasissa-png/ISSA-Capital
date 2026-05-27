/**
 * Résolution path logique vault → fileId Google Drive.
 *
 * Cache en mémoire avec TTL 1h, invalidé sur erreur 404.
 * Navigation segment par segment dans l'arborescence Drive.
 *
 * Règle CLAUDE.md n°23 : liste tous les enfants + filtre local
 * (Google Drive peut retourner silencieusement 0 résultat si scope insuffisant).
 *
 * Réutilise getAccessToken() de drive-upload.ts (mutualisation S13).
 */

import { getAccessToken } from '../drive-upload';
import { recordOAuthUsage } from '../health-monitor/oauth-timestamps';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

// ============================================================
// Types
// ============================================================

interface CacheEntry {
  fileId: string;
  cachedAt: number;
}

export interface DriveResolverResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

// ============================================================
// Cache
// ============================================================

/** Cache path → fileId avec TTL */
const pathCache = new Map<string, CacheEntry>();

/**
 * Invalide une entrée du cache.
 * Appelé sur erreur 404 pour forcer une re-résolution.
 */
export function invalidateCache(path: string): void {
  pathCache.delete(path);
}

/**
 * Invalide tout le cache.
 */
export function invalidateAllCache(): void {
  pathCache.clear();
}

/**
 * Retourne le nombre d'entrées en cache (pour les tests).
 */
export function getCacheSize(): number {
  return pathCache.size;
}

// ============================================================
// Normalisation pour matching local
// ============================================================

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// API Drive
// ============================================================

/**
 * Liste les enfants (fichiers ou dossiers) d'un dossier Drive.
 *
 * @param accessToken Token OAuth2
 * @param parentId ID du dossier parent
 * @param mimeTypeFilter Optionnel : filtrer par type MIME (ex: dossier ou markdown)
 */
async function listChildren(
  accessToken: string,
  parentId: string,
  mimeTypeFilter?: string,
): Promise<Array<{ id: string; name: string }>> {
  let q = `'${parentId}' in parents and trashed=false`;
  if (mimeTypeFilter) {
    q += ` and mimeType='${mimeTypeFilter}'`;
  }

  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=200`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.warn(
      `[drive-resolver] listChildren HTTP ${response.status} pour parent=${parentId} — ${err.slice(0, 300)}`,
    );
    return [];
  }

  const data = (await response.json()) as {
    files?: Array<{ id: string; name: string }>;
  };
  return data.files ?? [];
}

/**
 * Trouve un enfant par nom dans un dossier Drive.
 * Matching exact d'abord, puis normalisé (accents/casse).
 */
async function findChildByName(
  accessToken: string,
  parentId: string,
  childName: string,
  mimeTypeFilter?: string,
): Promise<string | null> {
  const children = await listChildren(accessToken, parentId, mimeTypeFilter);

  // 1. Match exact
  const exact = children.find((c) => c.name === childName);
  if (exact) return exact.id;

  // 2. Match normalisé
  const target = normalizeName(childName);
  const normalized = children.find((c) => normalizeName(c.name) === target);
  if (normalized) {
    console.warn(
      `[drive-resolver] match normalisé "${childName}" → "${normalized.name}" (id=${normalized.id})`,
    );
    return normalized.id;
  }

  return null;
}

// ============================================================
// Résolution de chemin
// ============================================================

/**
 * Résout un chemin logique vault en fileId Google Drive.
 *
 * Navigue segment par segment depuis la racine du vault (DRIVE_VAULT_ROOT_ID).
 * Cache le résultat pendant 1h. Invalide sur 404.
 *
 * @param logicalPath Chemin relatif depuis la racine vault (ex: "07. Contacts/05. Locataires/01. Actuels")
 * @param isFile Si true, le dernier segment est un fichier (pas un dossier)
 * @returns DriveResolverResult avec fileId si trouvé
 */
export async function resolvePath(
  logicalPath: string,
  isFile = false,
): Promise<DriveResolverResult> {
  // Vérifier le cache
  const cached = pathCache.get(logicalPath);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { success: true, fileId: cached.fileId };
  }

  // Obtenir le token OAuth
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Drive désactivé — credentials OAuth2 manquants',
    };
  }

  // Obtenir la racine du vault
  const rootId = process.env.DRIVE_VAULT_ROOT_ID;
  if (!rootId) {
    return {
      success: false,
      error: 'DRIVE_VAULT_ROOT_ID manquant dans les variables d\'environnement',
    };
  }

  // Naviguer segment par segment
  const segments = logicalPath.split('/').filter((s) => s.length > 0);
  let currentId = rootId;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const isLastSegment = i === segments.length - 1;
    const mimeFilter =
      isLastSegment && isFile
        ? undefined // Fichier : pas de filtre MIME (peut être .md, .jsonl, etc.)
        : 'application/vnd.google-apps.folder';

    const childId = await findChildByName(
      accessToken,
      currentId,
      segment,
      isLastSegment && isFile ? undefined : mimeFilter,
    );

    if (!childId) {
      // Invalider le cache du chemin complet (si c'était caché)
      invalidateCache(logicalPath);
      return {
        success: false,
        error: `Segment "${segment}" non trouvé dans le chemin "${logicalPath}" (parent: ${currentId})`,
      };
    }

    currentId = childId;

    // Cacher les chemins intermédiaires aussi
    const intermediatePath = segments.slice(0, i + 1).join('/');
    pathCache.set(intermediatePath, {
      fileId: currentId,
      cachedAt: Date.now(),
    });
  }

  // Cacher le chemin complet
  pathCache.set(logicalPath, {
    fileId: currentId,
    cachedAt: Date.now(),
  });

  // Health-monitor : enregistrer l'usage OAuth Drive (fire-and-forget, throttlé 1x/jour)
  recordOAuthUsage('drive');

  return { success: true, fileId: currentId };
}

/**
 * Résout le chemin d'un fichier .md spécifique dans un dossier.
 *
 * @param folderPath Chemin logique du dossier
 * @param filename Nom du fichier (ex: "Martin Yhuel.md")
 * @returns DriveResolverResult avec fileId si trouvé
 */
export async function resolveFilePath(
  folderPath: string,
  filename: string,
): Promise<DriveResolverResult> {
  const fullPath = `${folderPath}/${filename}`;
  return resolvePath(fullPath, true);
}

/**
 * Liste tous les fichiers .md dans un dossier Drive.
 *
 * @param folderPath Chemin logique du dossier
 * @returns Liste de { id, name } des fichiers .md trouvés
 */
export async function listMarkdownFiles(
  folderPath: string,
): Promise<Array<{ id: string; name: string }>> {
  // D'abord résoudre le dossier
  const folderResult = await resolvePath(folderPath);
  if (!folderResult.success || !folderResult.fileId) {
    return [];
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  // Lister les fichiers .md dans ce dossier
  // On ne filtre pas par mimeType car les .md uploadés peuvent avoir différents MIME
  const children = await listChildren(accessToken, folderResult.fileId);

  // Filtrer localement les fichiers .md
  return children.filter(
    (c) => c.name.endsWith('.md') && !c.name.startsWith('_'),
  );
}

/**
 * Liste les fichiers `.md` du vault modifiés depuis `sinceIso`, triés du plus
 * récent au plus ancien (S24 — revue hebdo hot-context : recouper les fiches de
 * la semaine pour détecter les oublis). Inclut les éditions manuelles de Thomas.
 *
 * Requête Drive globale par `modifiedTime` (pas de récursion de parents en
 * Drive query) ; on filtre localement les `.md` et on exclut les fichiers
 * techniques (`_…`, AnyaState/Logs). Best-effort : [] si token/HTTP KO.
 *
 * @param sinceIso Borne basse RFC 3339 (ex: il y a 7 jours).
 * @param cap Nombre max de fichiers retournés (défaut 12).
 */
export async function listRecentlyModifiedFiles(
  sinceIso: string,
  cap = 12,
): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  const q = `modifiedTime > '${sinceIso}' and trashed=false and name contains '.md'`;
  const url =
    `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=${Math.min(cap * 3, 100)}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[drive-resolver] listRecentlyModifiedFiles HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as {
      files?: Array<{ id: string; name: string; modifiedTime?: string }>;
    };
    return (data.files ?? [])
      .filter((f) => f.name.endsWith('.md') && !f.name.startsWith('_'))
      .map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime ?? '' }))
      .slice(0, cap);
  } catch (err) {
    console.warn(
      `[drive-resolver] listRecentlyModifiedFiles erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
