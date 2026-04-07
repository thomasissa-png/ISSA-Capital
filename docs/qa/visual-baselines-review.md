# Visual Baselines Review — ISSA Capital

> Review humaine des 21 baselines Playwright produites par @fullstack lors de la boucle visuelle.
> @qa — 2026-04-07
> Méthode : lecture visuelle de chaque PNG dans `tests/screenshots/{device}/{page}.png` + comparaison avec la spec correspondante de `docs/design/page-compositions.md`.
> **Gate G26** : c'est le premier passage humain — les baselines validées ici deviennent le pixel-diff de référence pour la CI.

---

## Verdict global G26 : **GO CONDITIONNEL**

- **21/21 baselines visuellement conformes aux compositions** (layout, alternance fond, hiérarchie typographique, ordre des sections, formulaires).
- **Écarts mineurs** : 2 (cosmétiques, non-bloquants — voir tableau).
- **Écarts bloquants** : 0 (aucun écart de structure ou de contenu).
- **Bug a11y détecté en parallèle** : `levant-600` non WCAG AA — ce bug N'EST PAS visible à l'œil sur les screenshots (le ratio est mesurable mais pas perceptible immédiatement). Voir `a11y-audit.md`.

---

## Méthodologie

Pour chaque page, j'ai :
1. Lu la section correspondante de `docs/design/page-compositions.md`
2. Ouvert les 3 screenshots (desktop-chrome 1280px, ipad 768px, iphone-13 375px chromium)
3. Vérifié : ordre des sections, alternance fond clair/sombre, présence du H1 attendu, présence des CTAs/formulaires, pied de page complet, signature (si applicable), responsive (empilement mobile)
4. Statué : OK / écart mineur / écart bloquant

Les baselines ont été générées par le script `tests/visual/screenshots.spec.ts` en `fullPage: true`.

---

## Tableau exhaustif (7 pages × 3 devices = 21 baselines)

### `/` (Accueil)

| Device          | Statut | Vérifications passées                                                                                       |
|-----------------|--------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | OK     | Hero ink-950 plein écran + tagline "On décide. Pas un calendrier de fonds." + 5 sections (chapeau / chiffres clés 50% / 2020 / 4 / 2 cards prendre contact / écosystème / 3 filtres / final CTA) + footer 3 colonnes |
| ipad            | OK     | Hero conservé, sections 2 cols sur "prendre contact" + grille participations adaptée |
| iphone-13       | OK     | Hero centré, CTAs empilés, sections single-column, hiérarchie respectée |

### `/mission`

| Device          | Statut | Vérifications passées                                                                                       |
|-----------------|--------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | OK     | H1 "Famille libanaise. Horizons intergénérationnels.", alternance crème / parchment, sections "Une histoire pas une mission" / "Une holding pas d'éclat" / "Racines libanaises Enracinée en France" / "La vision à trente ans" / "Nos filtres" / "Ce que nous refusons" / signature finale |
| ipad            | OK     | Mêmes sections, padding réduit |
| iphone-13       | OK     | Empilement single-col, lecture fluide |

### `/accompagnement`

| Device          | Statut          | Vérifications passées                                                                                       |
|-----------------|-----------------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | écart mineur    | H1 Thomas + verbatim entrepreneur dans une **balise `<footer>` interne** (mise en page OK visuellement, mais bug sémantique a11y / strict-mode Playwright — voir bug #1 dans `a11y-audit.md`) |
| ipad            | écart mineur    | Idem |
| iphone-13       | écart mineur    | Idem |

**Reste OK** : 11 sujets sur lesquels Thomas intervient + ce qu'il n'accepte pas + formulaire 3 champs + signature "Patient par choix. Exigeant par principe."

### `/opportunites`

| Device          | Statut | Vérifications passées                                                                                       |
|-----------------|--------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | OK     | H1 "Vous avez un dossier. Voyons s'il correspond.", 3 critères, 2 colonnes immobilier / participations, formulaire 7 champs avec mention RGPD, signature "Vingt ans devant. Pas de sortie prévue." |
| ipad            | OK     | Identique, padding réduit |
| iphone-13       | OK     | Empilement single-col, formulaire pleine largeur |

### `/participations`

| Device          | Statut | Vérifications passées                                                                                       |
|-----------------|--------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | OK     | H1 "Un écosystème construit décision après décision.", section Gradient One mise en avant, grille 4 participations opérationnelles (Versi Immobilier / Versi Invest / Immocrew / Versimo), section "Détenu directement par ISSA Capital" (15 lots IDF), pied "Une thèse, pas un portefeuille opportuniste" |
| ipad            | OK     | Grille 2 cols |
| iphone-13       | OK     | Cards empilées |

### `/contact`

| Device          | Statut | Vérifications passées                                                                                       |
|-----------------|--------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | OK     | H1 "Prendre contact.", intro courte, formulaire 4 champs (name/email/subject/message) + RGPD + bouton "Envoyer", section "Contact direct" avec adresse + email |
| ipad            | OK     | Identique |
| iphone-13       | OK     | Formulaire pleine largeur, lisibilité OK |

### `/mentions-legales`

| Device          | Statut       | Vérifications passées                                                                                       |
|-----------------|--------------|-------------------------------------------------------------------------------------------------------------|
| desktop-chrome  | écart mineur | Toutes les sections obligatoires présentes (éditeur, hébergeur, propriété intellectuelle, politique de confidentialité, données traitées, base légale, durée, droits, cookies, contact). **Liste d'ancres internes en haut absente** — la page est dense et bénéficierait d'une table des matières (cf. `page-compositions.md` mentionne un anchor-nav). Non bloquant pour le lancement. |
| ipad            | écart mineur | Idem |
| iphone-13       | écart mineur | Idem |

---

## Récap des écarts

| #  | Sévérité  | Page              | Description                                                       | Owner       |
|----|-----------|-------------------|-------------------------------------------------------------------|-------------|
| V1 | mineur    | `/accompagnement` | Verbatim entrepreneur dans `<footer>` au lieu de `<figcaption>` ou `<p>` — bug sémantique a11y, strict-mode Playwright | @fullstack  |
| V2 | mineur    | `/mentions-legales` | Pas d'anchor-nav en tête de page — UX dense                       | @fullstack (post-launch) |

**Aucun écart bloquant.** Les 21 baselines sont validées comme références CI.

---

## Recommandations CI

1. **Première validation passée** : ces 21 PNG peuvent être committées comme baselines de référence pour `expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.005 })` en CI.
2. Pour activer la comparaison pixel-diff stricte en CI (gate G26 automatisée), modifier `tests/visual/screenshots.spec.ts` pour utiliser `expect(page).toHaveScreenshot()` au lieu de `page.screenshot({ path })`. Playwright comparera alors automatiquement aux PNG dans `tests/screenshots/`.
3. **WebKit en CI** : sur le runner CI réel (qui supportera webkit), réactiver le device `iPhone 13` natif (cf. `qa-strategy.md` section 5). Cela générera de nouvelles baselines WebKit qui REMPLACERONT celles produites par Chromium 375px — une review humaine sera nécessaire à ce moment-là.

---

## Handoff → @fullstack

- Bug V1 (footer imbriqué) à corriger en Phase 2c.
- Bug V2 (anchor-nav mentions légales) en backlog post-launch.

## Handoff → @testeur-karim + @testeur-leila (Phase 2c)

Les 7 pages sont visuellement conformes aux compositions. Vous pouvez tester sur :
- **URL serveur dev** : `http://localhost:3000` (lancer `npm run dev`)
- **Pages prioritaires** :
  - testeur-karim → `/`, `/mission`, `/accompagnement`
  - testeur-leila → `/`, `/opportunites`, `/participations`
- Les baselines de référence sont dans `tests/screenshots/` si vous voulez comparer ce que vous voyez en local au pixel exact validé.
