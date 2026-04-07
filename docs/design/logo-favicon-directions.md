# Directions logo / favicon — ISSA Capital

> @design — 2026-04-07
> Mission post-deploy : réponse au retour de Thomas sur le logo/favicon actuel.
> Contexte : Thomas rejette le monogramme "I" actuel ("J'aime pas du tout favicon logo").
> Ce document propose 3 directions de refonte. Thomas choisit, SVG finalisé dans une passe ultérieure.

---

## Diagnostic : pourquoi le "I" actuel pose problème

Le favicon actuel est un carré noir (#0A0A0A) avec un "I" serif crème centré et un filet ocre sous l'empattement bas. Le problème est structurel, pas stylistique :

**Le "I" seul est une barre verticale.** À 16×16 pixels (onglet navigateur), un "I" avec empattements ressemble à un rectangle. Il est quasi-indiscernable d'un trait vertical, d'un curseur, ou d'un artefact. Même à 32×32, la lettre "I" n'a pas de silhouette distinctive — elle n'a aucune forme propre qui se grave dans la mémoire.

**La lisibilité du logo complet est correcte** — "ISSA CAPITAL" en tracé vectoriel avec le séparateur ocre est lisible en format header. Le problème est concentré sur le **monogramme** utilisé en favicon et usage compact.

**Ce qu'il faut corriger** : trouver une marque distinctive qui fonctionne à 16px, 32px, 192px et 1200px — qui soit reconnaissable en un coup d'œil sans qu'on ait besoin de lire une lettre.

---

## Direction A — Monogramme "IC" juxtaposé

### Description verbale

Deux lettres serif majuscules "I" et "C" positionnées côte à côte, sans espace ou avec un espacement très réduit (2px), dans le même style sermon serif que le logo actuel. Le "C" apporte immédiatement une silhouette distinctive : sa courbe ouverte vers la droite contraste avec la verticalité du "I". L'ensemble crée une forme reconnaissable même à petite taille.

### Wireframe ASCII (32×32 viewport)

```
┌──────────────────────────────────┐
│                                  │
│    ████  ████████████            │
│     ██      ██████               │
│     ██      ██                   │
│     ██      ██                   │
│     ██      ██                   │
│     ██      ██                   │
│     ██      ████████             │
│    ████                          │
│         ░░░░░ (filet ocre)       │
│                                  │
└──────────────────────────────────┘
```

Version verbale précise : fond carré ink-950. "I" serif (empattements haut et bas) à gauche, occupant environ 40% de la largeur. "C" ouverte à droite, même hauteur, même style serif, occupant 55% de la largeur. Un filet ocre levant-500 de 1.5px horizontalement sous les deux lettres, centré.

### Déclinaisons

| Format | Rendu |
|---|---|
| Favicon 16px | "IC" en un bloc compact — la courbe du C est lisible, forme reconnaissable |
| Favicon 32px | Empattements visibles, filet ocre discret |
| Logo header | "IC" monogramme à gauche + "ISSA Capital" wordmark à droite, séparateur ocre vertical |
| OG image 1200×630 | "IC" grand format centré sur fond ink-950, baseline en dessous |
| Monogramme app 192px | Pleine lisibilité, empattements élégants |

### Rapport au "I" actuel

Corrige directement le problème de silhouette : le "C" apporte une forme ouverte qui contraste avec le "I" vertical. À 16px, le cerveau reconnaît "forme + courbe" plutôt que "deux barres". La lisibilité à petite taille est considérablement améliorée.

### Cohérence Ruler/Outlaw

Très forte. Deux initiales = signature institutionnelle classique (toutes les grandes maisons familiales utilisent les initiales du fondateur ou de la famille). Le style serif strict, les empattements nets, le filet ocre conservent exactement le langage visuel actuel. L'évolution est minimale et précise.

### Risques

- Le "IC" en uppercase serif peut être lu "I.C." (initiales personnelles du fondateur) — à vérifier si c'est souhaité ou gênant
- À 16px, la séparation I/C doit être calibrée avec précision (ni trop serrée — illisible, ni trop large — perd la cohésion)
- Le nom "ISSA Capital" commence bien par IC (I = ISSA, C = Capital) — cohérence logique forte

---

## Direction B — Symbole "Seuil" (arc géométrique)

### Description verbale

Un symbole abstrait construit sur la métaphore du seuil, en résonance directe avec la section "Deux portes" de la homepage. Deux piliers verticaux rectangulaires (traits nets, serif ou sans serif) reliés par un arc supérieur en demi-cercle ou en linteau horizontal. L'ensemble forme la silhouette schématique d'une porte ou d'un passage.

La forme est entièrement abstraite — pas d'ornement, pas de figuratif. C'est une **géométrie pure** qui évoque sans représenter.

### Wireframe ASCII (32×32 viewport)

```
┌──────────────────────────────────┐
│                                  │
│      ┌──────────────────┐        │
│      │                  │        │
│     ███                ███       │
│     ███                ███       │
│     ███                ███       │
│     ███                ███       │
│     ███                ███       │
│     ███                ███       │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│         (filet ocre bas)         │
└──────────────────────────────────┘
```

Version verbale précise : fond carré ink-950. Deux piliers rectangulaires crème (3px de large, hauteur ~60% du carré) alignés à gauche et à droite du centre. Un linteau horizontal crème les relie en haut (2px de haut). Le tout forme un "portique" schématique. Un filet levant-500 de 1.5px horizontal à la base des piliers, légèrement plus large que le portique lui-même.

Variante arc : remplacer le linteau droit par un demi-cercle — plus doux, moins architectural, plus symbolique.

### Déclinaisons

| Format | Rendu |
|---|---|
| Favicon 16px | La silhouette "portique" est reconnaissable (deux traits + barre haute) — lisibilité correcte |
| Favicon 32px | Forme nette, filet ocre visible |
| Logo header | Symbole seul à gauche + wordmark "ISSA Capital" à droite |
| OG image 1200×630 | Symbole grand format centré sur fond ink-950, baseline sous le symbole |
| Monogramme app 192px | Détails fins des piliers, filet ocre signature |

### Rapport au "I" actuel

Rupture totale avec la lettre "I". On abandonne la logique monogramme pour une logique de symbole de marque. C'est un saut plus radical mais potentiellement plus mémorable — les marques les plus fortes ont des symboles, pas des initiales.

### Cohérence Ruler/Outlaw

Forte sur l'Outlaw (refus du conventionnel — un symbole abstrait vs un monogramme traditionnel), correcte sur le Ruler (géométrie nette, angles droits, aucun ornement). La métaphore du seuil résonne avec la narrative de la homepage ("Deux portes") — cohérence éditoriale et visuelle.

### Risques

- Un symbole abstrait sans lettre est moins immédiatement lisible comme initiale de la marque — nécessite un temps d'appropriation plus long
- À 16px, le portique peut être trop peu distinctif s'il n'est pas conçu avec une précision pixel-perfect
- Si Thomas veut que le logo seul soit compréhensible sans le wordmark, ce symbole est moins autonome que le "IC"

---

## Direction C — Logotype typographique "ISSA" en format condensé

### Description verbale

Pas de monogramme, pas de symbole — le **nom "ISSA" lui-même devient le logo**, composé en majuscules serrées dans le style serif actuel, sur une hauteur réduite (monocase, lettres compressées verticalement). Un détail graphique differentiant : un tiret ou une ligne de respiration levant-500 entre le "I" et le "SSA", ou un espacement différentiel qui crée un rythme visuel (I · SSA).

L'idée : rendre le mot lisible à petite taille mieux qu'un "I" seul, tout en conservant le wordmark comme unité visuelle. Le "CAPITAL" passe en sous-titre discret (taille plus petite, poids plus léger).

### Wireframe ASCII (favicon 32×32)

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│   ██ ███ ███ ██                  │
│   ██ █   █   ██                  │
│   ██ ████ ████ ██                │
│   ██    █    █ ██                │
│   ██ ███ ███ ██                  │
│                                  │
│   ░░░░░░░░░░░░░░░░░              │
│       (filet ocre)               │
└──────────────────────────────────┘
```

Version verbale précise : fond carré ink-950. Les 4 lettres "ISSA" en majuscules serif crème, condensées horizontalement pour tenir dans la zone carrée. Hauteur de lettres environ 50% de la hauteur du carré. Un filet levant-500 horizontal de 1.5px sur toute la largeur sous les lettres, centré dans le demi-carré inférieur.

### Déclinaisons

| Format | Rendu |
|---|---|
| Favicon 16px | 4 lettres "ISSA" en minuscule — lisibilité limite à cette taille, acceptable si condensées |
| Favicon 32px | 4 lettres nettes, filet ocre visible |
| Logo header | "ISSA" grand + "CAPITAL" en sous-ligne (tracking élevé, poids léger) |
| OG image 1200×630 | "ISSA" centré large, "CAPITAL" sous-ligne, baseline de marque |
| Monogramme app 192px | Pleine lisibilité, beau rendu serif |

### Rapport au "I" actuel

Corrige le problème par augmentation de lisibilité : 4 lettres distinctes valent toujours mieux qu'une. Le wordmark complet "ISSA Capital" reste identique — seule la partie monogramme/favicon évolue vers "ISSA" condensé plutôt que "I" seul.

### Cohérence Ruler/Outlaw

Forte sur le Ruler (maîtrise typographique, hiérarchie claire ISSA / Capital). Modérée sur l'Outlaw — un logotype typographique pur est la forme la moins surprenante, mais la plus solide. Ce n'est pas une rupture, c'est un affinement.

### Risques

- À 16px, 4 lettres serif dans un carré peuvent être illisibles si les traits sont trop fins — nécessite une version spécifiquement dessinée pour la petite taille (simplification des empattements)
- Le wordmark complet existant ("ISSA Capital" avec séparateur ocre) devra être révisé pour aligner la nouvelle hiérarchie typographique ISSA / Capital
- Moins distinctive qu'un symbole abstrait ou un monogramme bi-lettre

---

## Récapitulatif des 3 directions

| Critère | A — IC monogramme | B — Symbole seuil | C — ISSA logotype |
|---|---|---|---|
| Lisibilité 16px | Bonne (courbe C distinctive) | Correcte (silhouette portique) | Limite (4 lettres serrées) |
| Mémorabilité | Bonne (initiales claires) | Très forte (forme unique) | Bonne (le nom lui-même) |
| Rupture avec "I" actuel | Faible (évolution directe) | Totale (nouveau langage) | Faible (extension logique) |
| Cohérence wordmark existant | Très haute | À reconstruire | Haute |
| Effort de refonte | Minimal | Moyen | Minimal |
| Risque d'incompréhension | Faible | Modéré | Faible |

---

## Recommandation

**#1 prioritaire : Direction A — Monogramme "IC"**

C'est la réponse la plus directe et la moins risquée au problème posé. Le "I" seul échoue parce qu'il n'a pas de silhouette distinctive. Ajouter le "C" de "Capital" résout exactement ce problème : le "C" ouvert contraste avec la verticalité du "I" et crée une forme mémorable même à 16px. L'évolution est cohérente avec le logo existant, la palette est inchangée, le langage graphique est continu. C'est la passe de correction chirurgicale.

**#2 : Direction C — "ISSA" logotype condensé**

Si Thomas préfère que le favicon porte le nom complet plutôt que des initiales. Plus lisible que le "I" seul, moins ambigu qu'un "IC" qui pourrait être compris comme initiales personnelles. La contrainte de lisibilité à 16px est réelle et demandera un dessin précis de la version petite taille — plan B robuste.

**#3 : Direction B — Symbole seuil**

Option la plus ambitieuse et la plus originale. Recommandée uniquement si Thomas veut construire une vraie identité de marque sur le long terme avec un symbole propre à ISSA Capital — au-delà de la correction urgente. Si le projet est amené à se développer (nouvelles entités, fonds, communication externe), un symbole abstrait est plus scalable qu'un monogramme d'initiales. À considérer si Thomas a le goût de la durée.

---

## Note technique (pour passe de finalisation)

Une fois la direction choisie, @design produit :
1. `public/favicon.svg` (32×32) — version favicon pixel-perfect
2. `public/favicon-source.svg` (48×48)
3. `public/logo-monogram.svg` (64×64) — usage compact header/footer
4. Mise à jour de `public/logo.svg` et `public/logo-inverse.svg` si la logique monogramme change (Direction A ou C)
5. Mise à jour de `public/og-image-source.svg` pour cohérence
6. Mise à jour de `docs/design/assets-handoff.md` — section "Notes de design"
7. @fullstack régénère les binaires PNG/ICO via `node scripts/generate-assets.mjs`

Aucune modification de design-tokens.json ni de composants — la palette est inchangée.

---

## A valider par Thomas

**Mission accomplie — choix requis :**

Trois directions de refonte du logo/favicon sont proposées. La palette ink-950/parchment-100/levant-500 reste inchangée dans les trois cas.

**Quelle direction retiens-tu pour le favicon et le monogramme ?**

- **Direction A — Monogramme "IC"** : ajout du "C" au "I" existant — correction chirurgicale, évolution minimale, silhouette distincte. Recommandée.
- **Direction B — Symbole seuil** : abandon du monogramme pour une forme géométrique abstraite évoquant un portique/passage — rupture totale, ambition long terme.
- **Direction C — "ISSA" logotype condensé** : 4 lettres dans le favicon, le nom devient la marque — plus lisible que "I" seul, refonte légère.

Précise également si le **logo header complet** (wordmark "ISSA Capital" avec séparateur ocre) doit être revu en même temps, ou si la correction se limite au favicon/monogramme.

---

**Handoff → @orchestrator**
- Fichier produit : `docs/design/logo-favicon-directions.md`
- Décision en attente : choix de Thomas parmi Direction A / B / C
- Précision attendue : refonte favicon seul, ou favicon + logo header complet
- Une fois choix confirmé → @design finalise les SVG → @fullstack régénère les binaires
- Palette verrouillée inchangée dans les 3 directions : ink-950 / parchment-100 / levant-500
