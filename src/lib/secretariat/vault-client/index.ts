/**
 * Vault client — API publique.
 *
 * Point d'entrée unique pour lire et écrire dans le vault Obsidian
 * hébergé sur Google Drive. Utilisé par email-ingest et les futurs
 * workflows Anya qui interagissent avec les fiches du vault.
 *
 * Toutes les opérations d'écriture :
 * 1. Loggent dans l'audit trail AVANT l'opération
 * 2. Sont sérialisées par path (write-lock)
 * 3. Préservent le frontmatter caractère pour caractère (sauf modifications explicites)
 */

import { getAccessToken } from '../drive-upload';
import * as paths from './vault-paths';
import { listMarkdownFiles } from './drive-resolver';
import { readFile, readFileById, writeFile, createFile } from './obsidian-file';
import {
  parseObsidianFile,
  patchFrontmatterField,
  upsertFrontmatterField,
  extractEmails,
} from './frontmatter';
import { computeRelationStats } from './relation-stats';
import { appendToSection } from './markdown-append';
import { writeAuditLog, buildAuditEntry } from './audit-log';
import { withWriteLock } from './write-lock';

// ============================================================
// Types
// ============================================================

export interface ContactMatch {
  /** Nom du fichier (sans extension) */
  name: string;
  /** Chemin logique du dossier contenant la fiche */
  folderPath: string;
  /** Emails trouvés dans le frontmatter */
  emails: string[];
  /** Contenu complet du fichier */
  content: string;
  /** FileId Google Drive */
  fileId: string;
}

export interface AppendHistoriqueOptions {
  /** Titre de la section H3 (ex: "2026-05-13 — Demande quittance mai") */
  title: string;
  /** Contenu de la section (Markdown) */
  content: string;
  /** Identifiant du déclencheur pour l'audit trail */
  trigger: string;
  /** Mettre à jour date_dernière_interaction dans le frontmatter */
  updateLastInteraction?: boolean;
}

export interface UpdateFrontmatterOptions {
  /** Chemin logique du dossier */
  folderPath: string;
  /** Nom du fichier */
  filename: string;
  /** Champs à modifier (clé → nouvelle valeur) */
  fields: Record<string, string | number | boolean | null>;
  /** Identifiant du déclencheur pour l'audit trail */
  trigger: string;
}

// ============================================================
// Recherche de contact par email
// ============================================================

/**
 * Recherche un contact dans le vault par adresse email.
 *
 * Scanne les dossiers dans l'ordre CONTACT_SEARCH_PATHS :
 * 1. Locataires actuels
 * 2. Candidats locataires
 * 3. Contacts pro
 * 4. Contacts famille
 *
 * Match sur le champ `email` du frontmatter ET sur `alias_email` (liste).
 *
 * @param email Adresse email à chercher
 * @returns Le premier contact trouvé, ou null
 */
export async function findContactByEmail(
  email: string,
): Promise<ContactMatch | null> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.includes('@')) return null;

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  for (const folderPath of paths.CONTACT_SEARCH_PATHS) {
    const files = await listMarkdownFiles(folderPath);

    for (const file of files) {
      const readResult = await readFileById(accessToken, file.id);
      if (!readResult.success || !readResult.content) continue;

      const parsed = parseObsidianFile(readResult.content);
      const emails = extractEmails(parsed);

      if (emails.includes(normalizedEmail)) {
        return {
          name: file.name.replace(/\.md$/i, ''),
          folderPath,
          emails,
          content: readResult.content,
          fileId: file.id,
        };
      }
    }
  }

  return null;
}

// ============================================================
// Append à l'historique d'une fiche
// ============================================================

/**
 * Ajoute une entrée dans la section ## Historique d'une fiche.
 *
 * L'entrée est insérée en ordre chrono inverse (la plus récente en premier).
 * Si la section ## Historique n'existe pas, elle est créée.
 * Optionnellement, met à jour `date_dernière_interaction` dans le frontmatter.
 *
 * @param folderPath Chemin logique du dossier
 * @param filename Nom du fichier
 * @param options Options de l'append
 * @returns true si l'opération a réussi
 */
export async function appendToHistorique(
  folderPath: string,
  filename: string,
  options: AppendHistoriqueOptions,
): Promise<boolean> {
  const lockPath = `${folderPath}/${filename}`;

  return withWriteLock(lockPath, async () => {
    // Audit log — AVANT l'opération
    const auditEntry = buildAuditEntry(
      'append_historique',
      `${folderPath}/${filename}`,
      options.trigger,
      {
        section: `### ${options.title}`,
        content: options.content.slice(0, 200),
        updateLastInteraction: options.updateLastInteraction ?? false,
      },
    );
    await writeAuditLog(auditEntry);

    // Lire la fiche actuelle
    const readResult = await readFile(folderPath, filename);
    if (!readResult.success || !readResult.content) {
      await writeAuditLog({
        ...auditEntry,
        status: 'error',
        errorMessage: readResult.error ?? 'Lecture échouée',
      });
      return false;
    }

    let updatedContent = readResult.content;

    // Append à ## Historique
    updatedContent = appendToSection(updatedContent, 'Historique', {
      title: options.title,
      content: options.content,
    });

    // Optionnellement, mettre à jour date_dernière_interaction + stats relation.
    // updateLastInteraction=true ⇔ interaction CONTACT (les fiches projet posent
    // false) → on en profite pour rafraîchir canal_préféré + fréquence_échanges
    // dérivés de l'historique (tous canaux confondus). S24.
    if (options.updateLastInteraction) {
      const today = new Date().toISOString().slice(0, 10);
      // Clé SANS accent : les fiches réelles du vault utilisent
      // `date_derniere_interaction` (les handlers email aussi). L'ancienne clé
      // accentuée `date_dernière_interaction` ne matchait jamais → no-op
      // silencieux (bug S24). upsert : ajoute la clé si la fiche ne l'a pas.
      updatedContent = upsertFrontmatterField(
        updatedContent,
        'date_derniere_interaction',
        today,
      );

      const stats = computeRelationStats(updatedContent);
      if (stats.canalPrefere) {
        updatedContent = upsertFrontmatterField(updatedContent, 'canal_préféré', stats.canalPrefere);
      }
      if (stats.frequence) {
        updatedContent = upsertFrontmatterField(updatedContent, 'fréquence_échanges', stats.frequence);
      }
    }

    // Écrire la fiche mise à jour
    const writeResult = await writeFile(folderPath, filename, updatedContent);
    if (!writeResult.success) {
      await writeAuditLog({
        ...auditEntry,
        status: 'error',
        errorMessage: writeResult.error ?? 'Écriture échouée',
      });
      return false;
    }

    // Audit log — succès
    await writeAuditLog({ ...auditEntry, status: 'success' });
    return true;
  });
}

// ============================================================
// Mise à jour du frontmatter
// ============================================================

/**
 * Met à jour un ou plusieurs champs du frontmatter d'une fiche.
 *
 * Chaque champ est patché individuellement (pas de re-sérialisation complète).
 * L'ordre des clés et les champs non modifiés sont préservés bit pour bit.
 *
 * @param options Options de mise à jour
 * @returns true si l'opération a réussi
 */
export async function updateFrontmatter(
  options: UpdateFrontmatterOptions,
): Promise<boolean> {
  const lockPath = `${options.folderPath}/${options.filename}`;

  return withWriteLock(lockPath, async () => {
    // Audit log
    const auditEntry = buildAuditEntry(
      'update_frontmatter',
      lockPath,
      options.trigger,
      { fields: options.fields },
    );
    await writeAuditLog(auditEntry);

    // Lire la fiche actuelle
    const readResult = await readFile(options.folderPath, options.filename);
    if (!readResult.success || !readResult.content) {
      await writeAuditLog({
        ...auditEntry,
        status: 'error',
        errorMessage: readResult.error ?? 'Lecture échouée',
      });
      return false;
    }

    // Patcher chaque champ
    let updatedContent = readResult.content;
    for (const [key, value] of Object.entries(options.fields)) {
      updatedContent = patchFrontmatterField(updatedContent, key, value);
    }

    // Écrire la fiche mise à jour
    const writeResult = await writeFile(
      options.folderPath,
      options.filename,
      updatedContent,
    );
    if (!writeResult.success) {
      await writeAuditLog({
        ...auditEntry,
        status: 'error',
        errorMessage: writeResult.error ?? 'Écriture échouée',
      });
      return false;
    }

    await writeAuditLog({ ...auditEntry, status: 'success' });
    return true;
  });
}

// ============================================================
// Création de fichier
// ============================================================

/**
 * Crée un nouveau fichier .md dans le vault.
 *
 * @param folderPath Chemin logique du dossier
 * @param filename Nom du fichier
 * @param content Contenu initial
 * @param trigger Identifiant du déclencheur pour l'audit trail
 * @returns true si la création a réussi
 */
export async function createVaultFile(
  folderPath: string,
  filename: string,
  content: string,
  trigger: string,
): Promise<boolean> {
  const auditEntry = buildAuditEntry(
    'create_file',
    `${folderPath}/${filename}`,
    trigger,
    { contentLength: content.length },
  );
  await writeAuditLog(auditEntry);

  const result = await createFile(folderPath, filename, content);
  if (!result.success) {
    await writeAuditLog({
      ...auditEntry,
      status: 'error',
      errorMessage: result.error ?? 'Création échouée',
    });
    return false;
  }

  await writeAuditLog({ ...auditEntry, status: 'success' });
  return true;
}

// ============================================================
// Re-exports pour usage externe
// ============================================================

export { paths };
export { parseObsidianFile, patchFrontmatterField, upsertFrontmatterField, extractEmails } from './frontmatter';
export { computeRelationStats } from './relation-stats';
export { appendToSection, hasSection, extractSection } from './markdown-append';
export { withWriteLock, getActiveWriteLockCount, clearWriteLocks } from './write-lock';
export { resolvePath, invalidateAllCache, invalidateCache } from './drive-resolver';
export { readFile, readFileById, writeFile, writeFileById, createFile } from './obsidian-file';
export { writeAuditLog, buildAuditEntry } from './audit-log';
export type { ObsidianFile, ParsedFrontmatter } from './frontmatter';
export type { AuditLogEntry } from './audit-log';
export type { ReadFileResult, WriteFileResult } from './obsidian-file';
export type { DriveResolverResult } from './drive-resolver';
