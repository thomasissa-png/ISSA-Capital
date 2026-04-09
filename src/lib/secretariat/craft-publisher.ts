/**
 * Publication de CR sur Craft — version Next.js.
 *
 * Utilise l'API Craft Link (même endpoint que le serveur Express).
 *
 * Source de vérité API Craft :
 *   - secretariat/src/server/services/craft.ts (implémentation Express de référence)
 *   - Endpoint : POST {CRAFT_BASE_URL}/blocks
 *   - Auth : Authorization: Bearer {CRAFT_API_TOKEN}  (clé pdk_...)
 *   - Body : { "markdown": "...", "position": { "position": "end" } }
 *
 * Env vars :
 *   CRAFT_BASE_URL — ex: https://connect.craft.do/links/EgdwyOCC09S/api/v1
 *   CRAFT_API_TOKEN — clé pdk_...
 */

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

export interface CraftPublishParams {
  markdown: string;
  title: string;
  reference: string;
}

export interface CraftPublishResult {
  success: boolean;
  craftUrl?: string;
  craftDocId?: string;
  error?: string;
}

/**
 * Publie un CR sur Craft via l'API Link /blocks.
 */
export async function publishToCraft(
  params: CraftPublishParams,
): Promise<CraftPublishResult> {
  const token = process.env.CRAFT_API_TOKEN;
  const baseUrl = process.env.CRAFT_BASE_URL;

  if (!token || token === '__TO_FILL__') {
    return {
      success: false,
      error: 'Publication Craft désactivée — CRAFT_API_TOKEN non configuré',
    };
  }
  if (!baseUrl || baseUrl === '__TO_FILL__') {
    return {
      success: false,
      error: 'Publication Craft désactivée — CRAFT_BASE_URL non configuré',
    };
  }

  const fullMarkdown = `# ${params.title}\n\n**Réf.** ${params.reference}\n\n${params.markdown}`;

  const url = `${baseUrl.replace(/\/$/, '')}/blocks`;
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
