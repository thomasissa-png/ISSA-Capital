/**
 * Attachment handler — copie des pièces jointes email pertinentes vers le vault
 * (S23 — email-ingest cohérent).
 *
 * Anti-clutter STRICT (décision Thomas §6, verbatim « pas sauver tout et
 * n'importe quoi ») :
 *   - le FILTRE de pertinence est jugé par le triage LLM (`attachments_to_keep`),
 *     pas par ce module ;
 *   - la DESTINATION est rattachée à un SUJET SUIVI uniquement : projet détecté
 *     → sous-dossier `Documents/` de la fiche projet ; sinon dossier du contact ;
 *     sinon (aucun sujet suivi) → PAS de copie.
 *
 * Ce module fait deux choses :
 *   1. `resolveAttachmentDestination` — décide où classer (logique, pour la carte
 *      Telegram). Pas d'I/O réseau lourde, juste les résolutions vault avec cache.
 *   2. `executeCopyAttachment` — exécution réelle : download Gmail → résolution
 *      Drive du sous-dossier → upload binaire. Appelée après validation Thomas.
 *
 * R5 : upload PJ = nouveau fichier binaire (pas une édition de fiche).
 * Replit autoscale : l'upload est `await` AVANT toute réponse (R zéro fire-forget).
 */

import { downloadAttachment } from '../gmail-source/gmail-client';
import type { EmailAttachment, EmailMessage } from '../gmail-source/types';
import { findProjetFicheByEntite } from '../vault-reader';
import { findContactByEmail } from '../vault-client';
import { resolvePath } from '../vault-client/drive-resolver';
import {
  getAccessToken,
  getOrCreateSubfolder,
  uploadBinaryToFolder,
} from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

/**
 * Nom du sous-dossier Drive où classer les pièces jointes copiées.
 *
 * TODO orchestrator: confirmer contre _README vault — le nom exact peut différer
 * (« Documents » vs « Pièces jointes » vs « Docs »). Aligné par défaut sur le
 * sous-dossier `Documents` déjà utilisé par l'inbox photo-batch
 * (SUBFOLDER_ENV_MAP dans drive-upload.ts) pour cohérence cross-module.
 */
export const ATTACHMENT_SUBFOLDER = 'Documents';

/** Garde-fou serveur en plus du jugement LLM : ignore les PJ minuscules. */
const MIN_ATTACHMENT_BYTES = 15_000;

// ============================================================
// Résolution destination
// ============================================================

export type AttachmentDestinationKind = 'projet' | 'contact';

export interface AttachmentDestination {
  kind: AttachmentDestinationKind;
  /** Chemin logique du dossier de la fiche (projet ou contact). */
  baseFolderPath: string;
  /** Sous-dossier cible (ATTACHMENT_SUBFOLDER). */
  subfolder: string;
  /** Label humain pour la carte Telegram (nom fiche). */
  label: string;
}

/**
 * Résout la destination de classement des PJ pour un email.
 *
 * Priorité : projet détecté (code entité triage) → fiche projet ; sinon contact
 * connu (expéditeur) → fiche contact ; sinon null (aucun sujet suivi → pas de
 * copie, comportement attendu §6).
 *
 * @param projetCode Code entité projet (triage.projet) ou undefined.
 * @param fromEmail Email de l'expéditeur (pour le fallback contact).
 * @returns Destination logique, ou null si aucun sujet suivi.
 */
export async function resolveAttachmentDestination(
  projetCode: string | undefined,
  fromEmail: string,
): Promise<AttachmentDestination | null> {
  // 1. Projet détecté
  if (projetCode) {
    try {
      const fiche = await findProjetFicheByEntite(projetCode);
      if (fiche) {
        return {
          kind: 'projet',
          baseFolderPath: fiche.folderPath,
          subfolder: ATTACHMENT_SUBFOLDER,
          label: fiche.ficheName,
        };
      }
    } catch (err) {
      console.warn(
        `[attachment-handler] résolution fiche projet ${projetCode} échouée : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2. Contact connu (expéditeur)
  try {
    const contact = await findContactByEmail(fromEmail.toLowerCase().trim());
    if (contact) {
      return {
        kind: 'contact',
        baseFolderPath: contact.folderPath,
        subfolder: ATTACHMENT_SUBFOLDER,
        label: contact.name,
      };
    }
  } catch (err) {
    console.warn(
      `[attachment-handler] résolution contact ${fromEmail} échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 3. Aucun sujet suivi → pas de copie
  return null;
}

/**
 * Filtre les PJ d'un email selon le jugement LLM (`attachments_to_keep`) + un
 * garde-fou taille minimale côté serveur (anti pixel/signature).
 *
 * Match case-insensitive sur le filename. Si `keepFilenames` est vide/undefined
 * → aucune PJ retenue (dans le doute, on ne copie pas — §6).
 */
export function selectAttachmentsToKeep(
  attachments: EmailAttachment[],
  keepFilenames: string[] | undefined,
): EmailAttachment[] {
  if (!keepFilenames || keepFilenames.length === 0) return [];
  const wanted = new Set(keepFilenames.map((f) => f.toLowerCase().trim()));
  return attachments.filter(
    (a) =>
      wanted.has(a.name.toLowerCase().trim()) && a.sizeBytes >= MIN_ATTACHMENT_BYTES,
  );
}

// ============================================================
// Exécution copie
// ============================================================

export interface CopyAttachmentResult {
  ok: boolean;
  fileId?: string;
  error?: string;
}

/**
 * Exécute la copie d'une PJ vers le vault (download Gmail → upload Drive).
 *
 * Pipeline :
 *   1. Download binaire via Gmail attachments.get
 *   2. Résolution folderId Drive du dossier de base (resolvePath)
 *   3. getOrCreateSubfolder(ATTACHMENT_SUBFOLDER)
 *   4. uploadBinaryToFolder
 *
 * Tout échec → { ok:false, error } (jamais throw). Replit autoscale : tout est
 * `await` avant le retour (aucun fire-and-forget).
 *
 * @param messageId ID du message Gmail source.
 * @param attachment PJ à copier (name, mimeType, id=attachmentId).
 * @param destination Destination résolue (resolveAttachmentDestination).
 */
export async function executeCopyAttachment(
  messageId: string,
  attachment: { name: string; mimeType: string; id: string },
  destination: { baseFolderPath: string; subfolder: string },
): Promise<CopyAttachmentResult> {
  // 1. Download binaire
  const binary = await downloadAttachment(messageId, attachment.id);
  if (!binary) {
    return { ok: false, error: `download PJ "${attachment.name}" échoué` };
  }

  // 2. Token + résolution dossier de base
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'credentials OAuth2 manquants' };
  }

  const baseResolved = await resolvePath(destination.baseFolderPath);
  if (!baseResolved.success || !baseResolved.fileId) {
    return {
      ok: false,
      error: `dossier de base introuvable : ${destination.baseFolderPath}`,
    };
  }

  // 3. Sous-dossier (créé à la volée si absent)
  const subfolderId = await getOrCreateSubfolder(
    accessToken,
    baseResolved.fileId,
    destination.subfolder,
  );
  if (!subfolderId) {
    return {
      ok: false,
      error: `sous-dossier "${destination.subfolder}" introuvable/non créable`,
    };
  }

  // 4. Upload binaire
  const upload = await uploadBinaryToFolder(
    binary,
    attachment.name,
    attachment.mimeType,
    subfolderId,
  );
  if (!upload.success) {
    return { ok: false, error: upload.error ?? 'upload Drive échoué' };
  }

  return { ok: true, fileId: upload.fileId };
}

/**
 * Construit le payload d'une action `copy_attachment` à partir d'une PJ + d'une
 * destination résolue. Le payload est self-contained (sérialisable dans le
 * pending) — l'exécuteur n'a pas à re-résoudre la destination.
 */
export function buildCopyAttachmentPayload(
  email: EmailMessage,
  attachment: EmailAttachment,
  destination: AttachmentDestination,
): Record<string, unknown> {
  return {
    messageId: email.id,
    attachmentId: attachment.id,
    attachmentName: attachment.name,
    attachmentMimeType: attachment.mimeType,
    attachmentSizeBytes: attachment.sizeBytes,
    baseFolderPath: destination.baseFolderPath,
    subfolder: destination.subfolder,
    destinationKind: destination.kind,
    destinationLabel: destination.label,
  };
}
