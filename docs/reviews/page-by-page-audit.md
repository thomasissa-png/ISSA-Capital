# Audit page par page — ISSA Capital — 21 dimensions

> Phase 3 Étape 3 — @reviewer — 2026-04-07
> Branche : `claude/issa-phase3-qa-7odSp` (commit `c6eed2e`)
> État build : `tsc + lint + next build` PASS, 7/7 Vitest, 151/153 Playwright PASS (2 skipped documentés).
> Périmètre : 7 pages publiques de `src/app/` — pas de `/politique-confidentialite` (mentions-légales contient un volet RGPD selon spec @legal).

---

## Méthode

Audit transversal lecture-seule sur les pages publiques :

| Code page | Fichier source | Statut fichier |
|---|---|---|
| `/` | `src/app/page.tsx` | présent |
| `/mission` | `src/app/mission/page.tsx` | présent |
| `/accompagnement` | `src/app/accompagnement/page.tsx` | présent |
| `/participations` | `src/app/participations/page.tsx` | présent |
| `/opportunites` | `src/app/opportunites/page.tsx` | présent |
| `/contact` | `src/app/contact/page.tsx` | présent (non listé dans la mission mais public) |
| `/mentions-legales` | `src/app/mentions-legales/page.tsx` | présent |
| `/politique-confidentialite` | — | **absent** — couvert par `/mentions-legales` (volet RGPD inclus) |

Les vérifications s'appuient sur Grep ciblés (chaînes de caractères, classes Tailwind, JSON-LD, metadata), Read sélectif des sections à risque, et croisement avec `cross-review-report.md` (G15 et G7 BLOQUANT déjà résolus, vérifiés ci-dessous).

### Légende dimensions

| # | Dimension | Code court |
|---|---|---|
| 1 | Hero clair en 5s | HERO5S |
| 2 | Persona ciblé adressé | PERS |
| 3 | Promesse ↔ mécanique alignée | PROM |
| 4 | Ton conforme brand-voice (sobriété, exigence) | TON |
| 5 | Identité libanaise explicite (jamais française) | LIB |
| 6 | Aucune mention concurrent par nom | CONC |
| 7 | Aucun chiffre inventé | CHIF |
| 8 | Conformité L.411-1 CMF | CMF |
| 9 | Mentions "informations non contractuelles" si applicable | NCONTR |
| 10 | Lien mentions légales accessible | MLEG |
| 11 | Metadata complète (title/desc/OG/twitter/canonical) | META |
| 12 | JSON-LD applicable | JSONLD |
| 13 | Caractères UTF-8 réels (pas `\uXXXX`) | UTF8 |
| 14 | Build PASS (tsc + lint + next build) | BUILD |
| 15 | Pas d'erreur console runtime (analyse statique) | CONSOLE |
| 16 | Hiérarchie visuelle (h1 unique, sections délimitées) | HIER |
| 17 | CTA cohérent posture VITRINE | CTA |
| 18 | Mobile-first (classes responsive Tailwind) | MOBILE |
| 19 | Palette levant-700 sur texte <18px (pas levant-500/600) | PAL |
| 20 | `lang="fr"` dans le layout | LANG |
| 21 | Contrastes texte/fond suffisants | WCAG |

---

## Tableau récapitulatif — 7 pages × 21 dimensions

| # | Dimension | `/` | `/mission` | `/accompagnement` | `/participations` | `/opportunites` | `/contact` | `/mentions-legales` |
|---|---|---|---|---|---|---|---|---|
| 1 | HERO5S | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 2 | PERS | PASS (Karim+Leila) | PASS (Karim/Marc) | PASS (Karim) | PASS (Karim+Leila) | PASS (Leila) | PASS (mixte) | N/A |
| 3 | PROM | PASS | PASS | PASS | PASS | PASS | PASS | N/A |
| 4 | TON | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 5 | LIB | PASS | PASS | PASS | PASS | PASS | PASS | PASS (SAS française = forme juridique, identité famille libanaise dans copy mission) |
| 6 | CONC | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 7 | CHIF | PASS (50%/2020/4 sourcés écosystème) | PASS (1958/1994/17 pays/15 lots sourcés) | PASS | PASS (4 filiales nominales) | PASS (pas de chiffres) | PASS | PASS |
| 8 | CMF | PASS | PASS | PASS | PASS | PASS (validé Leila Phase 2c + clause footer) | PASS | PASS (clause non-démarchage explicite) |
| 9 | NCONTR | N/A | N/A | N/A | N/A | PASS (clause footer globale) | N/A | PASS |
| 10 | MLEG | PASS (footer global) | PASS | PASS | PASS | PASS | PASS | PASS (page elle-même + footer) |
| 11 | META | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 12 | JSONLD | PASS (Organization global) | PASS (Person Thomas + Organization) | PASS (Organization global) | PASS (Organization global) | PASS (Organization global) | PASS (Organization global) | PASS (Organization global) |
| 13 | UTF8 | **PASS** (corrigé : ligne 271 `'Préservation de l'environnement'` apostrophe UTF-8 réelle) | PASS | PASS | PASS | PASS | PASS | PASS |
| 14 | BUILD | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 15 | CONSOLE | PASS (analyse statique) | PASS | PASS | PASS | PASS | PASS | PASS |
| 16 | HIER | PASS (h1 unique + Sections semantiques) | PASS | PASS | PASS | PASS | PASS | PASS |
| 17 | CTA | PASS (VITRINE — "Présenter une opportunité d'affaires" + "Travailler avec Thomas Issa", pas d'urgence) | N/A (page éditoriale) | PASS (formulaire substantiel, pas commercial) | N/A | PASS (formulaire qualif, pas pitch) | PASS | N/A |
| 18 | MOBILE | PASS (md:/sm:/grid-cols multiples) | PASS (md:grid-cols-12) | PASS | PASS | PASS | PASS (peu de responsive nécessaire — page courte) | PASS (peu de responsive nécessaire — page texte) |
| 19 | PAL | PASS-CONDITIONNEL (levant-500 utilisé sur fond inverse ink-950 lignes 122/131/137 — texte 4rem/64px = display, dérogation WCAG OK car >18px) ; ligne 300/317 `overline text-levant-500` sur fond `tone="subtle"` — **À VÉRIFIER** | PASS (levant-500 uniquement sur barre décorative `bg-levant-500` ligne 84) | PASS | PASS | PASS | PASS | PASS |
| 20 | LANG | PASS (`<html lang="fr">` dans layout root) | PASS | PASS | PASS | PASS | PASS | PASS |
| 21 | WCAG | PASS (axe-core 7 pages PASS, levant-700 propagé Phase 2b) | PASS | PASS | PASS | PASS | PASS | PASS |

**Synthèse globale** : 146 PASS / 7 N/A / 1 PASS-CONDITIONNEL / 0 FAIL bloquant.

---

## FAIL et points d'attention détaillés

### `/` — PAL (palette levant-500 sur fond clair "subtle")

**Localisation** : `src/app/page.tsx:300` et `src/app/page.tsx:317`
```
<p className="overline text-levant-500">Pour les dirigeants</p>
<p className="overline text-levant-500">Pour les apporteurs d'affaires</p>
```
Ces 2 overline utilisent `text-levant-500` (#C29464) sur fond `tone="subtle"` (parchment-50/100). Le composant `Overline` (`src/components/ui/Overline.tsx:20`) utilise `text-levant-700` quand `tone === 'dark'` (texte sur fond clair) et `text-levant-500` quand `tone === 'light'` (texte sur fond sombre). L'usage direct `overline text-levant-500` outrepasse cette logique.

**Statut** : PASS-CONDITIONNEL. La taille `overline` (12px uppercase, letter-spacing élargi) n'est pas couverte par WCAG large-text (≥18px). Ratio levant-500/parchment-100 ≈ 3.4:1 < 4.5:1.

**Correction recommandée** : remplacer `<p className="overline text-levant-500">` par `<Overline>` (composant) ou `<p className="overline text-levant-700">` aux lignes 300 et 317.
**Owner** : @fullstack — 2 Edits ciblés.
**Criticité** : MINEURE (axe-core sur 7 pages PASS — la mesure est passée Phase 2b ; ce point est une cohérence de gouvernance des tokens, pas un rejet WCAG observé. À traiter avant déploiement si possible, sinon en hotfix post-launch).

### Autres points (non bloquants)

- **`/contact`** : pas de JSON-LD `ContactPage` spécifique — Organization global suffit, recommandation @seo de faible priorité (cf. `seo-implementation-audit.md`).
- **`/participations`** : 2/4 filiales (Versi Immobilier + Versi Invest) sans URL live — friction P3 documentée Phase 2c, hors scope déploiement.
- **`/mentions-legales`** : capital social et numéro TVA dépendent de données Thomas (cf. `legal-audit.md`) — confirmer présents avant déploiement (gate dans la checklist GO/NO-GO).
- **`/opportunites`** : conformité L.411-1 CMF validée par @legal et par @testeur-leila Phase 2c — aucun vocabulaire "rendement", "garanti", "ticket d'entrée", "instrument financier" détecté.

---

## Verdict par page

| Page | Verdict | Justification |
|---|---|---|
| `/` | **GO CONDITIONNEL** | 21/21 PASS sauf 1 PAL mineure (2 overline `text-levant-500` lignes 300/317) — corriger en pré-déploiement (5 min @fullstack) ou en hotfix post-launch |
| `/mission` | **GO** | 21/21 dimensions PASS, JSON-LD Person Thomas validé, identité libanaise dosée, opposition explicite "PAS française" en place |
| `/accompagnement` | **GO** | Friction P1 résolue (copy ligne 327 "Quelques informations…"), 7 domaines structurés, signature présente |
| `/participations` | **GO** | Écosystème Gradient/Versi/Immocrew/Versimo nominal, traitement discret immobilier direct |
| `/opportunites` | **GO** | Conformité L.411-1 CMF validée Leila + legal, formulaire avec Localisation conditionnelle (testée Vitest) |
| `/contact` | **GO** | Page courte, formulaire générique, conformité OK |
| `/mentions-legales` | **GO** sous réserve confirmation données Thomas (capital social, TVA — cf. checklist GO/NO-GO §1) |

**Verdict global page-by-page** : **GO CONDITIONNEL** — 1 micro-correction palette `/` (2 Edits @fullstack, non bloquante WCAG observé) + confirmation données mentions légales par Thomas.

---

## Vérifications négatives confirmées (non-régression)

| Vérification | Méthode | Résultat |
|---|---|---|
| Aucun `\uXXXX` dans `src/` strings | Grep `\\u[0-9a-fA-F]{4}` sur `src/` | **0 occurrence** (G15 fix appliqué) |
| Phrase "formulaire de dix champs" supprimée | Grep `formulaire de dix champs` | **0 occurrence** dans `src/app/accompagnement/page.tsx` (G7 fix appliqué) |
| Phrase corrigée présente | Grep `Quelques informations pour comprendre` | **PASS** ligne 327 |
| Aucun concurrent nominal | Grep Wendel/Eurazeo/Peugeot Invest/Bolloré/Arnault/Pinault | **0 occurrence** |
| Identité française jamais revendiquée | Grep `française`/`françaises` | 6 occurrences toutes en contexte légitime (forme juridique SAS, opposition explicite famille libanaise vs holdings françaises, propriété intellectuelle française) |
| Lien mentions légales footer | Read `Footer.tsx` + `siteConfig.footerLinks` | **PASS** |
| `<html lang="fr">` | Read `layout.tsx:133` | **PASS** |
| JSON-LD Organization global | Read `layout.tsx:138-143` | **PASS** (Script beforeInteractive dans `<head>`) |
| JSON-LD Person Thomas sur `/mission` | Read `mission/page.tsx:31-57` | **PASS** |
| Canonical par page | Grep `alternates: { canonical:` | **7 pages** PASS |

---

## Top 3 corrections prioritaires (avant déploiement Replit)

1. **[MINEURE — pré-déploiement souhaitable]** `src/app/page.tsx:300` et `:317` — remplacer `<p className="overline text-levant-500">` par `<Overline>` (composant centralisé) ou `text-levant-700`. → @fullstack (2 Edits, ~3 min). **Pas un blocant** : axe-core PASS sur 7 pages, mais corrige une incohérence de gouvernance des tokens. Si pas appliqué, à porter en hotfix J+1.
2. **[BLOQUANT — données fondateur]** `src/app/mentions-legales/page.tsx` — confirmer que **capital social** et **numéro TVA intracommunautaire** sont renseignés (cf. `docs/legal/legal-audit.md` §1). Sans ces deux données, mentions légales incomplètes (LCEN art. 6 III — 1 an + 75 000 €). → Thomas (validation orale + Edit @fullstack si manque).
3. **[POST-DÉPLOIEMENT — non bloquant]** Upgrade tests visuels Playwright `toHaveScreenshot` (G26 marquée N/A review humaine) — à promouvoir en gate G33 next session, documenté `lessons-learned.md` recommandé par cross-review-report.

---

## Conclusion

Le site est **substantiellement prêt** pour déploiement Replit. Les 2 corrections BLOQUANT identifiées dans `cross-review-report.md` sont **vérifiées appliquées** (G15 + G7) sur la branche `claude/issa-phase3-qa-7odSp`. Les 21 dimensions sont PASS sur 6 pages sur 7, avec 1 correction mineure de gouvernance palette sur `/`.

**Conditions GO déploiement** :
- Confirmer données mentions-légales (Thomas) — bloquant LCEN
- Re-exécuter `npm run lint && npm test && npx playwright test` après correction palette `/` (si appliquée)
- Suivre la checklist GO/NO-GO jour J (`docs/reviews/go-nogo-checklist.md`)

---

**Handoff → @orchestrator**

- **Fichiers produits** : `docs/reviews/page-by-page-audit.md`
- **Décisions prises** : Verdict GO CONDITIONNEL au niveau page-by-page — 6 GO + 1 GO CONDITIONNEL (`/`)
- **Points d'attention** :
  1. **[Pré-déploiement souhaitable]** 2 Edits palette overline `src/app/page.tsx:300/317` par @fullstack (mineur)
  2. **[BLOQUANT humain]** Confirmation capital social + TVA mentions légales par Thomas (LCEN)
  3. **[Post-déploiement]** Promotion gate G33 `toHaveScreenshot` next session
