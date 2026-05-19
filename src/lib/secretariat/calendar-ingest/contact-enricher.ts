/**
 * Contact-enricher — enrichissement automatique des fiches contacts vault
 * quand un participant de réunion correspond à une fiche existante.
 *
 * Pour chaque participant :
 *   1. Skip si email = Thomas (self)
 *   2. Skip si email système (isSystemEmail)
 *   3. findContactByEmail → si trouvé : append_historique + update_frontmatter
 *   4. Si pas trouvé : log (pas de création — red line S18.5)
 *
 * Cohérent avec S18.5 livrable A : enrichissement automatique des contacts
 * existants à chaque interaction (email reçu / réunion / etc.).
 *
 * R5 PATCH in-place sur les fiches contacts via appendToHistorique + updateFrontmatter.
 */

import {
  findContactByEmail,
  appendToHistorique,
} from '../vault-client';
import { isSystemEmail } from './event-mapper';
import type { CalendarEvent } from './types';

// ============================================================
// Types résultat
// ============================================================

export interface EnrichResult {
  /** Email du participant */
  email: string;
  /** Statut */
  status:
    | 'enriched'
    | 'no-contact'
    | 'skipped-self'
    | 'skipped-system'
    | 'error';
  /** Chemin vault de la fiche si match */
  contactPath?: string;
  error?: string;
}

// ============================================================
// API publique
// ============================================================

/**
 * Enrichit les fiches contacts vault correspondant aux participants d'un event.
 *
 * @param event Event Google Calendar normalisé
 * @param reunionDate Date YYYY-MM-DD de la réunion (utilisée pour l'historique)
 * @param reunionSubject Sujet de la réunion (titre de la ligne historique)
 * @returns Résultats par participant
 */
export async function enrichContactsFromEvent(
  event: CalendarEvent,
  reunionDate: string,
  reunionSubject: string,
): Promise<EnrichResult[]> {
  const results: EnrichResult[] = [];

  for (const attendee of event.attendees) {
    const email = attendee.email;
    if (!email || !email.includes('@')) continue;

    // Skip self
    if (attendee.self) {
      results.push({ email, status: 'skipped-self' });
      continue;
    }

    // Skip email système (noreply, resource.calendar.google.com, etc.)
    if (isSystemEmail(email)) {
      results.push({ email, status: 'skipped-system' });
      continue;
    }

    // Recherche contact
    let contact;
    try {
      contact = await findContactByEmail(email);
    } catch (err) {
      results.push({
        email,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!contact) {
      // Pas de fiche → log mais pas de création (red line S18.5)
      console.warn(
        `[contact-enricher] pas de fiche vault pour ${email} (event=${event.id}) — skip enrichissement`,
      );
      results.push({ email, status: 'no-contact' });
      continue;
    }

    // Enrichissement : append_historique + update date_dernière_interaction
    const filename = contact.name.endsWith('.md')
      ? contact.name
      : `${contact.name}.md`;

    const historyTitle = `${reunionDate} — Réunion : ${reunionSubject}`;
    const historyContent = [
      `Réunion Google Calendar (event ${event.id})`,
      event.location ? `Lieu : ${event.location}` : null,
      event.hangoutLink ? `Visio : ${event.hangoutLink}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    let ok = false;
    try {
      ok = await appendToHistorique(contact.folderPath, filename, {
        title: historyTitle,
        content: historyContent,
        trigger: `calendar-ingest:${event.id}`,
        updateLastInteraction: true,
      });
    } catch (err) {
      results.push({
        email,
        status: 'error',
        contactPath: `${contact.folderPath}/${filename}`,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!ok) {
      results.push({
        email,
        status: 'error',
        contactPath: `${contact.folderPath}/${filename}`,
        error: 'appendToHistorique a retourné false',
      });
      continue;
    }

    results.push({
      email,
      status: 'enriched',
      contactPath: `${contact.folderPath}/${filename}`,
    });
  }

  return results;
}

// ============================================================
// Helpers exposés
// ============================================================

export function countEnriched(results: EnrichResult[]): number {
  return results.filter((r) => r.status === 'enriched').length;
}

export function countNoContact(results: EnrichResult[]): number {
  return results.filter((r) => r.status === 'no-contact').length;
}
