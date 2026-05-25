/**
 * Projet-enricher — enrichissement de l'historique d'une fiche Projet vault
 * quand un event Google Calendar matche un projet connu (refonte S23).
 *
 * Pipeline (1 code entité) :
 *   1. findProjetFicheByEntite(code) → { fileId, ficheName, resolvedFilename, folderPath }
 *   2. appendToHistorique(folderPath, resolvedFilename, …) — PATCH in-place (R5)
 *
 * findProjetFicheByEntite (vault-reader, R7) résout dynamiquement le chemin de la
 * fiche (à plat `02. Projets/02. Pro/<Nom>.md` OU sous-dossier `…/<Nom>/<Nom>.md`)
 * et expose `folderPath` (ajouté S23) → on évite de réinventer la résolution.
 *
 * Red line : jamais de création de fiche projet (comme contact-enricher S18.5).
 * Si la fiche n'existe pas → log + skip silencieux.
 */

import { findProjetFicheByEntite } from '../vault-reader';
import { appendToHistorique } from '../vault-client';
import type { EventProjection } from './types';

// ============================================================
// Types résultat
// ============================================================

export interface ProjetEnrichResult {
  /** Code entité (IC | GO | VI | VV | VM | IM) */
  code: string;
  status: 'enriched' | 'no-fiche' | 'error';
  /** Nom canonique de la fiche si trouvée */
  ficheName?: string;
  error?: string;
}

// ============================================================
// API publique
// ============================================================

/**
 * Enrichit l'historique de la fiche Projet d'un code entité avec une ligne
 * pointant vers la réunion. Append-only (R5 PATCH in-place via appendToHistorique).
 *
 * @param code Code entité (IC | GO | VI | VV | VM | IM)
 * @param projection Projection de l'event (date, sujet, lieu, lien)
 * @param eventId ID Google Calendar (pour le trigger d'audit)
 */
export async function enrichProjetHistorique(
  code: string,
  projection: EventProjection,
  eventId: string,
): Promise<ProjetEnrichResult> {
  let fiche;
  try {
    fiche = await findProjetFicheByEntite(code);
  } catch (err) {
    return {
      code,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!fiche) {
    console.warn(
      `[projet-enricher] fiche Projet introuvable pour entité ${code} (event=${eventId}) — skip`,
    );
    return { code, status: 'no-fiche' };
  }

  const historyTitle = `${projection.date} — Réunion : ${projection.sujet}`;
  const historyContent = [
    `Réunion Google Calendar (event ${eventId})`,
    projection.heure ? `Heure : ${projection.heure}` : null,
    projection.lieu ? `Lieu : ${projection.lieu}` : null,
    projection.googleHtmlLink ? `Lien : ${projection.googleHtmlLink}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  let ok = false;
  try {
    ok = await appendToHistorique(fiche.folderPath, fiche.resolvedFilename, {
      title: historyTitle,
      content: historyContent,
      trigger: `calendar-ingest:${eventId}`,
      updateLastInteraction: false,
    });
  } catch (err) {
    return {
      code,
      status: 'error',
      ficheName: fiche.ficheName,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!ok) {
    return {
      code,
      status: 'error',
      ficheName: fiche.ficheName,
      error: 'appendToHistorique a retourné false',
    };
  }

  return { code, status: 'enriched', ficheName: fiche.ficheName };
}
