> Sources amont : docs/orchestration-plan.md, src/app/page.tsx, src/app/mission/page.tsx, src/app/participations/page.tsx, src/app/accompagnement/page.tsx

# Audit QA — Session 7 ISSA Capital (Phase 7 mega-passe)

**Date** : 2026-04-08
**Agent** : @qa
**Scope** : audit post-refonte de 4 pages (homepage, /mission, /participations, /accompagnement)
**Branche** : `claude/resume-issa-session-7-1SjaO`
**Commits audités** : `853a3c2` (homepage), `0e4df81` (mission + participations), `07cd458` (accompagnement + 13 screenshots)

---

## Section 1 — Pipeline G28 complet

Exécution séquentielle des 5 étapes du pipeline pre-deploy. Ordre : tsc → lint → vitest → build → playwright.

| Étape | Commande | Résultat | Verdict |
|---|---|---|---|
| 1. TypeScript strict | `npx tsc --noEmit` | 0 erreur | PASS |
| 2. ESLint | `npm run lint` | No ESLint warnings or errors | PASS |
| 3. Vitest unit tests | `npm run test` | 7/7 PASS (contactSchema 6 + rateLimit 1) | PASS |
| 4. Next.js build | `npm run build` | 15/15 pages statiques générées | PASS |
| 5. Playwright E2E visual | `npx playwright test tests/visual` | 21/21 PASS (40.2s) | PASS |

**Détail build** : toutes les routes prévues sont bien statiques (○) sauf `/api/contact` (ƒ dynamique comme attendu). First Load JS partagé = 87.3 kB, aucune page > 100 kB. Aucun dépassement de budget bundle.

**Détail Playwright** : 21 baselines (7 pages × 3 devices : iphone-13 375px, ipad 768px, desktop-chrome 1280px). Toutes les pages auditées (home, mission, accompagnement, participations) passent sur les 3 devices — conforme G26.

**Verdict pipeline G28 complet** : **PASS 5/5**. Déploiement autorisé au regard des critères techniques.

---

## Section 2 — Grep de non-régression (contraintes verrouillées)

### 2.1 Contraintes factuelles (dates, lieux)

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| Pas de "1994" dans /mission | `rg "1994" src/app/mission/page.tsx` | 0 match | PASS |
| Pas de "1994" dans /accompagnement (hors commentaires) | `rg "1994" src/app/accompagnement/page.tsx` | 2 matches — lignes 34 et 132, **uniquement dans commentaires anti-régression** (`"2J Impression rachat = 2016 (jamais 1994)"`) | PASS* |
| "Afrique du Sud" présent dans /mission | `rg "Afrique du Sud" src/app/mission/page.tsx` | 2 matches (ligne 147 commentaire + ligne 156 rendu JSX bio Thomas) | PASS |

*Les 2 matches de "1994" dans /accompagnement sont des commentaires de garde ("jamais 1994") qui documentent la correction session 6. Ils ne sont pas rendus au client. C'est un PASS — la contrainte "2J Impression = 2016" est respectée dans le contenu rendu.

### 2.2 Contraintes de coupe /mission (bio calibrée — learning session 6 P2)

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| 0 école Thomas (Florimont/Irvine) | `rg "Florimont\|Irvine" src/app/mission/page.tsx` | 0 match | PASS |
| 0 employeur/client Thomas | `rg "Sony\|TEOS\|TikTok\|Adidas\|Lego" src/app/mission/page.tsx` | 0 match | PASS |
| 0 prénom d'enfants | `rg "Antoine\|Noémie\|Lucas" src/app/mission/page.tsx` | 0 match | PASS |
| JSON-LD nettoyé (alumniOf retiré) | `rg "alumniOf" src/app/mission/page.tsx` | 0 match | PASS |
| Sonia Issa gardée | `rg "Sonia" src/app/mission/page.tsx` | 6 matches | PASS |

**Commentaire** : la bio /mission respecte strictement la calibration "site vitrine épurée, pas musée biographique" (learning session 6). Toutes les coupes demandées par Thomas sont appliquées.

### 2.3 Contraintes Variante A flexible /accompagnement

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| "Selon le contexte" (formulaire) | `rg "Selon le contexte" src/app/accompagnement/page.tsx` | 1 match | PASS |
| "Selon la nature de la mission" (section duo) | `rg "Selon la nature de la mission" src/app/accompagnement/page.tsx` | 3 matches | PASS |
| Flexibilité duo "porté par Jean-Pierre" | `rg "porté par Jean-Pierre" src/app/accompagnement/page.tsx` | 1 match ligne 300 : `"porté par Jean-Pierre, Thomas, ou les deux"` | PASS |
| Mention Sony/TEOS/TikTok/Adidas/Lego AUTORISÉE | `rg "Sony\|TEOS\|TikTok\|Adidas\|Lego" src/app/accompagnement/page.tsx` | 6 matches (bio Thomas rendue lignes 196-204 + commentaires) | PASS |

**Commentaire** : la variante A flexible est bien en place. Le formulaire mentionne "Selon le contexte", la section duo articule la flexibilité "l'un, l'autre ou les deux" via "porté par Jean-Pierre, Thomas, ou les deux". L'exception documentée (employeurs/clients Thomas autorisés uniquement ici, pas dans /mission) est respectée.

### 2.4 Contraintes /participations (Variante A par domaine)

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| Narratif "écosystème immobilier depuis 2020" | `rg "Un écosystème immobilier construit depuis 2020" src/app/participations/page.tsx` | 2 matches | PASS |
| 0 flag `featured: true` | `rg "featured.*true" src/app/participations/page.tsx` | 0 match | PASS |
| 0 bordure visuelle de mise en avant | `rg "border-2 border-levant-500" src/app/participations/page.tsx` | 0 match | PASS |
| 0 `col-span-2` sur Versi Invest | `rg "col-span-2" src/app/participations/page.tsx` | 0 match total | PASS |

**Commentaire** : la Variante A par domaine retire toute hiérarchisation visuelle entre les 6 participations (pas de "featured", pas de col-span-2, pas de bordure Levant). Conforme au brief "pas de hiérarchie, Gradient One en attribution".

### 2.5 Zéro mention agence Thomas par nom

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| 0 variation nom d'agence | `rg -i "spotli\|split\|strato" src/app/` | 1 match = `.split(',')` méthode JS dans `api/contact/route.ts` — **aucun nom propre** | PASS |
| "agence de communication internationale" sans nom | `rg "agence de communication" src/app/` | 4 matches, tous en formulation générique : `"une agence de communication internationale"` dans /mission:158 et /accompagnement:205 | PASS |

**Commentaire** : règle absolue CLAUDE.md n°14 respectée (zéro concurrent par nom). L'agence internationale de Thomas est mentionnée sans nom propre sur les deux pages qui la citent.

### 2.6 UTF-8 direct dans le code (règle CLAUDE.md n°13)

| Gate | Commande | Résultat | PASS/FAIL |
|---|---|---|---|
| 0 séquence `\u00XX` dans strings JS | `rg "\\\\u00[0-9a-f]{2}" src/app/` | 0 match | PASS |
| 0 entité HTML `&eacute;`/`&egrave;`/`&agrave;`/`&ccedil;` | `rg "&eacute;\|&egrave;\|&agrave;\|&ccedil;" src/app/` | 0 fichier | PASS |

**Commentaire** : les accents sont en vrais UTF-8 partout. Les `&apos;` (22 dans /mission) sont dans du JSX rendu — exigence React pour apostrophes, tolérance explicite CLAUDE.md n°13.

---

## Section 3 — Synthèse et verdict

### Récapitulatif des gates auditées

| Catégorie | Gates | PASS | FAIL |
|---|---|---|---|
| Pipeline G28 (5 étapes) | 5 | 5 | 0 |
| Contraintes factuelles | 3 | 3 | 0 |
| Coupes bio /mission | 5 | 5 | 0 |
| Variante A flexible /accompagnement | 4 | 4 | 0 |
| Variante A par domaine /participations | 4 | 4 | 0 |
| Zéro mention agence Thomas | 2 | 2 | 0 |
| UTF-8 direct | 2 | 2 | 0 |
| **TOTAL** | **25** | **25** | **0** |

### Verdict global

**GO — 25/25 gates PASS**

- Pipeline G28 vert de bout en bout (tsc 0 / lint 0 / vitest 7/7 / build 15/15 / playwright 21/21)
- Toutes les contraintes factuelles verrouillées session 6 sont respectées (2J Impression = 2016, Afrique du Sud présent, pas de Florimont/Irvine, bio calibrée)
- Les 3 variantes approuvées en Phase 7 sont conformes :
  - Homepage stats-only strict
  - /mission Version RICHE v2 6 sections avec Sonia en italique
  - /participations Variante A par domaine (4 sections, Gradient One en attribution, 0 hiérarchie visuelle)
  - /accompagnement Variante A flexible (duo JP+Thomas, formulation "l'un, l'autre ou les deux")
- Règles absolues CLAUDE.md respectées : n°13 UTF-8 direct, n°14 zéro concurrent par nom, n°16 volume biographique calibré persona

---

## Section 4 — Recommandations

Aucun blocker détecté. Les recommandations ci-dessous sont des pistes d'amélioration non-bloquantes pour sessions futures :

1. **Commentaires de garde anti-régression** : les commentaires `"(jamais 1994)"` dans /accompagnement lignes 34 et 132 sont utiles comme documentation de correction session 6. Garder en l'état — ils survivent aux Grep de garde mais sont clairement contextualisés.
2. **Couverture test pipeline** : le pipeline G28 actuel couvre le frontend de bout en bout. Pour session 8, envisager l'ajout de tests d'intégration sur l'API `/api/contact` (happy path + rate limit + validation Zod) si le formulaire devient critique pour la conversion.
3. **Mutation testing** : à considérer pour `src/lib/contactSchema.ts` et `src/lib/rateLimit.ts` (chemins sensibles) si le volume de tests croît — hors scope session 7.

---

## Handoff

---
**Handoff → @orchestrator**

- **Fichiers produits** :
  - `/home/user/ISSA-Capital/docs/qa/session7-audit-report.md` (ce rapport)
- **Décisions prises** :
  - Verdict global **GO** : 25/25 gates PASS, pipeline G28 vert, toutes contraintes session 7 respectées
  - Les commentaires de garde `"jamais 1994"` dans /accompagnement sont considérés comme PASS (documentation de correction, pas affirmation factuelle)
  - Aucune relance corrective nécessaire — Phase 7 mega-passe est validée du point de vue QA
- **Points d'attention** :
  - La régénération des 21 baselines Playwright en Phase 7 a été vérifiée — cohérence visuelle intacte sur les 3 devices (iphone-13, ipad, desktop-chrome)
  - Aucun secret ou clé API en placeholder détecté (scope de cette session : audit des 4 pages, pas du repo entier — confirmer côté @infrastructure si audit complet demandé)
  - Session 7 est prête pour merge/déploiement au regard des critères @qa. Prochaine étape recommandée : review @reviewer pour validation finale inter-agents avant handoff @infrastructure
- **Variables d'env / secrets** : aucune modification côté QA
---
