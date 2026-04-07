# Audit — Échelle typographique ISSA Capital
**Date** : 2026-04-07
**Auteur** : @design
**Scope** : font-size uniquement (EB Garamond conservé sans discussion)
**Statut** : livrable de diagnostic + recommandation pour implémentation @fullstack

---

## Étape 1 — Cartographie de l'échelle actuelle

### Source de vérité : `tailwind.config.ts` (section `fontSize`)

| Token | Valeur clamp | Min (px) | Max (px) | Utilisation sur la home |
|---|---|---|---|---|
| `display` | `clamp(2.75rem, 6vw, 4.5rem)` | 44px | **72px** | H1 hero § 1 (`text-display`) |
| `h1` | `clamp(2.25rem, 4.5vw, 3.5rem)` | 36px | **56px** | — (non utilisé en home) |
| `h2` | `clamp(1.75rem, 3.2vw, 2.5rem)` | 28px | **40px** | §§ 5, 6, 7 — titres de sections |
| `h3` | `clamp(1.375rem, 2.4vw, 1.875rem)` | 22px | **30px** | §§ 2, 4 — H2 chapeau/filiation ; §§ 7 cards |
| `h4` | `clamp(1.125rem, 1.8vw, 1.375rem)` | 18px | **22px** | Cards participations, filtres |
| `lead` | `clamp(1.125rem, 1.6vw, 1.25rem)` | 18px | 20px | Paragraphes intro, citations |
| `base` | `1rem` (fixe) | — | **16px** | Corps général |
| `label` | `0.875rem` (fixe) | — | 14px | Labels, overlines texte |
| `overline` | `0.75rem` (fixe) | — | 12px | Eyebrows (HOLDING PATRIMONIALE…) |
| `sm` | `0.875rem` (fixe) | — | 14px | Méta, légendes |
| `xs` | `0.75rem` (fixe) | — | 12px | Micro-textes |

**Hors système — à signaler** :
- Section 3 (stats chiffrées : 50%, 2020, 4) utilise `text-6xl` Tailwind natif non défini dans les tokens custom → **60px fixe** (3.75rem). Cette valeur est hors scale custom et représente un risque de cohérence.

### Mapping concret sur la home

```
§1 Hero          text-display  → 72px max desktop  [CONCERNÉ par le signalement Thomas]
§2 Chapeau       text-h3       → 30px max desktop   [H2 rendu petit — délibéré ?]
§3 Stats         text-6xl      → 60px fixe           [HORS SYSTÈME]
§4 Filiation     text-h3       → 30px max desktop
§5 Écosystème    text-h2       → 40px max desktop
§6 Filtres       text-h2       → 40px max desktop
§7 Deux portes   text-h2 + text-h3  → 40px / 30px max
Nav              non inspecté (composant Layout)
Footer           non inspecté (composant Layout)
```

**Observation immédiate** : le saut `display (72px) → h3 (30px)` pour le titre de §2 crée un écart de rapport 2,4:1 entre le hero et la section suivante. C'est intentionnel structurellement (le hero est l'apex), mais visuellement il peut provoquer l'effet "tunnel" signalé par Thomas.

---

## Étape 2 — Benchmark family offices premium

### Méthodologie
Sources : inspection visuelle des homepages + CSS visible via WebSearch/WebFetch sur les institutions suivantes : Rothschild & Co, Lombard Odier, Pictet, Mirabaud, Bordier & Cie. Les valeurs ci-dessous sont des estimations construites à partir de captures visuelles et de la connaissance des standards du secteur. Les mesures sans source directement vérifiable sont marquées `[HYPOTHÈSE — à valider]`.

| Institution | H1 hero (max desktop) | H2 sections | Body | Notes registre |
|---|---|---|---|---|
| **Rothschild & Co** (rothschildandco.com) | ~48–52px `[HYPOTHÈSE]` | ~32–36px | 16–18px | Serif discret, beaucoup d'espace blanc, heading jamais plus large que le regard. Registre : institution, pas annonce |
| **Lombard Odier** (lombardodier.com) | ~44–48px `[HYPOTHÈSE]` | ~28–32px | 16px | Titres sobres, le visuel prime sur la typo. "Rethink everything" en corps maîtrisé. Registre : confiance silencieuse |
| **Pictet** (pictet.com) | ~40–48px `[HYPOTHÈSE]` | ~28–32px | 16px | Très retenu, quasi-éditorial de presse financière. Headings en fonte sans-serif medium. Registre : expertise > standing |
| **Mirabaud** (mirabaud.com) | ~40–44px `[HYPOTHÈSE]` | ~24–28px | 15–16px | Le plus discret du panel. Titres compacts, densité texte maîtrisée. Registre : sobre genevois |
| **Bordier & Cie** (bordier.com) | ~44–52px `[HYPOTHÈSE]` | ~28–32px | 16px | Un peu plus éditorial, serif prominent mais pas agressif. Registre : héritage assumé |
| **Cambridge Associates** (cambridgeassociates.com) | ~36–44px `[HYPOTHÈSE]` | ~24–28px | 16px | Ultra-sobre, presque austère. Chiffres et données visuellement dominants. Registre : institutionnel pur |

### Synthèse benchmark

La fourchette de référence pour un H1 hero premium de family office / private bank établi est **40–52px desktop (max)**. Les outliers au-dessus de 52px existent, mais ils appartiennent soit à des marques grand public (BNP, Société Générale), soit à des refontes récentes cherchant à se différencier visuellement par la taille — stratégie qui peut fonctionner pour une marque de lancement, pas pour une institution qui veut signaler la maturité.

---

## Étape 3 — Diagnostic ISSA Capital vs benchmarks

### Verdict : **Trop grand — de l'ordre de +20 à +32px sur le H1 hero**

| Niveau | ISSA Capital actuel | Fourchette benchmark | Écart |
|---|---|---|---|
| H1 hero | **72px** (max desktop) | 40–52px | **+20 à +32px** |
| H2 sections (§5, §6) | **40px** | 28–32px | **+8 à +12px** |
| H2 chapeau (§2, §4) | **30px** (text-h3) | 24–28px | +2 à +6px |
| Body / lead | 18–20px | 16–18px | +0 à +2px (OK) |

### Effet visuel du `display` à 72px

À 72px en EB Garamond (serif à grandes capitales optiques), "Racines libanaises. / Exigences sans exception." occupe visuellement 2-3 lignes très denses sur desktop standard (1280px). Le rendu est plus proche d'une affiche grand format que d'un titre éditorial de private bank. Sur 1440px et au-delà, l'effet est encore plus marqué.

### Risque registre

Le risque identifié est précis : à 72px, le H1 sort du registre "héritage assumé" (Lombard Odier, Rothschild) pour glisser vers le registre "branding assertif" (Kering, LVMH, ou pire : agence créative). Un prospect UHNW ou family office habitué aux codes de Pictet ou Mirabaud percevra immédiatement cet écart — pas comme une erreur, mais comme un signal : "cette holding est jeune, elle cherche à impressionner." Ce signal contredit directement le principe directeur #0 (VITRINE).

La retenue typographique **signale le statut** dans ce registre. La maîtrise des tailles est une forme de discrétion institutionnelle.

---

## Étape 4 — Trois options chiffrées

### Option A — Conservation (72px hero, pas de changement)

| Niveau | Valeur actuelle | Valeur inchangée |
|---|---|---|
| H1 hero (`display`) | `clamp(2.75rem, 6vw, 4.5rem)` | identique |
| H2 sections (`h2`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | identique |
| H2 chapeau (`h3`) | `clamp(1.375rem, 2.4vw, 1.875rem)` | identique |
| Lead | `clamp(1.125rem, 1.6vw, 1.25rem)` | identique |
| Body | `1rem` | identique |

**Effet visuel attendu** : le hero reste très impactant, presque sculptural. Sur des écrans ≥ 1440px, l'effet "titre magazine luxe" est assumé. Sur mobile (375px), le clamp réduit à 44px — acceptable.

**Justification défendable** : EB Garamond à 72px peut se défendre si l'on assume un positionnement "éditorial audacieux" — un jeune family office qui revendique son existence avec assurance. La taille est un choix de positionnement, pas une erreur.

**Risque** : l'audace perçue peut être lue comme de la démonstrativité — ce que le principe directeur #0 interdit explicitement. Pour une structure créée en mars 2026, un hero à 72px peut donner l'impression d'une marque qui "crie" son existence plutôt qu'une institution qui "assume" la sienne.

---

### Option B — Réduction d'un cran (recommandée)

| Niveau | Valeur actuelle | Valeur proposée | Delta |
|---|---|---|---|
| H1 hero (`display`) | `clamp(2.75rem, 6vw, 4.5rem)` | `clamp(2.25rem, 4.5vw, 3.25rem)` | max 72px → **52px** |
| H2 sections (`h2`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | `clamp(1.5rem, 2.8vw, 2rem)` | max 40px → **32px** |
| H2 chapeau (`h3`) | `clamp(1.375rem, 2.4vw, 1.875rem)` | `clamp(1.25rem, 2.1vw, 1.625rem)` | max 30px → **26px** |
| Lead | inchangé | inchangé | — |
| Body | inchangé | inchangé | — |

**Effet visuel attendu** : le hero à 52px reste imposant et distingué en EB Garamond. L'espacement autour du texte respire davantage. La hiérarchie reste très lisible (hero > sections > corps). Le registre bascule de "affiche" à "éditorial premium" — plus proche de Bordier ou Rothschild que de Kering.

**Risque** : perte d'impact immédiat sur premier scroll. Le héros sera perçu comme plus sobre, moins "coup de poing". Sur certains breakpoints intermédiaires (768–1024px), la différence sera minime.

---

### Option C — Réduction de deux crans (maximum retenue)

| Niveau | Valeur actuelle | Valeur proposée | Delta |
|---|---|---|---|
| H1 hero (`display`) | `clamp(2.75rem, 6vw, 4.5rem)` | `clamp(1.875rem, 3.5vw, 2.75rem)` | max 72px → **44px** |
| H2 sections (`h2`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | `clamp(1.375rem, 2.2vw, 1.75rem)` | max 40px → **28px** |
| H2 chapeau (`h3`) | `clamp(1.375rem, 2.4vw, 1.875rem)` | `clamp(1.125rem, 1.8vw, 1.375rem)` | max 30px → **22px** |
| Lead | inchangé | inchangé | — |
| Body | inchangé | inchangé | — |

**Effet visuel attendu** : registre ultra-sobre, proche de Pictet ou Cambridge Associates. Le texte se fond dans la composition, l'espace blanc domine. Ambiance proche d'un rapport annuel de prestige ou d'une brochure Mirabaud. La photo/couleur de fond prend plus de place que la typographie.

**Risque** : à 44px, EB Garamond perd une partie de sa présence sculpturale. La phrase "Racines libanaises. / Exigences sans exception." est conçue pour être lue comme une déclaration — à 44px, elle risque de sembler anecdotique. Perte d'identité forte possible. Registre austère pouvant sembler "vide" si le contenu visuel (images) ne vient pas compenser.

---

## Étape 5 — Recommandation finale

**Option B — Réduction d'un cran (max 52px hero, max 32px H2).**

Cinq raisons :

1. **Principe directeur #0 (VITRINE)** : 52px en EB Garamond exprime l'identité sans démontrer. L'institution "est", elle n'annonce pas.
2. **Règle Simplicité > Démonstration > Élégance** : 72px est une démonstration. 52px est une élégance maîtrisée.
3. **Persona UHNW** : un prospect habitué aux codes de Rothschild, Pictet ou Lombard Odier lira 52px comme "discrétion choisie" et 72px comme "jeune structure qui veut impressionner". Le signal est décisif.
4. **Benchmarks** : 52px est dans le haut de la fourchette de référence (40–52px). ISSA Capital occupe la position de jeune famille qui revendique son héritage — une légère présence supérieure au strict minimum est cohérente.
5. **EB Garamond** : à 52px, les capitales et les empattements de EB Garamond restent visuellement riches. En dessous de 44px (Option C), la fonte perd son impact distinctif.

L'Option C serait juste si ISSA Capital visait un registre pur "banque centenaire". Elle convient mieux à une refonte dans 10 ans, quand le nom Issa aura sa propre gravité historique. Aujourd'hui, un minimum de présence typographique est légitime.

---

## Étape 6 — Plan d'implémentation

### Fichier principal à modifier

**`/home/user/ISSA-Capital/tailwind.config.ts`** — section `fontSize`, lignes 60–70

Remplacer :
```ts
display: ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
h1: ['clamp(2.25rem, 4.5vw, 3.5rem)', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
h2: ['clamp(1.75rem, 3.2vw, 2.5rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
h3: ['clamp(1.375rem, 2.4vw, 1.875rem)', { lineHeight: '1.33', letterSpacing: '-0.015em' }],
```

Par :
```ts
display: ['clamp(2.25rem, 4.5vw, 3.25rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
h1: ['clamp(1.875rem, 3.8vw, 2.75rem)', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
h2: ['clamp(1.5rem, 2.8vw, 2rem)', { lineHeight: '1.22', letterSpacing: '-0.02em' }],
h3: ['clamp(1.25rem, 2.1vw, 1.625rem)', { lineHeight: '1.35', letterSpacing: '-0.015em' }],
```

Note `lineHeight` : le `display` passe de `1.08` à `1.1` pour compenser la lisibilité à taille réduite — les deux lignes du hero resteront aérées.

### Anomalie hors scope à traiter simultanément

**`/home/user/ISSA-Capital/src/app/page.tsx`** — section 3, ligne 110 :
`text-6xl` (Tailwind natif, 60px fixe) doit être remplacé par un token custom. Proposer `text-display` (Option B : 52px max) ou créer un token `stat` dédié. Cette correction est indépendante de la scale mais doit être traitée dans la même passe pour cohérence système.

### Composants potentiellement impactés

| Composant / Fichier | Usage | Impact Option B |
|---|---|---|
| `src/app/page.tsx` | `text-display`, `text-h2`, `text-h3`, `text-h4` | Automatique via token — pas de modification manuelle |
| `src/app/mission/page.tsx` | Probablement `text-h1` ou `text-display` | À vérifier — surveiller le H1 de la page Mission |
| `src/app/participations/page.tsx` | Probablement `text-h1`, `text-h2` | À vérifier |
| `src/app/accompagnement/page.tsx` | Probablement `text-h1`, `text-h2` | À vérifier |
| `src/app/opportunites/page.tsx` | Probablement `text-h1`, `text-h2` | À vérifier |
| `src/components/ui/` | Composants typographiques si tokens directs | Automatique si les composants utilisent les classes token |

**Estimation** : 1 fichier de configuration (tailwind.config.ts) + 1 correction manuelle dans page.tsx. Les autres pages héritent automatiquement si elles utilisent les classes token. Total : **1 à 2 fichiers à modifier manuellement**.

### Risques de régression responsive

- **Mobile (375–640px)** : le clamp min passe de 2.75rem (44px) à 2.25rem (36px) pour `display`. Sur mobile, le H1 hero affiche donc 36px au lieu de 44px. Vérifier que la phrase en deux lignes ne se casse pas en 3 lignes sur 375px.
- **Tablette (768px)** : le vw s'applique. À 768px, `4.5vw = 34.5px` — le clamp affiche le min (36px). Comportement quasi-identique au mobile.
- **Desktop intermédiaire (1024px)** : `4.5vw = 46px` — dans la plage clamp, rendu fluide. Confortable.
- **Grand écran (1440px+)** : plafonné à 52px. Nette amélioration vs 72px actuel.

Aucun test de layout ne devrait casser — les classes CSS restent identiques, seules les valeurs de taille changent. Un screenshot Playwright avant/après est recommandé sur les 3 breakpoints cibles (375px, 768px, 1280px).

---

**Handoff → @fullstack**

Fichiers produits :
- `/home/user/ISSA-Capital/docs/design/typography-scale-audit.md`

Décisions prises :
- Option B retenue : réduction d'un cran — `display` 72px → 52px max desktop, `h2` 40px → 32px max
- EB Garamond conservé sans discussion (hors scope)
- `lineHeight` de `display` ajusté de 1.08 à 1.10 pour confort de lecture à taille réduite
- Anomalie `text-6xl` natif (section stats) à corriger simultanément

Points d'attention :
- Modifier uniquement `tailwind.config.ts` section `fontSize` (4 lignes) — les composants héritent automatiquement
- Corriger `text-6xl` dans `src/app/page.tsx` ligne ~110 → remplacer par `text-display` (token custom)
- Vérifier rendu mobile 375px après modification : le clamp min passe à 36px, surveiller les sauts de ligne du H1 hero
- Prendre screenshots Playwright avant/après sur 375px / 768px / 1280px pour valider la régression visuelle
- Les pages intérieures (mission, participations, accompagnement, opportunites) héritent automatiquement — vérification visuelle recommandée sur chaque page
