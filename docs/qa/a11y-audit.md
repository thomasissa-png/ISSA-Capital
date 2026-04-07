# Accessibility Audit — ISSA Capital

> Audit accessibilité automatisé (axe-core) + revue manuelle WCAG 2.2 AA.
> @qa — 2026-04-07
> Outil : `@axe-core/playwright 4.11` exécuté sur les 7 pages via `tests/e2e/a11y.spec.ts`.

---

## Verdict global : **NO-GO sur G22 — bug bloquant `color-contrast`**

- **1 violation WCAG AA bloquante** : `color-contrast` (sérieux) sur le token `levant-600` (#a87340) utilisé en text-xs (12px) et text-base (16px) sur fond crème (#f5f0e8 / #faf7f2) ou blanc (#ffffff).
- **0 autre violation** sur les 7 pages quand on désactive `color-contrast` — le reste de la sémantique (landmarks, roles, labels, headings, alt) est propre.
- **Recommandation** : @fullstack doit fixer `levant-600` AVANT Phase 2c (testeur-karim/leila). C'est aussi un blocker G28 / pre-deploy.

---

## 1. Violation détectée — `color-contrast` (impact: serious)

### Mesures axe-core (toutes les pages affectées : 7/7)

| Élément                                             | Couleur texte | Couleur fond | Ratio mesuré | Ratio requis | Page d'exemple    |
|-----------------------------------------------------|---------------|--------------|--------------|--------------|-------------------|
| `<p class="overline text-levant-600">` (12px)       | #a87340       | #ffffff      | **4.04**     | 4.5          | toutes (overlines) |
| `<p class="overline text-levant-600">` (12px)       | #a87340       | #f5f0e8      | **3.56**     | 4.5          | sections crème   |
| `<p class="overline text-levant-600">` (12px)       | #a87340       | #faf7f2      | **3.78**     | 4.5          | parchment-50     |
| `<a class="text-levant-600">` (16px ghost link)     | #a87340       | #ffffff      | **4.04**     | 4.5          | toutes (CTAs ghost) |
| `<a class="text-levant-600">` (16px ghost link)     | #a87340       | #f5f0e8      | **3.56**     | 4.5          | toutes           |

**Cible** : ratio ≥ 4.5:1 pour text < 18px (norme WCAG 2.2 AA)
**Cas particulier** : un text ≥ 18px (ou ≥ 14px gras) ne nécessite que 3:1 — donc `levant-500` reste OK pour les **gros titres et accents**, mais PAS pour les overlines (12px) ni les petits liens.

### Pages affectées

Toutes les 7 pages (home, mission, accompagnement, opportunites, participations, contact, mentions-legales) — l'overline est un composant transversal utilisé partout.

### Cause racine

Le pas correctif #2 documenté dans `orchestration-plan.md` indiquait : "WCAG levant/crème corrigé (levant-500 → levant-600 pour texte <18px)". **Mais le calcul n'a pas été refait** : `levant-600` (#a87340) reste sous le seuil 4.5:1 sur fond crème. Il faut passer à `levant-700` ou plus foncé pour satisfaire la norme.

### Fix recommandé

Dans `tailwind.config.ts` (ou équivalent design tokens) :

```js
// Avant
'levant-600': '#a87340',  // ratio 3.56-4.04 sur fond crème — KO WCAG AA

// Après — calculer un ton qui passe ≥ 4.5:1 sur #f5f0e8
'levant-700': '#8a5a2e',  // ratio cible ~5.5:1, à valider
'levant-800': '#6e4622',  // ratio ~7:1, AAA-friendly
```

Puis remplacer dans le code (Grep) `text-levant-600` → `text-levant-700` pour tous les usages text < 18px ou interactifs petits.

**Vérification post-fix** : relancer `npx playwright test tests/e2e/a11y.spec.ts` après avoir retiré `disableRules(['color-contrast'])` de la spec, et vérifier que toutes les pages passent. Le test "REGRESSION sentinel" (`.fixme`) doit alors être converti en `test` actif.

---

## 2. Autres dimensions WCAG 2.2 AA — état des lieux

| Critère                                                  | Statut | Méthode de vérification                                              |
|----------------------------------------------------------|--------|----------------------------------------------------------------------|
| **1.1.1** Images alt text                                | PASS   | axe → 0 violation `image-alt`                                         |
| **1.3.1** Structure sémantique (landmarks, headings)     | PASS   | axe → 0 violation `landmark-*`, `heading-order`                      |
| **1.4.3** Contraste texte normal ≥ 4.5:1                 | **FAIL** | axe `color-contrast` — voir §1                                     |
| **1.4.10** Reflow / responsive 320px                     | PASS   | screenshots iphone-13 (375px) — pas de scroll horizontal             |
| **1.4.11** Contraste éléments non-texte ≥ 3:1            | À vérifier | axe ne couvre pas tout (bordures inputs, focus ring) — revue manuelle ci-dessous |
| **2.1.1** Tout au clavier                                | PASS   | Inputs/buttons natifs HTML, aucun handler JS qui bloque              |
| **2.4.1** Skip link                                       | PASS   | `.skip-link` présent dans `layout.tsx`, test `a11y.spec.ts:55` PASS  |
| **2.4.3** Ordre de focus logique                          | PASS   | DOM order = ordre visuel (Flexbox sans `order:`)                     |
| **2.4.7** Focus visible                                   | PASS   | `focus-visible:ring-2 focus-visible:ring-levant-500` partout dans `ContactForm` et `Button` |
| **2.5.5** Touch targets ≥ 44×44px (mobile)               | À VÉRIFIER | Test `a11y.spec.ts` actif sur project iphone-13 — boutons à 48px (`min-h-[48px]` sur inputs). À confirmer par exécution complète. |
| **3.1.1** Langue de page                                 | PASS   | `<html lang="fr">` dans `layout.tsx`                                  |
| **3.3.2** Labels associés aux inputs                     | PASS   | axe → 0 violation `label`. Tous les `<label htmlFor="...">` cohérents avec `id` |
| **3.3.3** Suggestions d'erreur                           | PASS   | `aria-describedby` + `aria-invalid` + messages texte sur erreur Zod  |
| **4.1.2** ARIA roles, name, value                        | PASS   | axe → 0 violation `aria-*`                                            |
| **4.1.3** Status messages (aria-live)                    | PASS   | `role="status" aria-live="polite"` sur succès, `role="alert" aria-live="assertive"` sur erreur serveur |

---

## 3. Vérifications complémentaires

### `prefers-reduced-motion`

`page-compositions.md` documente des animations fade-up + count-up. Vérification dans le code :

- Recherche `prefers-reduced-motion` dans `src/app/globals.css` et composants → **À CONFIRMER** par @fullstack que les animations Tailwind sont conditionnées (`motion-safe:` / `motion-reduce:`) ou utilisent une media query CSS.
- Risque WCAG **2.3.3** (mineur — niveau AAA, pas AA). Non bloquant pour AA, mais recommandé.

### Touch targets ≥ 44px (mobile)

Le test `a11y.spec.ts:60` vérifie sur project mobile que les CTAs ont `height ≥ 40px`. Les inputs du `ContactForm` ont `min-h-[48px]` explicite — PASS attendu. À confirmer en exécutant `npx playwright test tests/e2e/a11y.spec.ts --project=iphone-13`.

### Contraste éléments non-texte (1.4.11)

- Bordures input : `border-ink-200` (#d4d4d4) sur `bg-white` → ratio 1.6:1 — **insuffisant** pour 1.4.11 (3:1 requis sur composants UI).
- À CORRIGER : passer à `border-ink-400` ou `border-ink-500` pour les bordures d'input (visibilité de la zone interactive).
- **Sévérité** : moyenne — non détecté par axe en mode `wcag2aa` mais identifiable visuellement.

### Focus ring couleur

`focus-visible:ring-levant-500` (#c4935a) sur fond blanc → ratio 3.13:1 — PASS pour 1.4.11 (≥ 3:1).

---

## 4. Exécution des tests

```bash
# Tous les tests a11y sur desktop (rapide)
npx playwright test tests/e2e/a11y.spec.ts --project=desktop-chrome

# Touch targets uniquement (mobile)
npx playwright test tests/e2e/a11y.spec.ts --project=iphone-13

# Suite complète
npx playwright test tests/e2e/a11y.spec.ts
```

**Statut actuel des tests `a11y.spec.ts`** :
- 7 tests `axe — /xxx (hors color-contrast)` → **PASS** (couvre tout sauf le bug levant-600)
- 1 test `skip link` → PASS
- 1 test `touch targets ≥ 44px` (mobile only) → skip sur desktop, à exécuter sur iphone-13
- 1 test `REGRESSION sentinel — color-contrast` → `.fixme` (volontaire, deviendra PASS quand le bug sera corrigé)

---

## 5. Bugs et actions

### Bloquant (avant Phase 2c)

| #  | Bug                                                              | Sévérité | Owner       |
|----|------------------------------------------------------------------|----------|-------------|
| A1 | `color-contrast` levant-600 sur fond crème/blanc (12px et 16px)  | bloquant | @fullstack  |
| A2 | `<footer>` sémantique imbriqué dans `/accompagnement` (verbatim) | mineur   | @fullstack  |

### Non-bloquant (post-launch)

| #  | Bug                                                              | Sévérité | Owner       |
|----|------------------------------------------------------------------|----------|-------------|
| A3 | Bordures input `border-ink-200` ratio < 3:1 (1.4.11)             | moyen    | @design + @fullstack |
| A4 | Vérifier `prefers-reduced-motion` sur les animations fade/count  | mineur   | @fullstack  |

---

## Handoff → @fullstack

**Action #1 (BLOQUANT)** : remplacer `levant-600` par un ton plus foncé (`levant-700` ou similaire avec ratio ≥ 4.5:1 sur fond crème + blanc) dans `tailwind.config.ts`. Puis Grep `text-levant-600` dans `src/` et remplacer par `text-levant-700` pour tous les usages text < 18px et liens. Vérifier qu'aucun gros titre n'est cassé visuellement.

**Action #2 (BLOQUANT)** : sur `/accompagnement`, transformer le `<footer>` interne (verbatim entrepreneur) en `<figcaption>` ou `<p class="text-sm text-ink-500">`. Un seul `<footer>` racine par page.

**Action #3 (post-launch)** : passer `border-ink-200` → `border-ink-400` sur les inputs.

**Action #4 (post-launch)** : ajouter `motion-safe:` aux animations Tailwind ou wrapper dans une media query `@media (prefers-reduced-motion: no-preference)`.

Une fois A1 corrigé, retirer `.disableRules(['color-contrast'])` de `tests/e2e/a11y.spec.ts:38` et convertir le `test.fixme` en `test` actif.
