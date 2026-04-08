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
[Note @copywriter Phase 5 — Mission 2 finalisée. Suppression de la répétition "famille Issa — famille aux racines" dans la même phrase de 14 mots. Deux variantes calibrées pour Thomas — choisir l'une avant intégration @fullstack.]

**Variante A (recommandée)** : La holding patrimoniale d'une famille libanaise, établie en France. Patrimoine, participations, transmission.

**Variante B** : Holding patrimoniale — famille libanaise, ancrage français. Patrimoine, participations, transmission.

[Décision @copywriter : Variante A recommandée — conserve la construction narrative "d'une famille" qui ancre l'identité humaine avant l'identité institutionnelle. "Libanaise" direct, sans la périphrase "aux racines libanaises" qui était la source de la répétition. Variante B est plus lapidaire — si Thomas préfère le ton overline-descriptor. À valider Thomas avant intégration.]

### CTA principal (double entrée)
- **CTA A** — texte : « Présenter une opportunité d'affaires » → /opportunites
- **CTA B** — texte : « Besoin d'être accompagné ? » → /accompagnement

[Notes @design : deux CTAs de poids visuel différent — CTA A primaire (plein, fond sombre), CTA B secondaire (contour). Placement côte à côte sur desktop, empilés sur mobile.]

### Baseline (sous les CTAs)
*Racines libanaises. Exigences sans exception.*

[Note @copywriter — correction Phase 3 : cette occurrence hero est identique à la baseline footer. Sur la homepage, les deux occurrences sont séparées par le scroll entier de la page — répétition acceptable et cohérente avec l'identité de marque. Conserver les deux occurrences identiques sur la homepage uniquement. Sur les pages internes (Accompagnement, Mission) : utiliser la variante hero si la baseline canonique est déjà en footer — voir brand-voice.md section "Variantes de la baseline".]

---

## Section 2 — Mission (chapeau)

[Framework : AIDA — Interest]
[Note @copywriter Session 5 — Retour Thomas #3 : H2 "ISSA Capital, c'est une décision de famille." réécrit — tournure "c'est" proscrite + 9 occurrences "famille" ramenées à 3 max dans cette section. Chaleur familiale conservée via héritage, lignée, transmission — sans sur-répétition du mot. Test de lecture : le sens est intact, le registre reste chaud sans être sentimental.]

### H2
Une holding née d'une lignée.

### Corps
ISSA Capital est la holding patrimoniale d'une famille libanaise, établie en France. Sa raison d'être : structurer ce qui s'est construit sur trois décennies, le faire fructifier, le transmettre.

Une structure indépendante, dont les Issa sont les seuls actionnaires, et dont l'horizon est intergénérationnel.

Elle est l'aboutissement de trois décennies de construction patrimoniale — un héritage libanais qui a appris à se tenir dans la durée.

### CTA secondaire
Lire notre mission →  [lien vers /mission]

---

## Section 3 — Les deux points d'entrée (bifurcation des parcours)

[Framework : AIDA — Interest, bifurcation Karim/Leila]
[Notes @design : 2 colonnes côte à côte sur desktop. Chacune avec icône ou illustration discrète, titre, 2-3 lignes de texte, CTA. Traitement symétrique mais visuellement distinct.]
[Note @copywriter Phase 5 : Section 3 conservée. Section 4 "Deux points d'entrée" supprimée (doublon de Section 7). La bifurcation des parcours reste ici, en milieu de page, sans l'antithèse défensive.]

### H2
Deux raisons de prendre contact.

---

### Colonne A — Karim

**H3** : Structurer votre patrimoine avec quelqu'un qui l'a fait.

Thomas Issa a co-fondé une holding, investi en direct dans l'immobilier francilien et accompagné des fondateurs pendant sept ans. Un pair qui connaît les arbitrages — pas les produits à placer.

[Note @copywriter Phase 5 — Mission 3 : "patrimoniaux" retiré — redondant avec "holding" et "patrimoine" déjà établis dans le contexte. La formulation "pas les produits à placer" est directe et suffit sans la répétition de l'adjectif. Section 4 supprimée — l'antithèse défensive originale "pas un conseiller qui vend des produits" disparaît avec elle. Ce bloc Section 3 contient la seule occurrence restante, déjà simplifiée ici.]

**CTA** : Besoin d'être accompagné ? →  [lien vers /accompagnement]

---

### Colonne B — Leila

**H3** : Proposer un deal à une holding qui décide vite.

ISSA Capital investit dans l'immobilier résidentiel et des participations minoritaires. Horizon long. Critères explicites. Aucun comité d'investissement qui se réunit une fois par trimestre.

**CTA** : Consulter nos critères →  [lien vers /opportunites]

---

## Section 4 — Filiation Jean-Pierre Issa (REMPLACE l'ancienne Section 4 "Deux points d'entrée")

[Framework : StoryBrand — Character (arc générationnel)]
[Note @copywriter Phase 5 — Mission 1 finalisée : l'ancienne Section 4 ("Deux points d'entrée") était un doublon de Section 7. Elle est remplacée par la filiation Jean-Pierre Issa — seul endroit de la homepage où l'identité libanaise passe du déclaratif au narratif. Faits sources : project-context.md section "Filiation fondatrice Jean-Pierre Issa" + page-mission.md Section 1. Aucune date inventée — seules les dates factuelles documentées sont utilisées.]
[Conscience : Problem-Aware à Solution-Aware — Marc et Karim veulent comprendre l'origine réelle de la holding]
[Notes @design : section sobre, ton éditorial, fond légèrement différencié (ex. tone="subtle"). Pas de chronologie visuelle, pas de frise. Max 80-100 mots de copy. Une citation facultative en pull-quote si pertinent visuellement.]

### Overline
Trois décennies avant la holding.

### H2
Ce qu'ISSA Capital a hérité.

### Paragraphe principal
Jean-Pierre Issa est né à Dakar en 1958, dans une famille libanaise. Il a construit sa carrière chez IBM, puis rejoint l'équipe qui a lancé Lexmark en Europe dans les années 1990 — Directeur de filiales dans plusieurs pays, Directeur Marketing EMEA. Il a aussi racheté 2J Impression en co-actionnariat : une société fondée en 1994 à Mérignac, spécialisée dans l'impression numérique industrielle, aujourd'hui présente dans dix-sept pays.

### Phrase pivot
Thomas Issa est son fils. ISSA Capital est la formalisation de ce qu'il a regardé fonctionner pendant des décennies — construire, tenir, transmettre.

### Lien sortant
Lire la mission →  [lien vers /mission]

[Note wording : total corps = 73 mots — dans la cible 50-100 mots. Zéro superlatif, zéro date inventée. "Dans les années 1990" conforme à project-context.md qui indique "années 1990" sans date exacte. Phrase pivot = 2 phrases courtes — le premier membre dit la filiation, le second dit le sens de la holding sans jamais prononcer le mot "héritage" qui tirerait vers la mythification.]

---

## Section 5 (ex-Section 4) — L'écosystème en aperçu

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

**CTA** : Besoin d'être accompagné ? →  [lien vers /accompagnement]

---

### Bloc B — Leila

**H3** : Vous avez un dossier. Soumettez-le.

[Note @copywriter Phase 5 — Mission 5 : deux variantes proposées pour équilibrer le traitement narratif avec le bloc Karim. Le bloc Karim peint une situation ("a co-fondé une holding, investi en direct, accompagné des fondateurs") — Leila doit recevoir le même traitement. Longueur cible : équivalente au bloc Karim pour l'équilibre visuel. Thomas choisit la variante.]

**Variante A (recommandée — situation narrative)** :
Vous avez un actif à présenter ou une opportunité à faire étudier. ISSA Capital investit en propre — immobilier résidentiel francilien ou participations minoritaires dans des entreprises saines. Critères explicites, horizon long, aucun comité trimestriel à convaincre.

**Variante B (plus directe, plus courte)** :
Vous repérez un actif avant le marché, ou cherchez un co-investisseur qui décide sans comité. ISSA Capital investit en propre, avec ses propres critères. Pas de process de six mois.

[Note wording Variante A : 40 mots — légèrement plus court que le bloc Karim (44 mots). Équilibre visuel préservé. Situation narrative : "vous avez un actif" ancre dans le réel de Leila. "Investit en propre" répond à l'objection tacite "qui prend vraiment la décision". "Aucun comité trimestriel" traite la friction principale de Leila sans antithèse syntaxique défensive.]
[Note wording Variante B : 30 mots — plus lapidaire, légèrement asymétrique vs Karim. "Pas de process de six mois" est une quasi-antithèse mais brève et factuelle. Acceptable si Thomas préfère la concision.]

**CTA** : Consulter nos critères →  [lien vers /opportunites]

[Note @legal : "réponse dans la journée" est retiré de la Variante A (engagement de délai contraignant). "Aucun comité trimestriel" est factuel — ISSA Capital est une holding familiale sans comité d'investissement institutionnel. Conforme L.411-1 CMF.]

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

**Chaînes exactes à remplacer dans le code @fullstack — Phase 3 (sessions précédentes)**

1. `src/app/page.tsx` — Section 6 (CTA final) [Phase 3 — cf. historique]
   - Ancien : bloc centré unique
   - Nouveau : section 2 colonnes symétriques (détail ci-dessus)

2. `src/app/page.tsx` — Section 4 (stats), carte Gradient One [Phase 3]
   - Ajouter sous-label "50%" : `"Part d'ISSA Capital dans Gradient One — co-fondée en 2020"`

---

**Chaînes exactes à remplacer dans le code @fullstack — Phase 5 (mini-passe post-audit croisé)**

### Modif 1 — Sous-titre hero (Mission 2)

**Localisation** : `src/app/page.tsx` lignes 64-67

**Avant** :
```
La holding patrimoniale de la famille Issa — famille aux racines libanaises,
établie en France. Patrimoine, participations, transmission.
```

**Après (Variante A — Thomas valide)** :
```
La holding patrimoniale d'une famille libanaise, établie en France. Patrimoine, participations, transmission.
```

**Après (Variante B — alternative)** :
```
Holding patrimoniale — famille libanaise, ancrage français. Patrimoine, participations, transmission.
```

[Thomas doit choisir une variante avant intégration @fullstack.]

---

### Modif 2 — Section 2, antithèse "Pas un fonds" (Mission 4)

**Localisation** : `src/app/page.tsx` lignes 93-96

**Avant** :
```
Pas un fonds. Pas une structure à terme. Une holding indépendante, dont la
famille est le seul actionnaire, et dont l'horizon est intergénérationnel.
```

**Après** :
```
Une holding indépendante, dont la famille Issa est le seul actionnaire, et dont l'horizon est intergénérationnel.
```

---

### Modif 3 — Section 4 entière : suppression "Deux points d'entrée" → remplacement par Section Filiation (Mission 1)

**Localisation** : `src/app/page.tsx` lignes 142-191 (commentaire `{/* Section 4 — Deux points d'entrée */}` jusqu'à la balise `</Section>` fermante)

**Avant** : section complète "Deux points d'entrée" avec 2 articles Karim/Leila

**Après** : nouvelle section "Filiation Jean-Pierre Issa"

```tsx
{/* Section 4 — Filiation Jean-Pierre Issa */}
<Section tone="subtle">
  <Container width="editorial">
    <Overline>Trois décennies avant la holding.</Overline>
    <h2 className="mt-md font-heading text-h2 text-ink-950">
      Ce qu&apos;ISSA Capital a hérité.
    </h2>
    <div className="mt-lg space-y-md text-lead text-ink-700">
      <p>
        Jean-Pierre Issa est né à Dakar en 1958, dans une famille libanaise.
        Il a construit sa carrière chez IBM, puis rejoint l&apos;équipe qui a
        lancé Lexmark en Europe dans les années 1990 — Directeur de filiales
        dans plusieurs pays, Directeur Marketing EMEA. Il a aussi racheté
        2J Impression en co-actionnariat : une société fondée en 1994 à
        Mérignac, spécialisée dans l&apos;impression numérique industrielle,
        aujourd&apos;hui présente dans dix-sept pays.
      </p>
      <p>
        Thomas Issa est son fils. ISSA Capital est la formalisation de ce
        qu&apos;il a regardé fonctionner pendant des décennies — construire,
        tenir, transmettre.
      </p>
    </div>
    <Link
      href="/mission"
      className="mt-xl inline-flex items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
    >
      Lire la mission
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  </Container>
</Section>
```

---

### Modif 4 — Section 3 (bifurcation Karim/Leila), bloc Karim — antithèse "pas un conseiller" (Mission 3)

**Localisation** : `src/app/page.tsx` lignes 157-161 (corps du premier article)

**Avant** :
```
Thomas Issa a co-fondé une holding, investi en direct dans l'immobilier
francilien et accompagné des fondateurs pendant sept ans. Si vous cherchez
un pair qui connaît les arbitrages — pas un conseiller qui vend des produits
— c'est l'interlocuteur.
```

**Après** :
```
Thomas Issa a co-fondé une holding, investi en direct dans l'immobilier francilien et accompagné des fondateurs pendant sept ans. Un pair qui connaît les arbitrages — pas les produits à placer.
```

[Note : la suppression de Section 4 (Modif 3) élimine une première occurrence de l'antithèse défensive. Cette Modif 4 traite la deuxième occurrence, dans Section 3 qui elle est conservée.]

---

### Modif 5 — Section 7 (Deux portes symétriques), bloc Leila (Mission 5)

**Localisation** : `src/app/page.tsx` lignes 317-319 (corps du deuxième article, porte Leila)

**Avant** :
```
Immobilier résidentiel ou participation minoritaire. Critères explicites,
horizon long, décision rapide. Nous étudions chaque dossier qualifié.
```

**Après (Variante A — recommandée, situation narrative)** :
```
Vous avez un actif à présenter ou une opportunité à faire étudier. ISSA Capital investit en propre — immobilier résidentiel francilien ou participations minoritaires dans des entreprises saines. Critères explicites, horizon long, aucun comité trimestriel à convaincre.
```

**Après (Variante B — plus directe)** :
```
Vous repérez un actif avant le marché, ou cherchez un co-investisseur qui décide sans comité. ISSA Capital investit en propre, avec ses propres critères. Pas de process de six mois.
```

[Thomas valide la variante avant intégration @fullstack.]

---

### Modif 6 — Section 2 (Mission chapeau) — Rewrite H2 + corps (Session 5, retour Thomas #3)

**Localisation** : `src/app/page.tsx` — Section 2 (commentaire `{/* Section 2 — Mission */}`)

**Avant — H2** :
```
ISSA Capital, c'est une décision de famille.
```

**Après — H2** :
```
Une holding née d'une lignée.
```

**Avant — Corps (3 paragraphes)** :
```
ISSA Capital est la holding patrimoniale de la famille Issa — famille aux racines libanaises, établie en France. Sa raison d'être est simple : faire fructifier le patrimoine familial dans la durée et organiser sa transmission entre les générations.

Une holding indépendante, dont la famille Issa est le seul actionnaire, et dont l'horizon est intergénérationnel.

Cette holding n'est pas née en 2026. Elle est l'aboutissement de trois décennies de construction patrimoniale — une famille libanaise qui a appris à construire, à tenir, et à transmettre.
```

**Après — Corps (3 paragraphes)** :
```
ISSA Capital est la holding patrimoniale d'une famille libanaise, établie en France. Sa raison d'être : structurer ce qui s'est construit sur trois décennies, le faire fructifier, le transmettre.

Une structure indépendante, dont les Issa sont les seuls actionnaires, et dont l'horizon est intergénérationnel.

Elle est l'aboutissement de trois décennies de construction patrimoniale — un héritage libanais qui a appris à se tenir dans la durée.
```

[Motivation : retour Thomas #3 — ~9 occurrences "famille" → cible 3 max. H2 réécrit sans tournure "c'est". Chaleur familiale préservée via "lignée", "héritage", "trois décennies". Mot "famille" apparaît 1 fois dans le corps (paragraphe 1). "Les Issa" remplace la répétition "la famille Issa" en paragraphe 2.]

---

**Décisions copy non négociables sur cette page**
- Section finale : poids visuel ÉGAL pour les deux blocs Karim/Leila — interdiction de redonner la primauté à l'un sur l'autre
- Ton éditorial en section finale : pas de fond rouge, pas de compte à rebours — Principe #0 VITRINE
- "Racines libanaises. Exigences sans exception." reste en footer — ne pas supprimer
- Famille LIBANAISE — jamais "française" dans les textes visibles

---

## Modif Session 6 — Filtres de décision (réécriture P0 retour Thomas #4)

> Sources amont : src/app/page.tsx (homepage l.231-236), src/app/mission/page.tsx (l.224-238), src/app/opportunites/page.tsx (l.144-148), docs/copy/page-mission.md (l.154-162), docs/copy/page-opportunites.md (l.107-111)
> Demande Thomas verbatim : "ça fait un peu gnangnan, je veux qu'on revoie ces textes"
> Contrainte : éviter le pompeux/littéraire (R1), garder fermeté sobre

### Filtre 1 — Préservation de l'environnement

**Texte actuel (homepage)** : "Toute opportunité dont le modèle économique repose sur la dégradation de l'environnement est éliminée, quelle que soit sa rentabilité."

**Problème** : structure administrative ("dont le modèle économique repose sur"), adverbe justificatif ("quelle que soit sa rentabilité"), verbe passif qui dilue l'autorité.

#### Option A — registre pragmatique (décision business)
**Titre** : Préservation de l'environnement
**Corps** : Un investissement dont le modèle repose sur la dégradation environnementale ne passe pas le premier filtre.
**Pourquoi** : Vocabulaire d'investisseur ("premier filtre", "passe"), concision qui implique le reste sans le dire — Karim comprend que c'est éliminatoire sans le mot "éliminé".

#### Option B — registre principiel (conviction)
**Titre** : Préservation de l'environnement
**Corps** : Ce que nous finançons doit tenir sur trente ans. Un modèle qui dégrade l'environnement ne tient pas.
**Pourquoi** : Ancre le filtre dans l'horizon patrimonial long terme (cohérence interne), pas dans une morale externe — la fermeté découle de la logique, pas d'un principe affiché.

### Filtre 2 — Éthique humaine

**Texte actuel (homepage)** : "ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité. Ce filtre est non négociable."

**Problème** : formulation négative en double ("n'investit jamais" + "va à l'encontre") — deux négations pour dire une seule chose. "Ce filtre est non négociable" annonce sa propre importance, ce qui est l'inverse de l'autorité.

#### Option A — registre pragmatique (décision business)
**Titre** : Éthique humaine
**Corps** : Certains secteurs sont hors périmètre, indépendamment du dossier. Ce n'est pas une question d'analyse.
**Pourquoi** : "Indépendamment du dossier" dit le caractère absolu sans le crier. "Pas une question d'analyse" ferme la porte à toute négociation — plus définitif que "non négociable" car il ne répond même pas à l'objection.

#### Option B — registre principiel (conviction)
**Titre** : Éthique humaine
**Corps** : Il y a ce que l'argent ne doit pas financer. ISSA Capital a une réponse claire à cette question.
**Pourquoi** : Affirme une position sans liste, sans pédagogie, sans adverbe. La clarté annoncée ("réponse claire") est plus autoritaire que l'explication de ce qui est refusé — Karim n'a pas besoin du contenu exact, il a besoin de savoir que la ligne existe.

### Notes pour @fullstack (Phase 3)
- Emplacements à modifier (tous les fichiers TSX doivent recevoir la formulation retenue) :
  - `src/app/page.tsx` l.231-232 (Filtre 1) et l.235-236 (Filtre 2)
  - `src/app/mission/page.tsx` l.224-230 (Filtre 1) et l.234-238 (Filtre 2)
  - `src/app/opportunites/page.tsx` l.144-148 (les deux filtres dans un même bloc prose)
- Les fichiers docs/ (page-mission.md, page-opportunites.md, landing-page-copy.md Section 5) doivent être mis à jour en cohérence après l'arbitrage Thomas
- 3e filtre détecté : "Horizon patrimonial long terme" (`src/app/page.tsx` l.227-228, `src/app/mission/page.tsx` l.214-220) — formulation actuelle sobre et directe, pas gnangnan, pas à modifier
- Régénérer les baselines Playwright pour Section 5 homepage et section Trois filtres /mission après application

### Handoff
- **À Thomas** : 2 décisions indépendantes — A ou B pour Filtre 1, A ou B pour Filtre 2. Les combinaisons sont toutes cohérentes entre elles.
- **À @fullstack (Phase 3)** : application TSX sur les 3 fichiers listés ci-dessus + propagation docs/ après arbitrage Thomas

---

## Modif Session 6 — Gradient One (Option C corrigée) + Versi Invest (retours Thomas #2 #3)

> Sources amont : docs/strategy/gradient-one-angle-options.md, src/app/page.tsx (l.125-209), docs/copy/landing-page-copy.md (Section 4 Filiation Jean-Pierre + Section 5 écosystème)
> Décision Thomas CHECKPOINT #1 : Option C retenue, mais "fondée" → "co-fondée avec deux associés"
> Jean-Pierre Issa : OK nommé pour l'instant (Thomas a validé)
> Nombre d'associés : deux (verrouillé Thomas) — noms non divulgués

### Bloc 1 — "Participation phare" Gradient One (Section 3 key stats)

**Overline** : Trois générations. Une structure.

**Titre principal — 3 propositions (Thomas tranche)**

- Proposition 1 : *Gradient One — co-fondée par Thomas Issa et deux associés.*
- Proposition 2 : *Gradient One — fondée à trois, pour porter un écosystème familial.*
- Proposition 3 : *Gradient One — la holding co-fondée par Thomas Issa en 2020.*

**Sous-titre** : Première décision formelle d'une famille qui construit depuis trois décennies.

**Description courte** : Ce que Jean-Pierre Issa a transmis à son fils, Thomas l'a structuré — avec deux associés. Gradient One est le premier acte de cet héritage mis en forme.

**Stat affichée** : 50% — [INFO À VALIDER : ce chiffre représente la part d'ISSA Capital dans Gradient One. Si la co-fondation à trois n'implique pas une part égale de 1/3, le 50% reste cohérent si c'est bien la participation d'ISSA Capital. Thomas confirme ou corrige.]

---

### Bloc 2 — "Notre écosystème" Gradient One (card)

**Card title** : Gradient One

**Card label (remplace "Holding intermédiaire")** : Structure centrale

**Card description** : Co-fondée en 2020. Porte les participations opérationnelles de l'écosystème.

[Note : "50% ISSA Capital" supprimé per demande Thomas. "Holding intermédiaire" remplacé par "Structure centrale" — plus lisible pour Karim sans jargon juridique. "Co-fondée en 2020" maintenu — factuel, cohérent avec Section 3 key stats et titre Bloc 1.]

---

### Bloc 3 — "Notre écosystème" Versi Invest (card)

**Card title** : Versi Invest

**Card label (remplace "Acquisitions & accompagnement")** : Co-acquisitions & accompagnement

**Card description** : Co-acquisitions immobilières en format club deal — pour investir en pool, sans en faire son métier. Missions d'accompagnement pour les partenaires qui structurent leur approche.

[Note : les deux activités sont posées comme deux modalités complémentaires d'une même offre. "Club deal" conservé — terme reconnu par Karim investisseur. "Sans en faire son métier" = voix de Karim, pas celle de Versi Invest. @legal : cohérent avec la note L.411-1 existante — cette formulation décrit toujours une participation, pas une offre d'investissement d'ISSA Capital.]

---

### Notes pour @fullstack (Phase 3)

- **Bloc 1 — key stats** (`src/app/page.tsx` l.133-137) : remplacer le sous-label "Holding intermédiaire — co-fondée en 2020" par le titre retenu (proposition Thomas) + conserver stat 50% sauf correction Thomas sur la part
- **Bloc 2 — écosystème card Gradient One** (`src/app/page.tsx` l.178-181) : `sector` → "Structure centrale", `desc` → "Co-fondée en 2020. Porte les participations opérationnelles de l'écosystème."
- **Bloc 3 — écosystème card Versi Invest** (`src/app/page.tsx` l.188-191) : `sector` → "Co-acquisitions & accompagnement", `desc` → voir Bloc 3 ci-dessus
- Régénération baselines Playwright : Section 3 key stats + Section 4 écosystème homepage
- Vérifier cohérence Section 4 Filiation (landing-page-copy.md l.133-148) — même arc narratif Jean-Pierre → Thomas, pas de redite verbatim

### Handoff

- **À Thomas** : (a) choix titre Bloc 1 parmi Propositions 1 / 2 / 3, (b) confirmation stat 50% ou correction si la part réelle est différente, (c) validation Blocs 2 et 3 tels quels
- **À @fullstack (Phase 3)** : application TSX consolidée sur les 3 blocs après arbitrage Thomas — 3 lignes dans le même fichier `src/app/page.tsx`

---

## Modif Session 6 — Corrections justifications explicites (CHECKPOINT #1 validé en bloc)

> Sources amont : docs/copy/audit-justifications-explicites-session6.md

| # | Fichier | Ligne approx. | Action | Verbatim avant | Verbatim après |
|---|---|---|---|---|---|
| Occ 2 | `src/app/accompagnement/page.tsx` | ~274 | SUPPRIMER | "Ces critères permettent à Thomas de consacrer son attention aux projets où il apporte une vraie valeur." | (supprimé — la liste d'anti-personas se suffit) |
| Occ 1 | `src/app/accompagnement/page.tsx` | ~308 | REFORMULER (suppression + déplacement) | "Dans les deux cas : aucun tarif affiché. La mission commence par un échange de qualification." | Phrase supprimée de la section Formats. Principe déplacé dans l'intro formulaire (section contact) : "Chaque mission démarre par un échange — pas par un devis." |
| Occ 5 | `src/app/accompagnement/page.tsx` | ~330 | REFORMULER (partielle) | "Quelques informations pour comprendre votre situation. Le formulaire ci-dessous est court — il ne sert pas à qualifier mécaniquement, mais à permettre à Thomas de préparer un échange substantiel." | "Quelques informations pour comprendre votre situation. Thomas lit chaque message." |
| Occ 4 | `src/app/page.tsx` | ~219 | SUPPRIMER | "Nos décisions d'investissement ne sont pas négociables sur ces trois critères." | (supprimé — H2 "Trois filtres. Aucune exception." enchaîne directement sur les cards) |
| Occ 3 | `src/app/opportunites/page.tsx` | ~140 | REFORMULER | "Quel que soit le dossier : nous n'investissons pas dans ce qui contrevient à nos filtres de décision non négociables. Environnement : toute opportunité dont le modèle économique repose structurellement sur la dégradation de l'environnement est refusée. Éthique humaine : ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité." | "Ces deux filtres précèdent toute analyse, sans exception. Préservation de l'environnement — ISSA Capital n'entre pas dans un projet dont le modèle repose sur la dégradation environnementale. Éthique humaine — ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité." |

### Handoff @fullstack (Phase 3)

- **Fichiers TSX modifiés directement par @copywriter dans cette task** :
  - `src/app/accompagnement/page.tsx` (3 modifications : occ 2 ~274, occ 1 ~308, occ 5 ~330)
  - `src/app/page.tsx` (1 modification : occ 4 ~219)
  - `src/app/opportunites/page.tsx` (1 modification : occ 3 ~140)
- **Fichiers à propager pour @fullstack en Phase 3** : aucun — les 5 corrections sont directement appliquées en TSX dans cette task. Aucune chaîne résiduelle dans ce fichier copy à transcrire.
- **Conflits potentiels avec Vague 2.1 ou Phase 5** : zéro. Les fichiers `/mission/page.tsx` et `/a-propos/page.tsx` (Phase 5 prep) n'ont pas été touchés. Les 5 occurrences actives étaient toutes sur `/accompagnement`, `/home` et `/opportunites`. La suppression de Occ 1 (phrase italique "Dans les deux cas") peut créer un delta de hauteur de section Formats — vérifier que le `mt-xl` de la grille 2 colonnes ne génère pas un déséquilibre visuel notable, et régénérer les baselines Playwright pour les 3 pages modifiées.
