/**
 * Cache contacts connus — email-ingest Anya.
 *
 * Charge les contacts depuis le vault Drive (locataires actuels + pro),
 * met en cache mémoire TTL 1h, utilisé par le pipeline email-ingest
 * pour enrichir le contexte du triage Haiku.
 *
 * Règle CLAUDE.md n°23 : listing complet + filtre local.
 * Le pipeline tourne même sans contacts (retourne tableau vide sur erreur).
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4C §C.
 */

import type { KnownContact } from '../triage/types';
import { listMarkdownFiles } from '../vault-client/drive-resolver';
import { readFileById } from '../vault-client/obsidian-file';
import { parseObsidianFile, extractEmails } from '../vault-client/frontmatter';
import { getAccessToken } from '../drive-upload';
import * as paths from '../vault-client/vault-paths';

// ============================================================
// Constantes
// ============================================================

/** TTL du cache contacts : 1 heure */
const CACHE_TTL_MS = 60 * 60 * 1_000;

/** Limite de contacts pro chargés (par ordre alpha, pas de date de modif dispo) */
const PRO_CONTACTS_LIMIT = 20;

/** Limite de contacts amis chargés */
const AMIS_CONTACTS_LIMIT = 15;

// ============================================================
// Cache mémoire
// ============================================================

interface CacheEntry {
  data: KnownContact[];
  ts: number;
}

const contactsCache = new Map<'contacts', CacheEntry>();

// ============================================================
// API publique
// ============================================================

/**
 * Charge les contacts connus depuis le vault Drive.
 *
 * 1. Cache mémoire TTL 1h — retourne le cache si frais
 * 2. Sur cache miss :
 *    - Liste les fiches .md dans 07. Contacts/05. Locataires/01. Actuels/
 *    - Pour chaque fiche : extrait email + nom depuis le frontmatter
 *    - Liste les fiches .md dans 07. Contacts/01. Pro/ (top 20)
 * 3. Si listing échoue → retourne tableau vide + console.warn
 *
 * @returns Liste fusionnée des contacts connus
 */
export async function loadKnownContacts(): Promise<KnownContact[]> {
  // Vérifier le cache
  const cached = contactsCache.get('contacts');
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[contacts-cache] pas de token OAuth2 — retour tableau vide');
      return [];
    }

    const contacts: KnownContact[] = [];

    // 1. Locataires actuels
    const locataireFiles = await listMarkdownFiles(paths.LOCATAIRES_ACTUELS);
    for (const file of locataireFiles) {
      const contact = await extractContactFromFile(accessToken, file, 'locataire');
      if (contact) {
        contacts.push(contact);
      }
    }

    // 2. Contacts pro (top 20 par ordre alpha)
    const proFiles = await listMarkdownFiles(paths.CONTACTS_PRO);
    const proFilesLimited = proFiles.slice(0, PRO_CONTACTS_LIMIT);
    for (const file of proFilesLimited) {
      const contact = await extractContactFromFile(accessToken, file, 'pro');
      if (contact) {
        contacts.push(contact);
      }
    }

    // 3. Contacts amis (Carl, Maxime cofondateurs rangés en Amis — traités comme pro)
    const amisFiles = await listMarkdownFiles(paths.CONTACTS_AMIS);
    const amisFilesLimited = amisFiles.slice(0, AMIS_CONTACTS_LIMIT);
    for (const file of amisFilesLimited) {
      const contact = await extractContactFromFile(accessToken, file, 'pro');
      if (contact) {
        contacts.push(contact);
      }
    }

    console.warn(
      `[contacts-cache] chargé ${contacts.length} contact(s) (${locataireFiles.length} locataires, ${proFilesLimited.length} pros, ${amisFilesLimited.length} amis scannés)`,
    );

    // Mettre en cache
    contactsCache.set('contacts', { data: contacts, ts: Date.now() });

    return contacts;
  } catch (err) {
    console.warn(
      `[contacts-cache] erreur chargement : ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * Invalide le cache contacts (force un rechargement au prochain appel).
 */
export function invalidateContactsCache(): void {
  contactsCache.delete('contacts');
}

// ============================================================
// Fonctions internes
// ============================================================

/**
 * Extrait un KnownContact depuis un fichier .md Drive.
 *
 * Lit le frontmatter, extrait l'email et le nom.
 * Retourne null si le fichier n'a pas d'email dans le frontmatter.
 */
async function extractContactFromFile(
  accessToken: string,
  file: { id: string; name: string },
  type: 'locataire' | 'pro',
): Promise<KnownContact | null> {
  const readResult = await readFileById(accessToken, file.id);
  if (!readResult.success || !readResult.content) {
    return null;
  }

  const parsed = parseObsidianFile(readResult.content);
  const emails = extractEmails(parsed);

  if (emails.length === 0) {
    return null;
  }

  // Nom : utiliser le frontmatter 'nom' ou 'prenom' si disponible,
  // sinon le nom du fichier sans extension
  const name = extractName(parsed, file.name);

  return {
    name,
    email: emails[0]!,
    type,
  };
}

/**
 * Extrait le nom d'un contact depuis le frontmatter ou le nom de fichier.
 */
function extractName(
  parsed: { frontmatter: { fields: Record<string, string | number | boolean | null> } | null },
  filename: string,
): string {
  if (parsed.frontmatter) {
    const { fields } = parsed.frontmatter;
    const nom = fields['nom'];
    const prenom = fields['prenom'];

    if (typeof nom === 'string' && nom.trim()) {
      if (typeof prenom === 'string' && prenom.trim()) {
        return `${prenom.trim()} ${nom.trim()}`;
      }
      return nom.trim();
    }
  }

  // Fallback : nom du fichier sans extension
  return filename.replace(/\.md$/i, '').trim();
}
