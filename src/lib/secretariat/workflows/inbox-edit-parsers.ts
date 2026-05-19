/**
 * Parsers texte conversationnels pour l'édition d'une carte preview inbox-router
 * (S20.A).
 *
 * Chaque parser prend la saisie brute de Thomas (Telegram) et retourne :
 *  - { ok: true, value: string } si interprétation réussie (format canonique)
 *  - { ok: false, error: string } sinon (message court à renvoyer dans la carte)
 *
 * Formats canoniques produits :
 *   - titre : string brute, max 200 chars, trim
 *   - date  : "YYYY-MM-DD"
 *   - heure : "HH:MM" (24h)
 *   - lieu  : string brute, max 200 chars, trim
 *
 * Aucun appel LLM : parsing déterministe pour rester rapide et économe.
 * Les variants français usuels (demain, lundi prochain, 22 mai, 14h30…) sont
 * couverts. Les cas exotiques (3 semaines, "le 15 du mois prochain") sont OUT
 * SCOPE V1 — retour `ok: false` avec hint sur les formats acceptés.
 */

// ============================================================
// Types
// ============================================================

export type ParseResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ============================================================
// Titre
// ============================================================

export function parseTitre(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Titre vide.' };
  }
  const capped = trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
  return { ok: true, value: capped };
}

// ============================================================
// Lieu
// ============================================================

export function parseLieu(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Lieu vide.' };
  }
  const capped = trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
  return { ok: true, value: capped };
}

// ============================================================
// Heure — "HH:MM" canonique
// ============================================================

/**
 * Accepte : `14:30`, `14h30`, `14h`, `14H30`, `9:5` → 09:05, `2pm`, `2:30pm`,
 * `14:00`, `9h`.
 */
export function parseHeure(raw: string): ParseResult {
  const txt = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (txt.length === 0) {
    return { ok: false, error: 'Heure vide.' };
  }

  // Forme "Xpm" / "Xam" / "X:YYpm"
  const ampmMatch = txt.match(/^(\d{1,2})(?::(\d{1,2}))?(am|pm)$/);
  if (ampmMatch) {
    const h0 = parseInt(ampmMatch[1]!, 10);
    const m0 = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const suffix = ampmMatch[3];
    if (h0 < 1 || h0 > 12 || m0 < 0 || m0 > 59) {
      return { ok: false, error: 'Heure invalide (am/pm).' };
    }
    let h = h0 % 12;
    if (suffix === 'pm') h += 12;
    return { ok: true, value: `${pad2(h)}:${pad2(m0)}` };
  }

  // Forme "HHhMM" / "HHh"
  const hMatch = txt.match(/^(\d{1,2})h(\d{1,2})?$/);
  if (hMatch) {
    const h = parseInt(hMatch[1]!, 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return { ok: false, error: 'Heure invalide.' };
    }
    return { ok: true, value: `${pad2(h)}:${pad2(m)}` };
  }

  // Forme "HH:MM" / "H:MM"
  const colonMatch = txt.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1]!, 10);
    const m = parseInt(colonMatch[2]!, 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return { ok: false, error: 'Heure invalide.' };
    }
    return { ok: true, value: `${pad2(h)}:${pad2(m)}` };
  }

  // Forme nue : "14" → 14:00
  const nudeMatch = txt.match(/^(\d{1,2})$/);
  if (nudeMatch) {
    const h = parseInt(nudeMatch[1]!, 10);
    if (h < 0 || h > 23) {
      return { ok: false, error: 'Heure invalide.' };
    }
    return { ok: true, value: `${pad2(h)}:00` };
  }

  return {
    ok: false,
    error: 'Format heure non reconnu (ex: 14:30, 14h30, 14h, 2pm).',
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ============================================================
// Date — "YYYY-MM-DD" canonique
// ============================================================

const MONTHS_FR: Record<string, number> = {
  janv: 1, janvier: 1,
  fevr: 2, février: 2, fevrier: 2,
  mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aout: 8, août: 8,
  sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, décembre: 12, decembre: 12,
};

const WEEKDAYS_FR: Record<string, number> = {
  // 0 = dimanche (Date.getDay convention)
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

/**
 * Variants supportés :
 *   - "2026-05-22" (déjà canonique)
 *   - "22/05" → année courante
 *   - "22/05/2026"
 *   - "22 mai" → année courante (ou suivante si la date est passée)
 *   - "22 mai 2027"
 *   - "demain", "après-demain", "aujourd'hui", "hier"
 *   - "lundi", "lundi prochain", "vendredi"
 *
 * @param now Optionnel — date de référence pour résoudre relatifs (tests).
 */
export function parseDate(raw: string, now: Date = new Date()): ParseResult {
  const txt = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (txt.length === 0) {
    return { ok: false, error: 'Date vide.' };
  }

  // ── ISO YYYY-MM-DD ────────────────────────────────────────
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1]!, 10);
    const m = parseInt(iso[2]!, 10);
    const d = parseInt(iso[3]!, 10);
    if (isValidYmd(y, m, d)) return { ok: true, value: formatYmd(y, m, d) };
    return { ok: false, error: 'Date invalide (ISO).' };
  }

  // ── JJ/MM ou JJ/MM/AAAA ────────────────────────────────────
  const slash = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (slash) {
    const d = parseInt(slash[1]!, 10);
    const m = parseInt(slash[2]!, 10);
    let y = slash[3] ? parseInt(slash[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    if (isValidYmd(y, m, d)) return { ok: true, value: formatYmd(y, m, d) };
    return { ok: false, error: 'Date invalide (jj/mm).' };
  }

  // ── "JJ mois" ou "JJ mois AAAA" ────────────────────────────
  const moisMatch = txt.match(/^(\d{1,2})\s+([a-zàéèêïô]+)(?:\s+(\d{4}))?$/);
  if (moisMatch) {
    const d = parseInt(moisMatch[1]!, 10);
    const moisKey = moisMatch[2]!;
    const m = MONTHS_FR[moisKey];
    if (m === undefined) {
      return { ok: false, error: 'Mois non reconnu.' };
    }
    let y = moisMatch[3] ? parseInt(moisMatch[3], 10) : now.getFullYear();
    // Si pas d'année et la date est passée, on roll à l'année suivante
    if (!moisMatch[3]) {
      const candidate = new Date(y, m - 1, d);
      if (candidate.getTime() < startOfDay(now).getTime()) y += 1;
    }
    if (isValidYmd(y, m, d)) return { ok: true, value: formatYmd(y, m, d) };
    return { ok: false, error: 'Date invalide (mois).' };
  }

  // ── Relatifs ───────────────────────────────────────────────
  if (txt === "aujourd'hui" || txt === 'aujourdhui' || txt === "aujourd hui") {
    return { ok: true, value: ymdOf(now) };
  }
  if (txt === 'demain') {
    return { ok: true, value: ymdOf(addDays(now, 1)) };
  }
  if (txt === 'apres-demain' || txt === 'après-demain' || txt === 'apres demain' || txt === 'après demain') {
    return { ok: true, value: ymdOf(addDays(now, 2)) };
  }
  if (txt === 'hier') {
    return { ok: true, value: ymdOf(addDays(now, -1)) };
  }

  // ── Jour de la semaine (optionnellement "prochain") ────────
  const weekdayMatch = txt.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+prochain)?$/);
  if (weekdayMatch) {
    const target = WEEKDAYS_FR[weekdayMatch[1]!]!;
    const isProchain = txt.includes('prochain');
    const todayDow = now.getDay();
    let delta = (target - todayDow + 7) % 7;
    if (delta === 0) delta = 7; // "lundi" un lundi → lundi suivant
    if (isProchain && delta <= 7 && delta < 7) {
      // "lundi prochain" : on saute à la semaine suivante si delta <= 7
      // sémantique conservatrice : on ajoute 7 jours si on est < 7 jours
      // mais on garde delta=7 si on est déjà sur le jour-cible.
      // Cas usuel : "lundi prochain" un mardi → +6 ; on prend +6+7 = +13 ?
      // Décision : on garde delta tel quel, on retire pas car ambigu en FR.
      // (V1 — variants exotiques OUT SCOPE)
    }
    return { ok: true, value: ymdOf(addDays(now, delta)) };
  }

  return {
    ok: false,
    error: 'Format date non reconnu (ex: 22/05, 22 mai, demain, lundi).',
  };
}

// ============================================================
// Helpers date
// ============================================================

function pad2d(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2d(m)}-${pad2d(d)}`;
}

function ymdOf(date: Date): string {
  return formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
