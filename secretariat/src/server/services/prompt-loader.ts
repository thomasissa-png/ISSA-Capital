/**
 * Chargement et cache du system prompt fiscal (Phase 3).
 *
 * Le system prompt est stocké dans `docs/ia/secretariat-system-prompt.md` à la
 * racine du repo (hors de `secretariat/`). Il contient ~621 lignes incluant le
 * bloc de code encadré qui contient le prompt effectif à envoyer à Claude.
 *
 * Stratégie :
 *  - Lecture unique au premier appel (singleton), cache en mémoire ensuite.
 *  - Extraction du premier bloc ```…``` présent sous le titre "## 2. System prompt
 *    complet" : c'est la portion exacte à envoyer à l'API Anthropic.
 *  - Si le fichier ou le bloc sont absents, throw explicite — le serveur crash au
 *    démarrage plutôt que de générer des CR sans prompt fiscal (risque DGFiP).
 *
 * Thread-safety : Node est mono-thread par défaut, le cache singleton est sûr.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Chemin absolu vers le fichier source du system prompt.
 * Depuis `secretariat/src/server/services/`, remonter 4 niveaux
 * (services → server → src → secretariat → racine repo) puis descendre.
 */
function resolvePromptPath(): string {
  return path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'docs',
    'ia',
    'secretariat-system-prompt.md',
  );
}

/**
 * Extrait le contenu du premier bloc code (```) situé APRÈS le titre
 * "## 2. System prompt complet". C'est la portion exacte à transmettre à l'API.
 *
 * Pourquoi cette extraction : le fichier .md contient aussi la doc accompagnante
 * (Vue d'ensemble, schémas Zod, test cases) — on ne veut pas envoyer tout ça à
 * Claude. Seul le bloc sous "## 2." est le system prompt effectif.
 */
function extractPromptFromMarkdown(fileContent: string): string {
  const sectionMarker = '## 2. System prompt complet';
  const sectionIdx = fileContent.indexOf(sectionMarker);
  if (sectionIdx === -1) {
    throw new Error(
      `[prompt-loader] section "${sectionMarker}" introuvable dans le fichier source. ` +
        `Le format du fichier docs/ia/secretariat-system-prompt.md a changé. ` +
        `Vérifier que la section 2 existe toujours.`,
    );
  }

  // Chercher le premier ``` après le marqueur de section
  const afterSection = fileContent.slice(sectionIdx);
  const openIdx = afterSection.indexOf('```');
  if (openIdx === -1) {
    throw new Error(
      '[prompt-loader] aucun bloc code (```) trouvé après "## 2. System prompt complet". ' +
        'Vérifier le format du fichier source.',
    );
  }

  // Sauter la ligne d'ouverture (```lang éventuel)
  const afterOpen = afterSection.slice(openIdx + 3);
  const newlineAfterOpen = afterOpen.indexOf('\n');
  if (newlineAfterOpen === -1) {
    throw new Error('[prompt-loader] bloc code malformé (pas de newline après ```)');
  }

  const contentStart = newlineAfterOpen + 1;
  const closeIdx = afterOpen.indexOf('```', contentStart);
  if (closeIdx === -1) {
    throw new Error(
      '[prompt-loader] bloc code non fermé dans docs/ia/secretariat-system-prompt.md. ' +
        'Vérifier qu\'une ligne ``` ferme bien le bloc de la section 2.',
    );
  }

  const promptBody = afterOpen.slice(contentStart, closeIdx).trim();
  if (promptBody.length < 500) {
    throw new Error(
      `[prompt-loader] system prompt extrait trop court (${promptBody.length} chars). ` +
        `Attendu : >= 500 chars. Le fichier source est probablement corrompu.`,
    );
  }

  return promptBody;
}

/**
 * Cache singleton — lit le fichier une seule fois au premier appel.
 */
let cachedPrompt: string | null = null;

/**
 * Charge le system prompt fiscal depuis le fichier source.
 * Idempotent : lectures ultérieures servies depuis le cache mémoire.
 *
 * @throws Error si le fichier est absent, malformé, ou si le bloc code n'est
 *         pas trouvé. C'est volontaire : mieux vaut crasher au démarrage que de
 *         générer des CR sans prompt fiscal (risque juridique majeur).
 */
export function loadSystemPrompt(): string {
  if (cachedPrompt !== null) {
    return cachedPrompt;
  }

  const promptPath = resolvePromptPath();

  if (!fs.existsSync(promptPath)) {
    throw new Error(
      `[prompt-loader] fichier source introuvable : ${promptPath}. ` +
        `Le system prompt fiscal est un livrable critique — vérifier qu'il existe ` +
        `dans docs/ia/ avant de démarrer le service.`,
    );
  }

  const fileContent = fs.readFileSync(promptPath, 'utf8');
  cachedPrompt = extractPromptFromMarkdown(fileContent);
  return cachedPrompt;
}

/**
 * Reset le cache — usage strictement réservé aux tests.
 */
export function resetPromptCacheForTests(): void {
  cachedPrompt = null;
}

/**
 * Expose le chemin résolu (utile pour diagnostics et tests).
 */
export function getSystemPromptPath(): string {
  return resolvePromptPath();
}
