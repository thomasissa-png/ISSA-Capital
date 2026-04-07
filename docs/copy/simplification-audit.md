# Audit de simplification — ISSA Capital
> @copywriter — 2026-04-07
> Commande Thomas : "Simple, j'insiste, ça fait plusieurs fois que je le dis."
> Règle appliquée : Simple > Élégant > Démonstratif. Dire > Positionner.

---

## Homepage (src/app/page.tsx + landing-page-copy.md)

| Passage | Problème | Action |
|---|---|---|
| H1 "On décide. Pas un calendrier de fonds." | Antithèse défensive — posture qui se définit par opposition, pas par affirmation | Remplacer par la baseline canonique verrouillée : "Racines libanaises. Exigences sans exception." |
| H2 Section 7 "Deux portes. Une même exigence." | Aphorisme composite sans valeur ajoutée — "une même exigence" ne dit rien de spécifique | Remplacer par un titre descriptif direct |
| Sous-titre hero "La holding patrimoniale d'une famille aux racines libanaises qui investit pour les générations à venir, dans des projets qu'elle peut transmettre fièrement." | Trop long, "fièrement" est un adverbe de modulation émotionnelle | Raccourcir |

## Page Mission (src/app/mission/page.tsx + page-mission.md)

| Passage | Problème | Action |
|---|---|---|
| H2 "Une holding naît d'un refus." + paragraphe "Pas à un fonds... Pas à des véhicules... Pas à des structures..." | Anaphore défensive en cascade — 3 phrases commençant par "Pas à". Sur-construit. | Reformuler en affirmation simple |
| Section "L'identité" — paragraphe "L'héritage libanais apporte quelque chose que beaucoup de holdings françaises n'ont pas : une conception du patrimoine transmise..." | Démonstratif — explique pourquoi l'héritage libanais est valable comme s'il fallait le justifier | Simplifier : dire ce qu'on est, pas démontrer sa valeur |
| Section "Ce que nous refusons d'être" — "Elle n'est pas un fonds... Elle n'est pas une structure... Elle n'est pas opportuniste... Elle n'est pas généraliste... Elle n'est pas une famille française..." | 5 antithèses consécutives — le registre "ce que nous ne sommes pas" peuple tout le site. Ici c'est une liste, c'est trop. | Réduire à 2 lignes sobres |

## Page Accompagnement (src/app/accompagnement/page.tsx + page-accompagnement.md)

| Passage | Problème | Action |
|---|---|---|
| H1 "Thomas Issa accompagne les décideurs qui cherchent un pair — pas un prestataire." | Construction longue avec antithèse finale. Le "pas un prestataire" est défensif. | Simplifier le H1 |
| Overline "Ce que Thomas fait" + H2 "Ce que Thomas fait — et ce qu'il ne fait pas." | Doublon exact. L'overline reprend le H2 mot pour mot. | Supprimer le doublon dans l'overline ou reformuler le H2 |
| H2 "Sept domaines, déduits de son parcours réel." + intro "Pas une offre construite pour le marché." | "Déduits de son parcours réel" et "Pas une offre construite pour le marché" = deux façons de dire la même chose. Redondant. | Garder l'un, supprimer l'autre |
| H2 "Deux formats. Pas de troisième option." | "Pas de troisième option" est une antithèse inutile — le lecteur ne cherchait pas une troisième option | Supprimer la partie après le point |

## Page Participations (src/app/participations/page.tsx + page-participations.md)

| Passage | Problème | Action |
|---|---|---|
| "L'immobilier et la technologie au service de l'immobilier ne sont pas le résultat d'une stratégie construite sur PowerPoint." | Positionnement anti-corporate. Clin d'oeil acceptable mais légèrement démonstratif. | Conserver — la formulation est brève et directe, acceptable |

**Verdict participations** : page déjà sobre. Pas de modification nécessaire.

## Page Opportunités (src/app/opportunites/page.tsx + page-opportunites.md)

**Verdict** : page la plus sobre du site. Fonctionnelle par nature (critères, formulaire). Aucune modification nécessaire.

---

## Ce qu'on garde — ce qu'on coupe — ce qu'on reformule

### GARDE (décisions verrouillées)
- Baseline "Racines libanaises. Exigences sans exception." — hero ET footer homepage
- Signature "Patient par choix. Exigeant par principe." — page Accompagnement
- Arc narratif Jean-Pierre → Thomas — page Mission
- H1 Mission "Famille libanaise. / Horizons intergénérationnels." — bon, factuel
- Section 3 (deux points d'entrée homepage) — bon équilibre
- Filtres éthiques — formulations déjà directes

### COUPE
- "Pas un calendrier de fonds." (H1 hero — remplacé par baseline canonique)
- "Deux portes. Une même exigence." (H2 section 7 homepage)
- Les 3 anaphores "Pas à un fonds... Pas à des véhicules... Pas à des structures..." (section Mission)
- La liste "Elle n'est pas un fonds... Elle n'est pas généraliste..." (section Mission — remplacée par 2 lignes)
- "Pas un prestataire" dans le H1 accompagnement
- "Pas une offre construite pour le marché" (intro domaines accompagnement — redondant)
- "Pas de troisième option" (H2 formats accompagnement)
- Doublon overline/H2 "Ce que Thomas fait" (accompagnement)

### REFORMULE
- Sous-titre hero homepage : raccourcir
- Paragraphe "L'héritage libanais apporte..." : simplifier, ne pas justifier
- Intro section "Deux formats" (accompagnement) : directe sans posture

---

## Recommandation globale

Le site a un très bon fond — l'arc narratif Jean-Pierre/Thomas, les filtres éthiques, les participations factuelles. Le problème est en surface : trop d'antithèses défensives ("pas X, pas Y"), trop de phrases qui cherchent à démontrer la posture au lieu de la tenir. La cure est chirurgicale — moins de 15 phrases à modifier sur l'ensemble du site. L'ossature reste intacte.
