/**
 * Stats de relation dérivées de l'historique d'une fiche contact (S24).
 *
 * Thomas veut que les fiches reflètent, à partir des échanges réels (email,
 * WhatsApp, réunions…), deux attributs :
 *   - `canal_préféré`     : le canal le plus utilisé récemment
 *   - `fréquence_échanges`: à quel rythme Thomas échange avec ce contact
 *
 * Source unique : la section `## Historique`, dont chaque entrée a un titre
 * `### YYYY-MM-DD — <Canal> : <détail>` (posé par les ingests email / WhatsApp /
 * calendar). On parse date + canal, sans LLM, de façon déterministe.
 *
 * Fonction PURE et testable : aucune I/O. Recalculée à chaque append (le canal
 * reflète donc TOUS les canaux, même si le déclencheur est un seul ingest).
 */

const HISTORIQUE_HEADING_RE = /^###\s+(.+?)\s*$/;
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})\s*[—\-–:]/;

const WINDOW_CANAL_DAYS = 90;
const WINDOW_FREQ_DAYS = 30;

export interface RelationStats {
  /** Canal dominant sur la fenêtre récente, ou null si indéterminable. */
  canalPrefere: string | null;
  /** Rythme d'échange (« soutenu » / « régulier » / « occasionnel » / « espacé »), ou null. */
  frequence: string | null;
}

interface HistEntry {
  date: string; // YYYY-MM-DD
  canal: string; // libellé normalisé
}

/** Détecte le canal à partir du titre de l'entrée d'historique. */
function detectCanal(heading: string): string | null {
  const h = heading.toLowerCase();
  if (h.includes('whatsapp')) return 'WhatsApp';
  if (/(^|\W)(sms|appel|téléph|telephon|tél\b|tel\b)/.test(h)) return 'Téléphone';
  if (h.includes('réunion') || h.includes('reunion') || h.includes('rdv') || h.includes('rendez')) return 'Réunion';
  if (h.includes('email') || h.includes('e-mail') || h.includes('mail') || h.includes('courriel')) return 'Email';
  return null;
}

/** Extrait la section ## Historique (lignes brutes). */
function extractHistoriqueLines(content: string): string[] {
  const lines = content.split('\n');
  const out: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (/^##\s+Historique\s*$/i.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing && /^##\s/.test(line)) break; // section suivante
    if (capturing) out.push(line);
  }
  return out;
}

function daysBetween(from: string, now: Date): number {
  const d = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

/**
 * Calcule canal préféré + fréquence à partir du contenu complet d'une fiche.
 *
 * @param content Contenu Markdown complet (frontmatter + body).
 * @param now Date de référence (injectable pour les tests).
 */
export function computeRelationStats(content: string, now: Date = new Date()): RelationStats {
  const entries: HistEntry[] = [];
  for (const line of extractHistoriqueLines(content)) {
    const m = HISTORIQUE_HEADING_RE.exec(line);
    if (!m) continue;
    const heading = m[1]!;
    const dm = DATE_PREFIX_RE.exec(heading);
    if (!dm) continue;
    const canal = detectCanal(heading);
    if (!canal) continue;
    entries.push({ date: dm[1]!, canal });
  }

  if (entries.length === 0) {
    return { canalPrefere: null, frequence: null };
  }

  // --- Canal préféré : canal le plus fréquent sur 90 j (fallback all-time). ---
  const recent = entries.filter((e) => daysBetween(e.date, now) <= WINDOW_CANAL_DAYS);
  const pool = recent.length > 0 ? recent : entries;
  const counts = new Map<string, number>();
  for (const e of pool) counts.set(e.canal, (counts.get(e.canal) ?? 0) + 1);
  let canalPrefere: string | null = null;
  let best = -1;
  for (const [canal, n] of counts) {
    if (n > best) {
      best = n;
      canalPrefere = canal;
    }
  }

  // --- Fréquence : jours d'interaction distincts sur 30 j. ---
  const days30 = new Set(
    entries.filter((e) => daysBetween(e.date, now) <= WINDOW_FREQ_DAYS).map((e) => e.date),
  ).size;
  let frequence: string;
  if (days30 >= 8) frequence = 'soutenu';
  else if (days30 >= 4) frequence = 'régulier';
  else if (days30 >= 1) frequence = 'occasionnel';
  else frequence = 'espacé'; // au moins une entrée existe, mais pas dans les 30 j

  return { canalPrefere, frequence };
}
