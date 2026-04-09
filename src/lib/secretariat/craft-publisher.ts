/**
 * Publication de CR sur Craft — version Next.js.
 *
 * Utilise l'API Craft Link (même endpoint que le serveur Express).
 *
 * Stratégie de publication : 1 sous-page par CR.
 *  1. Tenter de créer un bloc de type "page" (sous-page Craft) via POST /blocks
 *     avec blocks: [{ type: "page", title: "..." }] — certaines API Craft le supportent.
 *  2. Si l'API ne supporte pas le type "page" (4xx), fallback : ajouter le CR comme
 *     bloc texte avec un séparateur visuel fort (═══ + titre + ═══) pour distinguer
 *     chaque CR dans la page unique.
 *
 * Source de vérité API Craft :
 *   - secretariat/src/server/services/craft.ts (implémentation Express de référence)
 *   - Endpoint : POST {CRAFT_BASE_URL}/blocks
 *   - Auth : Authorization: Bearer {CRAFT_API_TOKEN}  (clé pdk_...)
 *
 * Env vars :
 *   CRAFT_BASE_URL — ex: https://connect.craft.do/links/EgdwyOCC09S/api/v1
 *   CRAFT_API_TOKEN — clé pdk_...
 *   CRAFT_PAGE_ID — ID de la page parente (optionnel)
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
 * Tente de publier un CR comme sous-page Craft.
 * Si l'API ne supporte pas la création de sous-page, retourne null pour signaler
 * le fallback sur l'ajout en bloc texte.
 */
async function tryPublishAsSubpage(
  baseUrl: string,
  token: string,
  pageId: string | undefined,
  params: CraftPublishParams,
): Promise<CraftPublishResult | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/blocks`;

  // Tenter la création d'un bloc de type "page" (sous-page)
  // Le contenu sera le markdown du CR précédé du titre.
  const payload: Record<string, unknown> = {
    blocks: [
      {
        type: 'page',
        title: params.title,
        markdown: params.markdown,
      },
    ],
    position: {
      position: 'end',
      ...(pageId ? { pageId } : {}),
    },
  };

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
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
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
        return { success: true };
      }
    }

    // 4xx = l'API ne supporte pas le type "page" → retourner null pour fallback
    if (response.status >= 400 && response.status < 500) {
      return null;
    }

    // 5xx = erreur serveur, pas un problème de compatibilité
    const errorBody = await response.text().catch(() => '');
    return {
      success: false,
      error: `Craft subpage API ${response.status}: ${errorBody.slice(0, 200)}`,
    };
  } catch (err) {
    clearTimeout(timer);

    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('aborted'));

    if (isAbort) {
      // Timeout sur la tentative sous-page — fallback
      return null;
    }

    // Erreur réseau → fallback
    return null;
  }
}

/**
 * Publie un CR sur Craft, en privilégiant la création d'une sous-page séparée.
 *
 * Flow :
 *  1. Tenter la publication comme sous-page (1 page par CR)
 *  2. Si échec (API non supportée) → fallback : bloc texte avec séparateur fort
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

  const pageId = process.env.CRAFT_PAGE_ID;
  const effectivePageId = pageId && pageId !== '__TO_FILL__' ? pageId : undefined;

  // Tentative 1 : sous-page dédiée
  const subpageResult = await tryPublishAsSubpage(
    baseUrl,
    token,
    effectivePageId,
    params,
  );

  // Si la sous-page a réussi ou a échoué définitivement (5xx), retourner le résultat
  if (subpageResult !== null) {
    return subpageResult;
  }

  // Tentative 2 (fallback) : bloc texte avec séparateur visuel fort
  // Le séparateur crée une rupture visuelle claire entre les CR successifs
  const separator = '\n\n---\n\n';
  const fullMarkdown =
    `${separator}# ${params.title}\n\n` +
    `**Réf.** ${params.reference}\n\n` +
    `${params.markdown}`;

  const url = `${baseUrl.replace(/\/$/, '')}/blocks`;

  const payload: Record<string, unknown> = {
    blocks: [{ type: 'text', markdown: fullMarkdown }],
    position: {
      position: 'end',
      ...(effectivePageId ? { pageId: effectivePageId } : {}),
    },
  };

  const bodyJson = JSON.stringify(payload);

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
          return { success: true };
        }
      }

      // 5xx → retry si première tentative
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

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
