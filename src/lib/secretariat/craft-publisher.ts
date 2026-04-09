/**
 * Publication de CR sur Craft — version Next.js.
 *
 * Publie un document markdown sur l'espace Craft configuré via POST /blocks.
 * Timeout 15s, 1 retry sur 5xx, fallback gracieux si Craft non configuré.
 *
 * Source de vérité API Craft :
 *   - secretariat/src/server/services/craft.ts (implémentation Express de référence)
 *   - Endpoint : POST {CRAFT_IC_BASE_URL}/blocks
 *   - Auth : Authorization: Bearer {CRAFT_IC_KEY}
 *   - Body : { "markdown": "...", "position": { "position": "end" } }
 */

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2; // 1 tentative initiale + 1 retry
const RETRY_DELAY_MS = 2_000;

export interface CraftPublishParams {
  /** Markdown complet du CR à publier */
  markdown: string;
  /** Titre du document (ex: "CR Déjeuner — Karim Benmoussa — 9 avril 2026") */
  title: string;
  /** Référence séquentielle (ex: "IC-CR-2026-0003") */
  reference: string;
}

export interface CraftPublishResult {
  success: boolean;
  craftUrl?: string;
  craftDocId?: string;
  error?: string;
}

/**
 * Publie un CR sur l'espace Craft via l'API blocks.
 *
 * Comportement :
 * - Si CRAFT_API_TOKEN ou CRAFT_SPACE_ID manquant → retourne success: false
 *   avec message explicite (ne bloque pas le flow)
 * - Retry 1x sur erreur 5xx ou réseau
 * - Timeout 15s par tentative
 */
export async function publishToCraft(
  params: CraftPublishParams,
): Promise<CraftPublishResult> {
  const token = process.env.CRAFT_API_TOKEN;
  const spaceId = process.env.CRAFT_SPACE_ID;

  // Vérification config — ne pas bloquer si Craft n'est pas configuré
  if (!token || token === '__TO_FILL__') {
    return {
      success: false,
      error: 'Publication Craft désactivée — CRAFT_API_TOKEN non configuré',
    };
  }
  if (!spaceId || spaceId === '__TO_FILL__') {
    return {
      success: false,
      error: 'Publication Craft désactivée — CRAFT_SPACE_ID non configuré',
    };
  }

  // Préparer le markdown avec le titre en en-tête pour Craft
  const fullMarkdown = `# ${params.title}\n\n**Réf.** ${params.reference}\n\n${params.markdown}`;

  const url = `https://www.craft.do/api/v1/spaces/${spaceId}/documents`;
  const bodyJson = JSON.stringify({
    markdown: fullMarkdown,
    position: { position: 'end' },
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: bodyJson,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        // Tenter de parser la réponse pour extraire l'ID et l'URL
        try {
          const data = (await response.json()) as Record<string, unknown>;
          const craftDocId =
            (data.id as string) ??
            (data.blockId as string) ??
            (data.documentId as string) ??
            undefined;
          const craftUrl =
            (data.url as string) ??
            (data.permalink as string) ??
            (data.webUrl as string) ??
            undefined;

          return {
            success: true,
            craftDocId: craftDocId ?? undefined,
            craftUrl: craftUrl ?? undefined,
          };
        } catch {
          // Réponse non-JSON mais status OK — on considère le succès
          return { success: true };
        }
      }

      // 5xx → retry si première tentative
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      // Erreur définitive (4xx ou retries épuisés)
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Craft API ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));

      if (isAbort) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        return {
          success: false,
          error: `Timeout publication Craft (${TIMEOUT_MS / 1000}s dépassées)`,
        };
      }

      // Erreur réseau → retry si première tentative
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      return {
        success: false,
        error: `Erreur réseau Craft : ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { success: false, error: 'Échec publication Craft après 2 tentatives' };
}
