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
