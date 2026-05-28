/**
 * Contacts vault Drive — pipeline CR Anya.
 *
 * Lit les fiches contacts Obsidian depuis le vault Google Drive
 * (dossiers 07. Contacts/{01. Famille, 02. Amis, 03. Pro, 04. Autres}).
 * Cache mémoire TTL 1h avec stale fallback (pattern contacts-cache.ts).
 *
 * Consommé par contacts.ts via getAllContacts() pour enrichir le prompt CR
 * avec TOUS les contacts du vault (fix bug Gregory Pittet non reconnu).
 *
 * Jalon S15.5F — Migration pipeline CR vers vault Drive.
 */

import { listVaultFolder } from './vault-reader';
import { readFileById } from './vault-client/obsidian-file';
import { parseObsidianFile } from './vault-client/frontmatter';
import { getAccessToken } from './drive-upload';
import * as paths from './vault-client/vault-paths';

// ============================================================
// Types
// ============================================================

export interface VaultContact {
  prenom: string;
  nom: string;
  titre: string;
  societe: string;
  entitesVisibles: string[];
  notes?: string;
  email?: string;
  telephone?: string;
  /**
   * S26 — Téléphones alias (frontmatter `alias_telephone:` liste). Ajoutés via
   * le bouton « Lier » d'une carte no-match WhatsApp. Indexés par
   * `buildPhoneIndex` pour que les contacts liés ne re-déclenchent pas de
   * carte au cron suivant (bug observé S26 : alias_telephone non indexé).
   */
  aliasTelephones?: string[];
  categorie?: string;
  surnoms?: string[];
  tags?: string[];
  /** Chemin logique du dossier de la fiche (pour enrichissement direct). */
  folderPath?: string;
  /** Nom du fichier de la fiche (ex « Jean Dupont.md »). */
  filename?: string;
}

// ============================================================
// Constantes
// ============================================================

/** TTL du cache vault contacts : 1 heure */
const CACHE_TTL_MS = 60 * 60 * 1_000;

/**
 * Dossiers contacts à scanner (ordre = priorité de listing).
 * On ne scanne pas les locataires ici (pas pertinent pour les CR).
 */
const CONTACT_FOLDERS = [
  paths.CONTACTS_FAMILLE,
  paths.CONTACTS_AMIS,
  paths.CONTACTS_PRO,
  paths.CONTACTS_AUTRES,
] as const;

/** Limite par dossier (sécurité anti-explosion) */
const PER_FOLDER_LIMIT = 50;

// ============================================================
// Cache mémoire
// ============================================================

interface CacheEntry {
  data: VaultContact[];
  ts: number;
}

let vaultContactsCache: CacheEntry | null = null;

// ============================================================
// API publique
// ============================================================

/**
 * Charge tous les contacts depuis le vault Drive.
 *
 * 1. Cache mémoire TTL 1h — retourne le cache si frais
 * 2. Sur cache miss : liste les fiches .md dans chaque sous-dossier contacts,
 *    parse le frontmatter + body, extrait les champs VaultContact
 * 3. Si erreur Drive → stale fallback ou tableau vide
 *
 * @returns Liste des VaultContact parsés depuis le vault
 */
export async function getVaultContacts(): Promise<VaultContact[]> {
  // Cache hit ?
  if (vaultContactsCache && Date.now() - vaultContactsCache.ts < CACHE_TTL_MS) {
    return vaultContactsCache.data;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[vault-contacts] pas de token OAuth2 — retour cache stale ou []');
      return vaultContactsCache?.data ?? [];
    }

    const contacts: VaultContact[] = [];

    for (const folder of CONTACT_FOLDERS) {
      try {
        const files = await listVaultFolder(folder);
        const limited = files.slice(0, PER_FOLDER_LIMIT);

        for (const file of limited) {
          if (!file.name.toLowerCase().endsWith('.md')) continue;

          try {
            const readResult = await readFileById(accessToken, file.id);
            if (!readResult.success || !readResult.content) continue;

            const contact = parseContactFile(readResult.content, file.name, folder);
            if (contact) {
              contacts.push(contact);
            }
          } catch (err) {
            console.warn(
              `[vault-contacts] erreur lecture fiche ${file.name} : ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      } catch (err) {
        console.warn(
          `[vault-contacts] erreur listing ${folder} : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.warn(
      `[vault-contacts] chargé ${contacts.length} contact(s) depuis ${CONTACT_FOLDERS.length} dossiers`,
    );

    // Si 0 contacts chargés mais stale existe → probable erreur Drive,
    // garder le stale plutôt qu'écraser avec une liste vide
    if (contacts.length === 0 && vaultContactsCache && vaultContactsCache.data.length > 0) {
      console.warn('[vault-contacts] 0 contacts chargés mais stale disponible — retour stale');
      return vaultContactsCache.data;
    }

    // Mettre en cache
    vaultContactsCache = { data: contacts, ts: Date.now() };

    return contacts;
  } catch (err) {
    console.warn(
      `[vault-contacts] erreur globale : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Stale fallback
    return vaultContactsCache?.data ?? [];
  }
}

/**
 * Invalide le cache vault contacts (force un rechargement au prochain appel).
 */
export function invalidateVaultContactsCache(): void {
  vaultContactsCache = null;
}

/**
 * Retourne le timestamp du cache actuel (pour les tests).
 */
export function getVaultContactsCacheTs(): number | null {
  return vaultContactsCache?.ts ?? null;
}

// ============================================================
// Parse fiche contact
// ============================================================

/**
 * Parse une fiche contact Obsidian (.md) et retourne un VaultContact.
 *
 * Retourne null si :
 * - Pas de frontmatter
 * - frontmatter.type !== 'contact'
 * - Impossible d'extraire prenom+nom
 *
 * @param content Contenu brut du fichier .md
 * @param filename Nom du fichier (fallback pour prenom+nom)
 * @returns VaultContact ou null
 */
export function parseContactFile(
  content: string,
  filename: string,
  folderPath?: string,
): VaultContact | null {
  try {
    const parsed = parseObsidianFile(content);

    // Vérifier type: contact dans le frontmatter
    if (!parsed.frontmatter) return null;
    const typeField = parsed.frontmatter.fields['type'];
    if (typeField !== 'contact') return null;

    // Extraire prenom + nom depuis le premier H1 du body
    const { prenom, nom } = extractName(parsed.body, filename);
    if (!prenom && !nom) return null;

    // Frontmatter fields
    const fm = parsed.frontmatter.fields;
    const fmLists = parsed.frontmatter.lists;

    // Email
    const email = typeof fm['email'] === 'string' && fm['email'].includes('@')
      ? fm['email'].trim()
      : undefined;

    // Telephone
    const telephone = typeof fm['telephone'] === 'string' && fm['telephone'].trim()
      ? fm['telephone'].trim()
      : undefined;

    // S26 — alias_telephone (liste). Indexés par buildPhoneIndex pour qu'un
    // contact lié via le bouton « Lier » ne re-déclenche pas de carte.
    const aliasTelephones = fmLists['alias_telephone'] && fmLists['alias_telephone'].length > 0
      ? fmLists['alias_telephone'].filter((s) => s && s.trim().length > 0)
      : undefined;

    // Categorie
    const categorie = typeof fm['categorie'] === 'string' && fm['categorie'].trim()
      ? fm['categorie'].trim()
      : undefined;

    // Tags (depuis frontmatter lists)
    const tags = fmLists['tags'] && fmLists['tags'].length > 0
      ? fmLists['tags']
      : undefined;

    // Notes : concatène "## Qui c'est" + "## Notes" (limite 500 chars)
    const notes = extractNotes(parsed.body);

    // Titre + société : best-effort depuis "## Parcours pro"
    const { titre, societe } = extractTitreSociete(parsed.body);

    // Surnoms : regex dans tout le contenu
    const surnoms = extractSurnoms(parsed.body);

    return {
      prenom,
      nom,
      titre,
      societe,
      entitesVisibles: [],
      notes: notes || undefined,
      email,
      telephone,
      aliasTelephones,
      categorie,
      surnoms: surnoms.length > 0 ? surnoms : undefined,
      tags,
      folderPath,
      filename,
    };
  } catch (err) {
    console.warn(
      `[vault-contacts] erreur parse ${filename} : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ============================================================
// Extracteurs
// ============================================================

/**
 * Extrait prenom + nom depuis le premier H1 du body.
 * Fallback : depuis le nom de fichier (sans .md).
 */
function extractName(
  body: string,
  filename: string,
): { prenom: string; nom: string } {
  // Chercher le premier # Titre
  const h1Match = /^#\s+(.+)$/m.exec(body);
  if (h1Match && h1Match[1]) {
    const fullName = h1Match[1].trim();
    return splitName(fullName);
  }

  // Fallback : nom du fichier sans extension
  const baseName = filename.replace(/\.md$/i, '').trim();
  if (baseName) {
    return splitName(baseName);
  }

  return { prenom: '', nom: '' };
}

/**
 * Split un nom complet en prenom + nom.
 * Heuristique : le dernier mot est le nom de famille,
 * tout le reste est le prenom (gere les noms composes).
 */
function splitName(fullName: string): { prenom: string; nom: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { prenom: '', nom: '' };
  if (parts.length === 1) return { prenom: parts[0]!, nom: '' };

  // Dernier mot = nom, reste = prenom
  const nom = parts[parts.length - 1]!;
  const prenom = parts.slice(0, -1).join(' ');
  return { prenom, nom };
}

/**
 * Extrait les notes depuis les sections "## Qui c'est" et "## Notes".
 * Limite totale : 500 caractères.
 */
function extractNotes(body: string): string {
  const sections: string[] = [];

  const quiCest = extractSection(body, 'Qui c\'est');
  if (quiCest) sections.push(quiCest);

  const notes = extractSection(body, 'Notes');
  if (notes) sections.push(notes);

  const combined = sections.join(' ').trim();
  if (combined.length > 500) {
    return combined.slice(0, 497) + '...';
  }
  return combined;
}

/**
 * Extrait le contenu d'une section ## dans le body Markdown.
 * Retourne le texte entre le ## titre et le prochain ## (ou fin de fichier).
 */
function extractSection(body: string, sectionName: string): string | null {
  // Escape les caractères spéciaux regex dans le nom de section
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const match = re.exec(body);
  if (!match) return null;

  const startIdx = match.index! + match[0].length;
  // Trouver le prochain ## ou la fin
  const nextSection = /^##\s+/m.exec(body.slice(startIdx));
  const endIdx = nextSection ? startIdx + nextSection.index! : body.length;

  const content = body.slice(startIdx, endIdx).trim();
  return content || null;
}

/**
 * Extrait titre et société depuis la section "## Parcours pro".
 * Best-effort : cherche des patterns courants.
 */
function extractTitreSociete(body: string): { titre: string; societe: string } {
  const parcours = extractSection(body, 'Parcours pro');
  if (!parcours) return { titre: '', societe: '' };

  // Pattern : "Titre chez/à/at Société" ou "(ex-Société)"
  // Ex : "En congé de reclassement (ex-Sony). Phase de transition pro post-Sony."
  // Ex : "Avocat associé chez PNM Avocats"
  // Ex : "Directeur général de ABC Corp"

  let titre = '';
  let societe = '';

  // Pattern "(ex-Société)" — tester en premier (évite faux positif "congé de reclassement")
  const exMatch = /\(ex[- ](.+?)\)/i.exec(parcours);
  if (exMatch) {
    societe = exMatch[1]!.trim();
  }

  // Pattern "X chez Y" / "X à Y" / "X at Y" (pas "de" — trop de faux positifs)
  const chezMatch = /^(.+?)\s+(?:chez|à|at)\s+(.+?)(?:\.|,|$)/im.exec(parcours);
  if (chezMatch) {
    titre = chezMatch[1]!.trim();
    societe = chezMatch[2]!.trim();
    return { titre, societe };
  }

  return { titre, societe };
}

/**
 * Extrait les surnoms depuis le body.
 * Patterns : Surnommé "X", appelé "Y", surnommé «X», appelé «Y»
 */
function extractSurnoms(body: string): string[] {
  const surnoms: string[] = [];

  // Pattern guillemets doubles/simples/français
  const patterns = [
    /[Ss]urnomm[ée]\s+["«]([^"»]+)["»]/g,
    /[Aa]ppel[ée]\s+["«]([^"»]+)["»]/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      const surnom = match[1]?.trim();
      if (surnom && !surnoms.includes(surnom)) {
        surnoms.push(surnom);
      }
    }
  }

  return surnoms;
}
