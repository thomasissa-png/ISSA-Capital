/**
 * Feed iCal (RFC 5545) — Réunions du vault Obsidian.
 *
 * Module FRÈRE de `ticktick/ical-export.ts` (qui exporte les tâches TickTick).
 * Ici on lit les fiches `Reunions/*.md` du vault Drive (source de vérité)
 * et on génère un calendrier iCal abonnable depuis TickTick / Google / Apple Calendar.
 *
 * Red line spec §9.3 : **READ-ONLY**. Aucune écriture vault depuis ce module.
 * Red line spec §9.6 : tag `#hide-tcw` → skip.
 * Red line spec §9.9 : UTF-8 réel préservé bit-parfait.
 *
 * Source : `06. Réunions/YYYY/MM/*.md` via vault-paths.reunionsPath().
 * Spec : `second-cerveau/Anya - Prompt Claude Code TickTick sync.md` §1 lignes 65-84.
 *
 * Jalon S18.3a — Session 18.
 */

import { listVaultFolder, readVaultFile } from '../vault-reader';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { reunionsPath } from '../handlers/vault-paths';

// ============================================================
// Constantes
// ============================================================

const CRLF = '\r\n';
const PRODID = '-//Anya//Thomas Issa//FR';
const CALENDAR_NAME = 'Anya — Réunions';

/**
 * Nombre d'années à scanner en arrière depuis l'année courante.
 * 1 = année courante + 1 année précédente (par défaut).
 * Couvre l'historique récent + le futur (les fiches futures sont rangées par leur date).
 */
const YEARS_LOOKBACK = 1;

/**
 * Nombre d'années à scanner en avant.
 * 1 = année courante + 1 année future (pour réunions planifiées en N+1).
 */
const YEARS_LOOKAHEAD = 1;

// ============================================================
// Types
// ============================================================

export interface VaultReunion {
  /** UID iCal stable (hash du chemin) */
  uid: string;
  /** Titre depuis frontmatter `title` ou nom de fichier (sans .md) */
  title: string;
  /** Date YYYY-MM-DD (frontmatter `date`) */
  date: string;
  /** Heure de début optionnelle HH:MM (frontmatter `heure` ou `startTime`) */
  startTime?: string;
  /** Durée en minutes (frontmatter `duree` ou `duration`) */
  duration?: number;
  /** Liste des participants (frontmatter `participants:` en liste YAML) */
  participants: string[];
  /** Lieu optionnel (frontmatter `lieu`) */
  lieu?: string;
  /** Catégorie optionnelle (frontmatter `categorie` — reunion, visite, etc.) */
  categorie?: string;
  /** Chemin logique vault (relatif à 00. Me/), ex: "06. Réunions/2026/05/2026-05-12 - X.md" */
  vaultPath: string;
  /** Description courte (premières lignes du body markdown, sans frontmatter) */
  description?: string;
}

// ============================================================
// Helpers — hashing UID stable
// ============================================================

/**
 * Hash simple non-cryptographique (djb2 modifié) d'une chaîne UTF-8.
 * Suffisant pour un UID iCal stable (collision improbable < 1000 fiches).
 * On évite crypto (sync) pour rester dans le pipeline ESM stable.
 */
function hashPath(path: string): string {
  let h = 5381;
  for (let i = 0; i < path.length; i++) {
    h = ((h << 5) + h + path.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ============================================================
// Helpers — échappement RFC 5545
// ============================================================

/**
 * Échappe les caractères spéciaux iCal (RFC 5545 §3.3.11).
 * Ordre critique : `\` en premier sinon double-échappement.
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Formate une date YYYY-MM-DD en YYYYMMDD (iCal date sans heure).
 */
function formatICalDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * Formate une date+heure (UTC) en YYYYMMDDTHHMMSSZ.
 */
function formatICalDateTime(isoDate: string, hhmm: string): string {
  // Heure locale Paris : on ne fait PAS de conversion TZ ici. Le feed
  // diffuse l'heure brute en floating time (sans Z) pour rester portable.
  // Si conversion TZ requise plus tard : utiliser une vraie lib (Temporal).
  const [hh, mm] = hhmm.split(':');
  const date = isoDate.replace(/-/g, '');
  return `${date}T${hh}${mm}00`;
}

/**
 * Ajoute n jours à une date YYYY-MM-DD (calcul calendrier safe).
 */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Now en UTC format iCal YYYYMMDDTHHMMSSZ.
 */
function nowICal(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * URL-encode un chemin pour deep-link Obsidian (encode espaces + accents).
 */
function obsidianEncode(path: string): string {
  return encodeURIComponent(path).replace(/%2F/g, '/');
}

// ============================================================
// API publique — parser une fiche réunion
// ============================================================

/**
 * Parse une fiche réunion (frontmatter + body) en VaultReunion.
 *
 * Retourne null si :
 *   - pas de frontmatter
 *   - frontmatter `date` absent ou format invalide
 *   - tag `#hide-tcw` présent (red line §9.6)
 *
 * @param filename Nom du fichier .md (ex: "2026-05-12 - Thomas Maxime - Point Versi.md")
 * @param content Contenu complet du fichier
 * @param vaultPath Chemin logique vault complet (pour UID + deep-link)
 */
export function parseReunionFile(
  filename: string,
  content: string,
  vaultPath: string,
): VaultReunion | null {
  const parsed = parseObsidianFile(content);
  if (!parsed.frontmatter) return null;

  const fm = parsed.frontmatter.fields;
  const lists = parsed.frontmatter.lists;

  // Date obligatoire YYYY-MM-DD
  const rawDate = fm['date'];
  if (typeof rawDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return null;
  }

  // Skip si tag #hide-tcw (dans liste tags)
  const tags = lists['tags'] ?? [];
  if (tags.some((t) => t.replace(/^#/, '').trim() === 'hide-tcw')) {
    return null;
  }

  // Titre : frontmatter `title` > nom de fichier sans .md
  let title: string;
  const fmTitle = fm['title'];
  if (typeof fmTitle === 'string' && fmTitle.trim()) {
    title = fmTitle.trim();
  } else {
    title = filename.replace(/\.md$/i, '').trim();
  }

  // Heure optionnelle (HH:MM)
  let startTime: string | undefined;
  const rawHeure = fm['heure'] ?? fm['startTime'];
  if (typeof rawHeure === 'string' && /^\d{1,2}:\d{2}$/.test(rawHeure)) {
    const [h, m] = rawHeure.split(':');
    startTime = `${h!.padStart(2, '0')}:${m}`;
  }

  // Durée optionnelle (minutes)
  let duration: number | undefined;
  const rawDuree = fm['duree'] ?? fm['duration'];
  if (typeof rawDuree === 'number' && rawDuree > 0) {
    duration = rawDuree;
  }

  // Participants : liste YAML
  const participants: string[] = lists['participants'] ?? [];

  // Lieu
  let lieu: string | undefined;
  const rawLieu = fm['lieu'];
  if (typeof rawLieu === 'string' && rawLieu.trim()) {
    lieu = rawLieu.trim();
  }

  // Catégorie
  let categorie: string | undefined;
  const rawCat = fm['categorie'] ?? fm['category'];
  if (typeof rawCat === 'string' && rawCat.trim()) {
    categorie = rawCat.trim();
  }

  // Description : premières lignes non vides du body (max 200 chars)
  const description = extractDescription(parsed.body);

  const uid = hashPath(vaultPath);

  return {
    uid,
    title,
    date: rawDate,
    startTime,
    duration,
    participants,
    lieu,
    categorie,
    vaultPath,
    description,
  };
}

/**
 * Extrait une description courte du body markdown (premières lignes non vides).
 */
function extractDescription(body: string): string | undefined {
  if (!body) return undefined;
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    // Skip headings markdown et lignes vides
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('---'))
    .slice(0, 3);
  if (lines.length === 0) return undefined;
  const desc = lines.join(' ').slice(0, 200);
  return desc || undefined;
}

// ============================================================
// API publique — liste les réunions du vault
// ============================================================

/**
 * Liste toutes les réunions vault sur la fenêtre `[year-LOOKBACK ; year+LOOKAHEAD]`.
 *
 * Scan : pour chaque (année, mois 1-12), liste le dossier `06. Réunions/YYYY/MM`
 * via `listVaultFolder` (cache TTL 1h). Pour chaque fichier .md trouvé,
 * lecture du contenu via `readVaultFile` (cache TTL 1h) + parse en VaultReunion.
 *
 * Tri : par date décroissante (plus récent en premier dans le feed).
 *
 * Tolérant aux erreurs : si un dossier est vide ou indisponible, on continue.
 *
 * @param now Date de référence pour calculer la fenêtre (défaut : maintenant)
 */
export async function listVaultReunions(now: Date = new Date()): Promise<VaultReunion[]> {
  const currentYear = now.getUTCFullYear();
  const years: number[] = [];
  for (let dy = -YEARS_LOOKBACK; dy <= YEARS_LOOKAHEAD; dy++) {
    years.push(currentYear + dy);
  }

  const reunions: VaultReunion[] = [];

  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      const folderPath = reunionsPath(year, month);
      let entries;
      try {
        entries = await listVaultFolder(folderPath);
      } catch {
        continue;
      }
      if (!entries || entries.length === 0) continue;

      for (const entry of entries) {
        if (!entry.name.toLowerCase().endsWith('.md')) continue;
        const filename = entry.name;
        const vaultPath = `${folderPath}/${filename}`;
        let fileRes;
        try {
          fileRes = await readVaultFile(folderPath, filename);
        } catch {
          continue;
        }
        if (!fileRes.success || !fileRes.content) continue;
        const reunion = parseReunionFile(filename, fileRes.content, vaultPath);
        if (reunion) reunions.push(reunion);
      }
    }
  }

  // Tri date décroissante
  reunions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return reunions;
}

// ============================================================
// API publique — génération iCal
// ============================================================

/**
 * Génère le contenu iCal RFC 5545 à partir d'une liste de réunions vault.
 *
 * Comportement :
 *   - Si pas de `startTime` → VEVENT all-day (DTSTART;VALUE=DATE + DTEND J+1)
 *   - Si `startTime` présent → VEVENT timed (DTSTART floating + DTEND DTSTART+duration)
 *     (duration par défaut : 60 min si absent)
 *   - DESCRIPTION inclut le deep-link Obsidian + résumé body
 *   - ORGANIZER Thomas Issa fixe
 *   - PRODID `-//Anya//Thomas Issa//FR` (cf spec §1)
 */
export function generateICalFromReunions(reunions: VaultReunion[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    `X-WR-CALNAME:${CALENDAR_NAME}`,
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
  ];

  const dtstamp = nowICal();

  for (const r of reunions) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${r.uid}@anya.thomas-issa`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (r.startTime) {
      const dtStart = formatICalDateTime(r.date, r.startTime);
      const durationMin = r.duration && r.duration > 0 ? r.duration : 60;
      const endDate = addMinutes(r.date, r.startTime, durationMin);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${endDate}`);
    } else {
      const dtStart = formatICalDate(r.date);
      const dtEnd = formatICalDate(addDays(r.date, 1));
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    }

    lines.push(`SUMMARY:${escapeICalText(r.title)}`);

    const descParts: string[] = [];
    descParts.push(`Lien vault: obsidian://open?vault=00.%20Me&file=${obsidianEncode(r.vaultPath)}`);
    if (r.description) descParts.push(r.description);
    if (r.participants.length > 0) {
      descParts.push(`Participants: ${r.participants.join(', ')}`);
    }
    lines.push(`DESCRIPTION:${escapeICalText(descParts.join('\n'))}`);

    if (r.categorie) {
      lines.push(`CATEGORIES:${escapeICalText(r.categorie)}`);
    }
    if (r.lieu) {
      lines.push(`LOCATION:${escapeICalText(r.lieu)}`);
    }
    lines.push('ORGANIZER;CN=Thomas Issa:mailto:contact@issa-capital.com');

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}

/**
 * Ajoute `minutes` à une date YYYY-MM-DD + HH:MM, retourne format iCal floating
 * YYYYMMDDTHHMMSS (sans Z — floating time, cohérent avec DTSTART non-UTC).
 */
function addMinutes(isoDate: string, hhmm: string, minutes: number): string {
  const [hh, mm] = hhmm.split(':');
  const d = new Date(`${isoDate}T${hh!.padStart(2, '0')}:${mm}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}${mo}${da}T${h}${mi}00`;
}

// ============================================================
// Internals exportés pour tests uniquement
// ============================================================

export const _internals = {
  hashPath,
  formatICalDate,
  formatICalDateTime,
  addDays,
  addMinutes,
  extractDescription,
  obsidianEncode,
  YEARS_LOOKBACK,
  YEARS_LOOKAHEAD,
};
