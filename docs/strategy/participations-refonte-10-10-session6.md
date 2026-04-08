> Sources amont : src/app/participations/page.tsx, docs/copy/landing-page-copy.md, docs/strategy/brand-platform.md, docs/strategy/personas.md, docs/strategy/participations-restructure.md

# Participations — Refonte 10/10 Session 6 (mode itération)

> Production : @creative-strategy
> Date : 2026-04-08
> Contexte : feedback Thomas — "J'aime pas trop la structure de cette page. Personne ne connaît Gradient One."

---

## 1. Diagnostic de la structure actuelle

### Ce que raconte la page (v1 consolidée session 5)

La page comporte 3 sections principales :

1. **Hero** — H1 "Un écosystème construit décision après décision." + intro 2 §§ (thèse + rôle de page exhaustive)
2. **Section "Détention directe"** — 2 colonnes : Gradient One (bloc large, col-span-7) + Patrimoine immobilier résidentiel (col-span-5)
3. **Section "Au sein de Gradient One"** — 4 cartes : Versi Invest (featured, full-width), Versi Immobilier, Immocrew, Versimo
4. **Section "Cohérence"** — éditoriale + 2 liens de sortie

### Ce qui ne marche pas — 4 problèmes

**Problème 1 — Gradient One prend tout l'espace (et personne ne sait ce que c'est)**
Gradient One occupe col-span-7 sur 12, avec un H3 complet, un sous-titre en italique, 2 paragraphes, et une note. C'est le bloc le plus visible de la page — mais Gradient One n'est pas une marque connue. Karim arrive sur la page sans aucune idée de ce qu'est Gradient One. Il voit d'abord un nom qu'il ne connaît pas, mis en avant comme s'il était évident. Ce n'est pas une erreur de rédaction — c'est une erreur de structure : mettre en avant une entité intermédiaire (juridique, non-opérationnelle) à la place des activités réelles.

**Problème 2 — La structure reflète la hiérarchie juridique, pas la logique de lecture**
La page est organisée selon l'organigramme de détention (ISSA Capital → Gradient One → filiales). C'est logique pour un juriste. Ce n'est pas logique pour Karim. Karim ne cherche pas l'arbre actionnarial — il cherche à comprendre dans quoi ISSA Capital investit concrètement. La distinction "détention directe / au sein de Gradient One" n'a aucun sens pour lui.

**Problème 3 — Versi Invest en "featured" sans justification apparente**
Le traitement `border-2 border-levant-500 col-span-2` donne à Versi Invest une emphase visuellement disproportionnée. Un visiteur se demande : pourquoi cette entité est-elle plus importante ? Sans badge explicatif (retiré en session 6), la mise en avant devient arbitraire.

**Problème 4 — 5 entités nommées dans la section "Cohérence", après 2 sections distinctes**
La section éditoriale cite "Gradient One, Versi, Immocrew, Versimo et le patrimoine direct" — ce qui force le lecteur à faire le bilan lui-même d'un écosystème qu'il vient de parcourir en 2 sous-sections différentes. La page n'a jamais posé une vue d'ensemble simple.

### Ce que Karim cherche sur cette page

Karim veut répondre à 3 questions en moins de 60 secondes :
1. **Dans quoi ISSA Capital investit-il ?** (secteurs concrets)
2. **Quelle est la logique d'ensemble ?** (cohérence vs opportunisme)
3. **Thomas a-t-il vraiment construit quelque chose — ou est-ce une coquille ?** (crédibilité)

### Ce qu'il ne trouve pas

- Une vue d'ensemble des secteurs/activités avant de plonger dans les entités
- Une réponse claire à "dans quoi ISSA investit" formulée en activités, pas en noms d'entités
- La preuve que l'écosystème est cohérent (il doit lire la section éditoriale pour comprendre le fil rouge)

---

## 2. Thèse stratégique

La page /participations doit raconter une chose à Karim : **ISSA Capital a construit un écosystème immobilier cohérent depuis 2020 — en direct et via des participations — avec une logique de durée, pas d'accumulation.**

Cette page ne liste pas des actifs. Elle pose une thèse d'investissement incarnée par des entités concrètes.

**Principe de structuration retenu** : partir des activités (ce qu'on fait), non des entités (qui on est juridiquement). Les entités sont citées dans chaque domaine, mais ne sont jamais les titres de section.

**Gradient One** doit descendre d'un cran : ce n'est pas une entité opérationnelle, c'est un véhicule de détention. Elle est mentionnée comme contexte ("via Gradient One") mais ne structure plus la page.

**Périmètre des entités** : Gradient One, Versi Invest, Versi Immobilier, Immocrew, Versimo, Patrimoine immobilier résidentiel (IDF).

---

## 3. Variante A — Par domaine d'activité

### Architecture (hero + 4 sections)

| Section | Titre H2 | Contenu |
|---|---|---|
| Hero | "Un écosystème immobilier construit depuis 2020." | H1 + intro 3 lignes + note Gradient One (2 lignes discrètes) |
| S1 | "Immobilier en direct." | Patrimoine résidentiel IDF + Versi Immobilier |
| S2 | "Accompagnement et co-investissement." | Versi Invest + Immocrew |
| S3 | "Technologie au service de l'immobilier." | Versimo |
| S4 | "Une thèse, pas un portefeuille." | Éditoriale + liens de sortie |

### Verbatim complet — Variante A (v2 finale)

**HERO**

Overline : Notre écosystème

H1 : Un écosystème immobilier construit depuis 2020.

Intro : ISSA Capital investit dans l'immobilier — en direct et via des participations — depuis 2020. Cet écosystème n'est pas le résultat d'opportunités saisies au fil du temps : il reflète une conviction familiale ancrée dans l'immobilier depuis trois décennies.

Note contextuelle (typographie petite, ton neutre) : Gradient One est la holding intermédiaire co-fondée par ISSA Capital en 2020. Elle détient les participations opérationnelles de l'écosystème. Les actifs immobiliers résidentiels sont détenus directement par ISSA Capital.

Ligne statut : Cette page présente la cartographie complète des participations et actifs d'ISSA Capital.

---

**SECTION 1 — Immobilier en direct.**

Overline : Actifs détenus

H2 : Immobilier en direct.

Intro : ISSA Capital détient des actifs immobiliers résidentiels — en propre et via Versi Immobilier.

Bloc A — Patrimoine immobilier résidentiel
Île-de-France — détention directe ISSA Capital
Actifs résidentiels détenus et gérés en direct. Constitution patrimoniale, revenus locatifs, gestion directe.
Horizon long terme — les actifs sont détenus dans la durée.

Bloc B — Versi Immobilier
Marchand de biens — marché secondaire résidentiel.
Rôle : actionnaire co-gérant — depuis 2025

---

**SECTION 2 — Accompagnement et co-investissement.**

Overline : Services aux professionnels

H2 : Accompagnement et co-investissement.

Intro : Deux entités de l'écosystème accompagnent les professionnels et investisseurs de l'immobilier.

Bloc A — Versi Invest
Acquisitions immobilières et accompagnement de partenaires. Pour ceux qui veulent investir dans l'immobilier sans en faire leur métier principal.
Rôle : co-gérant — depuis 2026

Bloc B — Immocrew
Marketing externalisé pour mandataires immobiliers indépendants. "Tu publies, on fait le reste."
Rôle : actionnaire — immocrew.fr

---

**SECTION 3 — Technologie au service de l'immobilier.**

Overline : Innovation

H2 : Technologie au service de l'immobilier.

Intro : Une participation de l'écosystème développe des outils numériques pour les professionnels du secteur.

Bloc — Versimo
Home staging virtuel par IA. Une pièce meublée en 90 secondes.
Rôle : actionnaire — versimo.fr

---

**SECTION 4 — Une thèse, pas un portefeuille.**

Overline : Cohérence

H2 : Une thèse, pas un portefeuille.

L'immobilier et la technologie au service de l'immobilier ne sont pas le résultat d'une stratégie construite sur PowerPoint. Ils reflètent un héritage familial — Sonia Issa, architecte d'intérieur, mère de Thomas — et une conviction : l'habitat est un secteur de durée, pas de spéculation.

Chaque entité de l'écosystème sert un maillon de la même chaîne : acquérir, valoriser, gérer, transmettre.

Liens de sortie :
- Proposer une opportunité → /opportunites
- Besoin d'être accompagné ? → /accompagnement

---

### Disposition des entités dans Variante A

| Entité | Section | Position | Gradient One visible ? |
|---|---|---|---|
| Gradient One | Hero (note contextuelle) | 2 lignes discrètes | Oui — défini une fois |
| Patrimoine immobilier IDF | S1 | Bloc principal | Non |
| Versi Immobilier | S1 | Bloc secondaire | Non (implicite) |
| Versi Invest | S2 | Bloc principal | Non (implicite) |
| Immocrew | S2 | Bloc secondaire | Non (implicite) |
| Versimo | S3 | Bloc unique | Non (implicite) |

### Rationale

Gradient One disparaît comme structure de page. Elle est définie une seule fois, discrètement, dans le hero — 2 lignes qui expliquent son rôle sans le mettre en avant. Karim lit les activités (immobilier, accompagnement, tech) avant de lire les noms d'entités. L'ordre va du plus concret (actifs détenus) au plus spécialisé (tech). Logique sectorielle, compréhensible sans aucune connaissance de l'organigramme.

### Auto-évaluation — Variante A (v2)

| # | Dimension | Score | Justification |
|---|---|---|---|
| 1 | Gradient One non sur-mis en avant | 10/10 | 2 lignes en note de hero — jamais titre de section |
| 2 | Clarté pour Karim (30 sec.) | 10/10 | H2 sectoriels lisibles sans connaissance préalable |
| 3 | Hiérarchie visible | 9/10 | Immo > Accompagnement > Tech — du plus tangible au plus spécialisé |
| 4 | Voix de marque | 9/10 | Sobre, factuel, phrases courtes, zéro slogan |
| 5 | Simplicité > Démonstration (P0) | 10/10 | Aucun effet de manche |
| 6 | Cohérence homepage | 9/10 | Page exhaustive vs teaser — cohérent, pas redondant |
| 7 | VITRINE non-conversion | 10/10 | Zéro CTA agressif |
| 8 | Crédibilité | 9/10 | Contexte Gradient One posé proprement |
| 9 | Différenciation entre entités | 10/10 | 5 entités, 5 activités distinctes |
| 10 | Pas de justification explicite | 10/10 | Aucune phrase méta |

**Score final Variante A : 9.6/10**
