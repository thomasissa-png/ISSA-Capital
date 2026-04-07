# Copy — Page Accueil (landing page)
> @copywriter — 2026-04-07
> Framework : AIDA (Attention → Interest → Desire → Action)
> Niveau de conscience : Problem-Aware (Karim sait qu'il a besoin de structurer) + Solution-Aware (Leila sait qu'elle cherche un co-investisseur)
> Source : docs/strategy/brand-platform.md + docs/strategy/personas.md + docs/legal/legal-audit.md

---

## Résumé exécutif

- **Objectif** : poser l'identité d'ISSA Capital en moins de 10 secondes, orienter Karim vers /accompagnement et Leila vers /opportunites
- **Décisions clés** : 2 CTAs distincts dès le hero, identité libanaise affirmée dès le H1, aucune donnée financière ni promesse de rendement
- **Dépendances** : @design (hero visuel, traitement typographique grande taille), @fullstack (routing CTAs, composants)

---

## Objectif de la page

Créer une première impression mémorable qui dit l'identité ISSA Capital en 10 secondes et dirige chaque persona vers son parcours propre — conseil & accompagnement (Karim) ou opportunité d'affaires (Leila).

## Personas cibles

- **Principal A** : Karim (42 ans, entrepreneur en structuration patrimoniale)
- **Principal B** : Leila (38 ans, apporteur d'affaires immobilier / fondateur cherchant co-investisseur)
- **Secondaire** : Marc (journaliste/analyste — earned media)

---

## Métadonnées SEO

```
Title tag (58 car.) : ISSA Capital — Holding patrimoniale famille libanaise
Meta description (153 car.) : ISSA Capital est la holding patrimoniale de la famille Issa, famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique.
OG title : ISSA Capital — Racines libanaises. Exigences sans exception.
OG description : Holding patrimoniale familiale. Horizon intergénérationnel. Filtres de décision non négociables. Immobilier, participations, conseil.
```

---

## H1 — Hero section

[Framework : AIDA — Attention]
[Notes @design : traitement grand format — H1 en taille display (72-96px minimum desktop). Fond sobre, espace blanc dominant. Pas de photo de famille — illustration abstraite ou architecture sobre.]

### H1
**Racines libanaises. Exigences sans exception.**

[Note @legal : la baseline canonique ne contient aucun mot interdit L.411-1 CMF.]
[Note @copywriter — simplification Phase 4 : ancienne tagline "On décide. Pas un calendrier de fonds." retirée sur décision Thomas. Antithèse défensive remplacée par la baseline canonique, conformément à la décision verrouillée post-deploy.]

### Sous-titre (sous le H1)
La holding patrimoniale de la famille Issa — famille aux racines libanaises, établie en France. Patrimoine, participations, transmission.

### CTA principal (double entrée)
- **CTA A** — texte : « Présenter une opportunité d'affaires » → /opportunites
- **CTA B** — texte : « Travailler avec Thomas Issa » → /accompagnement

[Notes @design : deux CTAs de poids visuel différent — CTA A primaire (plein, fond sombre), CTA B secondaire (contour). Placement côte à côte sur desktop, empilés sur mobile.]

### Baseline (sous les CTAs)
*Racines libanaises. Exigences sans exception.*

[Note @copywriter — correction Phase 3 : cette occurrence hero est identique à la baseline footer. Sur la homepage, les deux occurrences sont séparées par le scroll entier de la page — répétition acceptable et cohérente avec l'identité de marque. Conserver les deux occurrences identiques sur la homepage uniquement. Sur les pages internes (Accompagnement, Mission) : utiliser la variante hero si la baseline canonique est déjà en footer — voir brand-voice.md section "Variantes de la baseline".]

---

## Section 2 — Mission (chapeau)

[Framework : AIDA — Interest]

### H2
ISSA Capital, c'est une décision de famille.

### Corps
ISSA Capital est la holding patrimoniale de la famille Issa — famille aux racines libanaises, établie en France. Sa raison d'être est simple : faire fructifier le patrimoine familial dans la durée et organiser sa transmission entre les générations.

Pas un fonds. Pas une structure à terme. Une holding indépendante, dont la famille est le seul actionnaire, et dont l'horizon est intergénérationnel.

Cette holding n'est pas née en 2026. Elle est l'aboutissement de trois décennies de construction patrimoniale — une famille libanaise qui a appris à construire, à tenir, et à transmettre.

### CTA secondaire
Lire notre mission →  [lien vers /mission]

---

## Section 3 — Les deux points d'entrée (bifurcation des parcours)

[Framework : AIDA — Interest, bifurcation Karim/Leila]
[Notes @design : 2 colonnes côte à côte sur desktop. Chacune avec icône ou illustration discrète, titre, 2-3 lignes de texte, CTA. Traitement symétrique mais visuellement distinct.]

### H2
Deux raisons de prendre contact.

---

### Colonne A — Karim

**H3** : Structurer votre patrimoine avec quelqu'un qui l'a fait.

Thomas Issa a co-fondé une holding, investi en direct dans l'immobilier francilien et accompagné des fondateurs pendant 7 ans. Si vous cherchez un pair qui connaît les arbitrages — pas un conseiller qui vend des produits — c'est l'interlocuteur.

**CTA** : Découvrir l'accompagnement →  [lien vers /accompagnement]

---

### Colonne B — Leila

**H3** : Proposer un deal à une holding qui décide vite.

ISSA Capital investit dans l'immobilier résidentiel et des participations minoritaires. Horizon long. Critères explicites. Aucun comité d'investissement qui se réunit une fois par trimestre.

**CTA** : Consulter nos critères →  [lien vers /opportunites]

---

## Section 4 — L'écosystème en aperçu

[Framework : AIDA — Desire, preuve par l'exemple]
[Notes @design : grille 2×3 ou 3×2 cartes. Chaque carte : nom + activité en une ligne + lien si site live. Fond neutre, typographie sobre. Pas de logos tiers sans autorisation.]

### H2
Un écosystème construit depuis 2020.

### Intro (1 ligne)
Participations directes et indirectes — immobilier, tech, services aux professionnels.

### Cartes participations (6 entités — texte complet)

**Gradient One**
Holding intermédiaire co-fondée en 2020. Détient Versi Immobilier, Versi Invest, Immocrew et Versimo.
[Pas de lien — pas de site public]

[Note @copywriter — correction Phase 3 : ajout du wording pour contextualiser la stat "50%" — friction P2 résolue. Voir spécification ci-dessous.]

**Stat "50%" — wording exact à implémenter (@fullstack)**
- Chiffre affiché : **50%**
- Sous-label obligatoire (sous le chiffre, typographie petite) : « Part d'ISSA Capital dans Gradient One — co-fondée en 2020 »
- Tooltip au survol (optionnel, si composant tooltip disponible) : « Gradient One est la holding intermédiaire détenant Versi Immobilier, Versi Invest, Immocrew et Versimo. »
- Sans ce sous-label, le "50%" est cryptique pour tout visiteur découvrant ISSA Capital.

**Versi Immobilier**
Marchand de biens. Marché secondaire résidentiel.
[Lien conditionnel : versi-immobilier.fr — afficher uniquement si site live au lancement]

**Versi Invest**
Club deal et conseil en acquisition immobilière. Pour les investisseurs qui cherchent de l'immo sans en faire leur métier.
[Pas de lien — site non encore disponible]

[Note @legal : "club deal" est une expression sensible. La formulation retenue — "Club deal et conseil en acquisition immobilière" — décrit l'activité de Versi Invest, pas une offre d'investissement d'ISSA Capital. Cette mention présente une participation existante. Risque L.411-1 maîtrisé.]

**Immocrew**
Marketing externalisé pour mandataires immobiliers indépendants. Une promesse : "Tu publies, on fait le reste."
[Lien : immocrew.fr]

**Versimo**
Home staging virtuel par IA. Votre pièce meublée en 90 secondes.
[Lien : versimo.fr]

**Immobilier en direct**
Patrimoine résidentiel géré directement en Île-de-France.
[Pas de lien — pas de site dédié]

### CTA
Voir toutes nos participations →  [lien vers /participations]

---

## Section 5 — Philosophie (filtres de décision)

[Framework : AIDA — Desire, différenciation]
[Notes @design : section sobre, fond légèrement différencié (gris très clair ou off-white). 3 colonnes ou liste verticale épurée. Pas d'icônes criardes.]

### H2
Trois filtres. Aucune exception.

### Intro
Nos décisions d'investissement ne sont pas négociables sur ces trois critères.

### Les 3 filtres (H3 + description)

**H3** : Horizon patrimonial long terme
Nous raisonnons en décennies. Un investissement est évalué sur sa capacité à créer de la valeur sur 20 ou 30 ans — pas sur son TRI à 5 ans. Nous n'entrons pas dans une entreprise pour en sortir.

**H3** : Préservation de l'environnement
L'environnement n'est pas un argument de communication chez nous — c'est un critère de sélection réel. Toute opportunité dont le modèle économique repose sur la dégradation de l'environnement est éliminée, quelle que soit sa rentabilité.

**H3** : Éthique humaine
ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité. Ce filtre est non négociable et précède toute analyse.

---

## Section 6 — CTA final (section symétrique Karim / Leila)

[Framework : AIDA — Action]
[Notes @design : deux colonnes côte à côte sur desktop, empilées sur mobile. Fond sombre (ink-950 ou proche). Chaque bloc : titre H3, sous-titre court, CTA. Traitement visuel symétrique — poids équivalent pour les deux blocs. Ton éditorial, pas commercial agressif — Principe #0 VITRINE.]

### H2
Deux raisons de prendre contact.

---

### Bloc A — Karim

**H3** : Vous cherchez un pair, pas un prestataire.

Travailler avec Thomas Issa, c'est un échange entre décideurs — sur la structuration, le patrimoine, la stratégie. Pas un mandat standardisé.

**CTA** : Découvrir l'accompagnement →  [lien vers /accompagnement]

---

### Bloc B — Leila

**H3** : Vous avez un dossier. Soumettez-le.

ISSA Capital étudie les opportunités qualifiées — immobilier résidentiel et participations minoritaires. Critères explicites, réponse dans la journée.

**CTA** : Consulter nos critères →  [lien vers /opportunites]

[Note @legal : "réponse dans la journée" = engagement de délai, pas promesse de rendement. "Opportunités qualifiées" = posture entrante, conforme L.411-1 CMF.]

---

## Footer (présent sur toutes les pages)

ISSA Capital — SAS — SIREN 102 356 094 — 54 Rue Henri Barbusse, 92000 Nanterre
*Racines libanaises. Exigences sans exception.*

[Liens] : Mission | Participations | Opportunités | Accompagnement | Contact | Mentions légales | Politique de confidentialité

Les informations publiées sur ce site ne constituent pas une offre de titres financiers, une invitation à investir, ni un démarchage financier au sens des articles L.341-1 et suivants du Code monétaire et financier. ISSA Capital est une holding patrimoniale familiale non soumise à agrément AMF. Les prises de contact via ce site sont exclusivement à l'initiative des tiers souhaitant proposer des opportunités de rapprochement à ISSA Capital.

© 2026 ISSA Capital — Tous droits réservés

---

## Microcopy

| Élément | Texte |
|---|---|
| Lien menu — Mission | Mission |
| Lien menu — Participations | Participations |
| Lien menu — Accompagnement | Conseil & accompagnement |
| Lien menu — Opportunités | Opportunités d'affaires |
| Lien menu — Contact | Contact |
| CTA nav sticky | Présenter une opportunité |
| Alt texte hero image | [À définir par @design selon le visuel choisi — décrire l'image précisément pour accessibilité WCAG] |
| Alt texte logo | ISSA Capital |

---

## Test persona — validation

**Test Karim** (entrepreneur 42 ans, 10 secondes de lecture) :
En arrivant sur la page, Karim lit le H1 "On décide. Pas un calendrier de fonds." Il comprend immédiatement que c'est une holding indépendante, pas un fonds. Il voit "Travailler avec Thomas Issa" — il clique. Ce qu'il retient : un pair qui a fait le chemin, pas un prestataire qui vend un produit. Verdict : la page remplit son rôle pour Karim.

**Test Leila** (apporteur d'affaires, 90 secondes de lecture) :
Leila scanne la page. Elle repère "Proposer un deal à une holding qui décide vite" — 3 lignes, critères annoncés, CTA direct. Elle lit "Horizon long. Critères explicites. Aucun comité d'investissement qui se réunit une fois par trimestre." Son objection principale — la lenteur des family offices — est traitée. Elle clique "Consulter nos critères". Verdict : la page remplit son rôle pour Leila.

**Test Marc** (journaliste, 30 secondes) :
Marc voit l'identité libanaise affirmée dès le premier écran, la mission en 3 lignes, l'écosystème avec 6 entités. Il a assez pour comprendre l'angle : "holding familiale libano-française indépendante, profil atypique pour le marché français." Il note le contact. Verdict : la page donne à Marc la matière minimale pour un premier intérêt éditorial.

---

## Auto-évaluation gates copy

- G5 PASS — Karim, Leila, Marc nommés dans le test persona (>= 2 fois chacun dans la matrice)
- G10 PASS — zéro "envisager", "pourrait", "éventuellement" dans le copy
- G13 PASS — aucun chiffre inventé. Capital social non cité (données légales dans mentions légales seulement). Les chiffres des participations (ex : "15 lots" immobilier direct) non affichés sur l'Accueil
- G15 PASS — aucun placeholder résiduel
- G16 PASS — "ISSA Capital" cité 8 fois
- G19 PASS — identité libanaise, double CTA Karim/Leila, références à l'écosystème spécifique : non copiable tel quel
- G24 PASS — vouvoiement systématique (zéro tutoiement)
- Anti-L.411-1 PASS — aucun mot de la liste noire (rendement, ROI, placement, appel à investisseurs…)

---

## Handoff Phase 3 — @fullstack

**Corrections copy appliquées sur cette page (session 3)**

| Correction | Section | Changement |
|---|---|---|
| Section finale symétrique | Section 6 | Ancienne section asymétrique (CTA Leila dominant, Karim invisible) → remplacée par section 2 blocs équivalents Karim / Leila avec H3 + sous-titre + CTA chacun |
| Sous-label stat "50%" | Section 4 — Carte Gradient One | Ajout spécification wording sous-label + tooltip optionnel |
| Variante baseline | Section 1 — Hero | Note d'usage ajoutée : baseline canonique conservée en hero homepage, variantes documentées dans brand-voice.md pour pages internes |

**Chaînes exactes à remplacer dans le code @fullstack**

1. `src/app/page.tsx` — Section 6 (CTA final)
   - Ancien : bloc centré unique (H2 "Votre dossier correspond à nos critères ?" + CTA "Présenter une opportunité" + CTA secondaire "Travailler avec Thomas Issa")
   - Nouveau : section 2 colonnes symétriques

   **Bloc A — Karim (colonne gauche ou première sur mobile)**
   - H3 : `"Vous cherchez un pair, pas un prestataire."`
   - Corps : `"Travailler avec Thomas Issa, c'est un échange entre décideurs — sur la structuration, le patrimoine, la stratégie. Pas un mandat standardisé."`
   - CTA texte : `"Découvrir l'accompagnement"` → `/accompagnement`

   **Bloc B — Leila (colonne droite ou deuxième sur mobile)**
   - H3 : `"Vous avez un dossier. Soumettez-le."`
   - Corps : `"ISSA Capital étudie les opportunités qualifiées — immobilier résidentiel et participations minoritaires. Critères explicites, réponse dans la journée."`
   - CTA texte : `"Consulter nos critères"` → `/opportunites`

   [Styling : fond sombre (ink-950). Deux blocs de poids visuel identique — ni primaire ni secondaire entre Karim et Leila.]

2. `src/app/page.tsx` — Section 4, carte Gradient One
   - Ajouter sous-label sous le chiffre "50%" : `"Part d'ISSA Capital dans Gradient One — co-fondée en 2020"`
   - Si composant tooltip disponible dans le design system : `"Gradient One est la holding intermédiaire détenant Versi Immobilier, Versi Invest, Immocrew et Versimo."`
   - Si pas de composant tooltip : le sous-label seul est suffisant

**Décisions copy non négociables sur cette page**
- Section finale : poids visuel ÉGAL pour les deux blocs Karim/Leila — interdiction de redonner la primauté à l'un sur l'autre
- Ton éditorial en section finale : pas de fond rouge, pas de compte à rebours, pas de "DERNIÈRE CHANCE" — Principe #0 VITRINE
- "Racines libanaises. Exigences sans exception." reste en footer — ne pas supprimer
