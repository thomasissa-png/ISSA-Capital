/**
 * Parsing du nom d'un contact via LLM (S24, enrichissement fiche).
 *
 * Pourquoi un LLM et PAS une regex : les noms arrivent dans des formats
 * hétérogènes (header From, signatures, formats Outlook « NOM, Prénom »,
 * MAJUSCULES, codes internes type « OMS »/« ADV » accolés au nom). Une regex
 * produit des faux noms — bug réel S24 : « Marc Gernot » devenu « Marc Oms »
 * (le code « OMS » pris pour le nom de famille).
 *
 * Red lines (dans le prompt) :
 *  - Format Outlook « NOM, Prénom » → réordonner en « Prénom Nom ».
 *  - Codes en MAJUSCULES qui ne sont PAS un patronyme (OMS, ADV, DSI, service…)
 *    → mis dans `notes`, JAMAIS dans le nom.
 *  - ZÉRO INVENTION : ne jamais fabriquer un prénom/nom absent. Incertain → notes.
 *
 * Modèle : Haiku 4.5 (extraction simple). Ne throw jamais : échec → null
 * (l'appelant retombe sur le header From / local-part).
 */

import { callAnthropic } from '../llm/client';

export interface ParsedContactName {
  /** Nom d'affichage « Prénom Nom » proprement casé, ou null si indéterminé. */
  displayName: string | null;
  firstName?: string;
  lastName?: string;
  /** Codes/mentions repérés mais NON intégrés au nom (ex: « OMS », service). */
  notes?: string;
}

const SYSTEM_PROMPT = `Tu normalises le nom d'une personne à partir de chaînes brutes (champ "From" d'un email, signature). Tu retournes UNIQUEMENT un JSON strict, sans markdown :
{
  "displayName": "Prénom Nom" | null,
  "firstName": "string" | null,
  "lastName": "string" | null,
  "notes": "string" | null
}

RÈGLES STRICTES :
- Format Outlook "NOM, Prénom" (virgule) → réordonne en "Prénom Nom". Ex: "GERNOT, Marc" → "Marc Gernot".
- Mets une casse propre (capitale initiale, reste minuscule). Ex: "MARC GERNOT" → "Marc Gernot".
- Les CODES en majuscules qui ne sont PAS un patronyme (ex: "OMS", "ADV", "DSI", "RH", un service, un numéro) NE font PAS partie du nom → mets-les dans "notes", jamais dans firstName/lastName/displayName. Ex: "Marc OMS" où OMS est un code service → displayName "Marc", notes "code: OMS".
- ZÉRO INVENTION : n'ajoute jamais un prénom ou un nom qui n'apparaît pas dans l'entrée. Si tu n'as qu'un prénom, displayName = le prénom seul, lastName = null.
- Si l'entrée ne contient aucun nom de personne exploitable (adresse email seule, "noreply", "contact", "info") → displayName = null.
- Retire les titres ("M.", "Mme", "Dr", "Me") du nom (éventuellement dans notes).
- Pas de markdown, pas d'explication, JSON seul.`;

const FEW_SHOTS: Array<{ role: 'user' | 'assistant'; content: string }> = [
  {
    role: 'user',
    content: 'From name: "GERNOT, Marc"\nEmail: marc.gernot@exemple.com\nSignature (extrait): ""',
  },
  {
    role: 'assistant',
    content: '{"displayName":"Marc Gernot","firstName":"Marc","lastName":"Gernot","notes":null}',
  },
  {
    role: 'user',
    content: 'From name: "Marc OMS"\nEmail: marc@exemple.com\nSignature (extrait): "Marc, Service OMS"',
  },
  {
    role: 'assistant',
    content: '{"displayName":"Marc","firstName":"Marc","lastName":null,"notes":"code/service: OMS"}',
  },
  {
    role: 'user',
    content: 'From name: ""\nEmail: contact@exemple.com\nSignature (extrait): ""',
  },
  {
    role: 'assistant',
    content: '{"displayName":null,"firstName":null,"lastName":null,"notes":null}',
  },
];

const TIMEOUT_MS = 20_000;

/**
 * Parse le nom d'un contact. Ne throw jamais.
 *
 * @param rawFromName Nom tel qu'affiché dans le header From (peut être vide/null).
 * @param email Adresse de l'expéditeur (contexte).
 * @param signatureExcerpt Extrait de signature (optionnel, aide à désambiguïser).
 */
export async function parseContactName(
  rawFromName: string | null,
  email: string,
  signatureExcerpt = '',
): Promise<ParsedContactName | null> {
  const userPrompt =
    `From name: ${JSON.stringify(rawFromName ?? '')}\n` +
    `Email: ${email}\n` +
    `Signature (extrait): ${JSON.stringify(signatureExcerpt.slice(0, 400))}`;

  try {
    const response = await callAnthropic({
      family: 'haiku',
      maxTokens: 256,
      system: SYSTEM_PROMPT,
      messages: [...FEW_SHOTS, { role: 'user', content: userPrompt }],
      responseFormat: 'json',
      timeoutMs: TIMEOUT_MS,
    });
    return parseNameJson(response.text ?? '');
  } catch (err) {
    console.warn(
      `[name-parser] échec parsing « ${rawFromName ?? ''} » : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/** Parse le JSON LLM (tolère un bloc markdown). Retourne null si inexploitable. */
export function parseNameJson(raw: string): ParsedContactName | null {
  if (!raw) return null;
  const block = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = block?.[1]?.trim() ?? raw.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? null;
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    return t.length > 0 ? t : undefined;
  };

  const result: ParsedContactName = {
    displayName: str(obj['displayName']) ?? null,
  };
  const firstName = str(obj['firstName']);
  if (firstName) result.firstName = firstName;
  const lastName = str(obj['lastName']);
  if (lastName) result.lastName = lastName;
  const notes = str(obj['notes']);
  if (notes) result.notes = notes;

  return result;
}
