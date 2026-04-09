/**
 * Lecture des CR existants depuis l'API Craft.
 *
 * Récupère les derniers documents du space Craft pour injecter
 * le contexte historique dans le prompt Claude.
 *
 * API Craft Docs : https://developer.craft.do
 * Endpoint : GET /api/v1/spaces/{spaceId}/documents
 */

const CRAFT_API_BASE = 'https://www.craft.do/api/v1';
const TIMEOUT_MS = 10_000;
const MAX_RECENT_CRS = 5;

interface CraftDocument {
  id: string;
  title: string;
  content?: string;
  createdAt?: string;
}

/**
 * Récupère les derniers CR depuis Craft.
 * Retourne un texte formaté pour injection dans le contexte Claude.
 * En cas d'erreur (token manquant, API down), retourne un message vide
 * sans bloquer la génération du CR.
 */
export async function fetchRecentCRs(): Promise<string> {
  const token = process.env.CRAFT_API_TOKEN;
  const spaceId = process.env.CRAFT_SPACE_ID;

  if (!token || token === '__TO_FILL__' || !spaceId || spaceId === '__TO_FILL__') {
    return '(Historique Craft non disponible — CRAFT_API_TOKEN ou CRAFT_SPACE_ID manquant)';
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${CRAFT_API_BASE}/spaces/${spaceId}/documents?limit=${MAX_RECENT_CRS}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[craft-reader] API Craft ${response.status}`);
      return '(Historique Craft non disponible — erreur API)';
    }

    const data = (await response.json()) as { documents?: CraftDocument[] };
    const docs = data.documents ?? [];

    if (docs.length === 0) {
      return '(Aucun CR précédent trouvé dans Craft)';
    }

    const summaries = docs
      .slice(0, MAX_RECENT_CRS)
      .map((doc, i) => {
        const title = doc.title || 'Sans titre';
        const date = doc.createdAt ? ` (${doc.createdAt})` : '';
        const preview = doc.content
          ? `\n  Extrait : ${doc.content.slice(0, 300)}...`
          : '';
        return `${i + 1}. ${title}${date}${preview}`;
      })
      .join('\n');

    return `HISTORIQUE DES ${docs.length} DERNIERS CR :\n${summaries}`;
  } catch (err) {
    console.warn('[craft-reader] erreur lecture Craft :', err instanceof Error ? err.message : err);
    return '(Historique Craft non disponible — erreur réseau)';
  }
}
