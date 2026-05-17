# Audit TTL project-context.md -- Session 15

> Date : 2026-05-17
> Auteur : orchestrator
> Objectif : ramener le hors-memo+historique a <250 lignes (cap Gradient)
> Statut : PROPOSITION -- Thomas valide AVANT toute edition

---

## 1. Etat actuel -- inventaire par section

| # | Section | Lignes | De-A | Statut propose |
|---|---------|--------|------|----------------|
| 1 | Principe directeur #0 -- VITRINE PAS CONVERSION | 52 | 9-53 | CONDENSER |
| 2 | Identite (SAS, SIREN, etc.) | 12 | 56-68 | GARDER |
| 3 | Identite familiale -- verrouillée | 28 | 72-98 | CONDENSER |
| 4 | Filiation -- Jean-Pierre Issa | 65 | 80-163 | ARCHIVER (gros) |
| 5 | Filiation -- Sonia Issa | 11 | 100-110 | ARCHIVER |
| 6 | Prochaine generation (enfants) | 12 | 112-129 | ARCHIVER |
| 7 | Validations Thomas (nommer JP, etc.) | 6 | 124-129 | ARCHIVER |
| 8 | 2J Impression | 33 | 131-163 | ARCHIVER |
| 9 | Trajectoire internationale famille | 18 | 165-188 | CONDENSER |
| 10 | Ecosysteme de participations | 66 | 191-258 | CONDENSER |
| 11 | Expertise fondateur Thomas | 76 | 262-337 | ARCHIVER (gros) |
| 12 | Clients mentionnables / asset confidentiel | 8 | 334-341 | CONDENSER |
| 13 | Format accompagnement + pricing | 15 | 316-332 | CONDENSER |
| 14 | Anti-persona | 10 | 323-332 | GARDER (compact) |
| 15 | Cible (personas) | 9 | 344-351 | GARDER |
| 16 | Positionnement | 23 | 354-376 | GARDER |
| 17 | ADN dur | 10 | 378-387 | GARDER |
| 18 | Objectifs | 10 | 390-397 | GARDER |
| 19 | Stack technique | 11 | 400-410 | GARDER |
| 20 | Modele economique | 7 | 414-419 | GARDER |
| 21 | Contraintes | 10 | 422-431 | GARDER |
| 22 | Existant | 7 | 434-439 | GARDER |
| 23 | Perimetre V1 | 12 | 443-453 | GARDER |
| 24 | Historique interventions agents | 22 | 456-477 | GARDER (operationnel) |
| 25 | Performance agents | 6 | 480-486 | GARDER |
| 26 | Decisions Phase 0 revisees | 39 | 490-536 | CONDENSER |
| 27 | Memos archives (renvoi) | 3 | 541-543 | GARDER |
| 28 | Memo reprise S15 | 53 | 547-598 | GARDER (memo actif) |
| 29 | Blockers | 6 | 600-605 | GARDER (memo) |
| 30 | Commande reprise | 5 | 607-611 | GARDER (memo) |
| 31 | Corrections factuelles verrouilees S6 | 7 | 615-622 | ARCHIVER |

**Total actuel** : 622 lignes

**Ventilation** :
- Memo + Historique + Performance + Blockers + Commande : ~91 lignes (exclus du cap)
- Hors memo+historique : ~531 lignes
- **Cap : 250 lignes hors memo+historique**
- **Depassement : +281 lignes (~x2.1)**

---

## 2. Diagnostic -- pourquoi c'est si gros

### 2a. Sections biographiques/genealogiques = 195 lignes (~37% du fichier)

Les sections Jean-Pierre (65L), Sonia (11L), enfants (12L), 2J Impression (33L), trajectoire internationale (18L), expertise Thomas (76L) contiennent une richesse de detail indispensable pour @copywriter et @design Phase 1, mais **operationnellement inutile en S15** (Anya/secrétariat). Ces informations sont :
- Verrouillees par Thomas depuis S4-S6
- Deja consommees par tous les agents Phase 0-3 (brand-platform, copy, design)
- Deja presentes dans les livrables produits (`docs/strategy/brand-platform.md`, `docs/copy/landing-page-copy.md`, code TSX deploye)

**Verdict** : archiver dans `docs/project-context-archive.md`, garder un renvoi de 2-3 lignes dans project-context.md.

### 2b. Principe directeur #0 = 52 lignes

La section est detaillee (7 regles par agent + recalibration gates GP + implications pages). C'est utile pour les agents frontend/copy, mais la granularite (regles pour @growth, @seo, recalibration GP7/GP9/GP10) peut etre condensee en 15-20 lignes avec renvoi vers `docs/strategy/brand-platform.md` qui porte deja ces decisions.

### 2c. Decisions Phase 0 revisees = 39 lignes

Tableau d'hypotheses H1-H12 : toutes VALIDEES par Thomas. L'information est deja integree dans les sections respectives (personas, mission, promesse, pages V1, analytics). Le tableau ne sert plus qu'a la tracabilite historique -- archivable.

### 2d. Participations = 66 lignes

Detail des 6 participations + organigramme. Information stable, verrouillée, deja dans `docs/strategy/brand-platform.md` et dans le code deploye. Condensable en ~25 lignes (nom + activite + statut, pas les details URL/pricing/notes copy).

### 2e. Corrections factuelles S6 = 7 lignes

Information ponctuelle (date 2J Impression, ordre chronologique Thomas). Deja propagée dans les livrables et le code. Archivable.

---

## 3. Plan de refonte propose

### Principe : project-context.md = carte d'identite operationnelle

Le fichier doit contenir **ce dont un agent a besoin pour commencer a travailler** :
- Qui est le projet (identite, secteur, stade)
- Pour qui (personas, cibles)
- Quoi (positionnement, mission, promesse, ADN)
- Comment (stack, contraintes, perimetre V1)
- Ou on en est (historique, memo, blockers)

Les details biographiques, genealogiques, et les decisions historiques verrouillees sont des **sources de reference** -- pas des instructions operationnelles. Ils vivent dans l'archive.

### 3a. Sections a ARCHIVER (deplacer vers project-context-archive.md)

| Section | Lignes | Destination archive | Renvoi dans project-context |
|---------|--------|--------------------|-----------------------------|
| Filiation Jean-Pierre (detail bio+2J) | ~98 | Archive section "Filiation fondatrice" | "Detail bio Jean-Pierre/Sonia/2J : voir `docs/project-context-archive.md` section Filiation" |
| Filiation Sonia | ~11 | Idem | Idem |
| Prochaine generation (enfants) | ~12 | Idem | 1 ligne : "3 enfants, beneficiaires transmission. Detail archive." |
| 2J Impression | ~33 | Idem | Idem (deja couvert par JP) |
| Expertise fondateur Thomas (CV complet) | ~76 | Archive section "CV Thomas" | 5 lignes resume : "15+ ans strat/marketing, Sony TEOS (6000% ROI), advisor startups. Detail CV : archive." |
| Tableau hypotheses H1-H12 | ~20 | Archive section "Historique decisions Phase 0" | 1 ligne : "Toutes hypotheses validees Thomas 2026-04-07. Detail : archive." |
| Corrections factuelles S6 | ~7 | Archive section "Corrections factuelles" | Supprimer (deja propagees) |

**Total archive** : ~257 lignes

### 3b. Sections a CONDENSER

| Section | Lignes actuelles | Lignes cibles | Methode |
|---------|-----------------|--------------|---------|
| Principe directeur #0 | 52 | 20 | Garder la citation Thomas + les 3 "DOIT/N'EST PAS" + 1 phrase par agent (pas 3). Supprimer recalibration GP (deja dans brand-platform). |
| Identite familiale | 28 | 10 | Garder la regle "libanaise", les formulations autorisees/interdites. Archiver le detail narratif. |
| Trajectoire internationale | 18 | 5 | 1 paragraphe : exode 70s, diaspora, parcours Thomas international. Detail archive. |
| Ecosysteme participations | 66 | 25 | Format tableau compact : nom / activite / detention / statut. Supprimer notes copy, pricing, details URL. |
| Format accompagnement + pricing + clients | 23 | 8 | 2 formats (ponctuel/advisoring), pricing non affiche, clients mentionnables en 1 ligne. |
| Decisions Phase 0 revisees | 39 | 5 | Archetype Ruler/Outlaw, taglines verrouillees, pricing = non affiche. Le reste deja dans les sections respectives. |

**Total condense** : de ~226 lignes a ~73 lignes (gain ~153 lignes)

### 3c. Sections INCHANGEES

| Section | Lignes |
|---------|--------|
| Identite (SAS) | 12 |
| Cible (personas) | 9 |
| Positionnement | 23 |
| ADN dur | 10 |
| Objectifs | 10 |
| Stack technique | 11 |
| Modele economique | 7 |
| Contraintes | 10 |
| Existant | 7 |
| Perimetre V1 | 12 |
| Anti-persona | 10 |
| **Sous-total** | **121** |

---

## 4. Projection post-audit

### Contenu hors memo+historique

| Categorie | Lignes estimees |
|-----------|----------------|
| Sections inchangees | 121 |
| Principe directeur condense | 20 |
| Identite familiale condensee | 10 |
| Trajectoire condensee | 5 |
| Participations condensees | 25 |
| Accompagnement condense | 8 |
| Expertise Thomas (resume) | 5 |
| Decisions Phase 0 condensees | 5 |
| Renvois archive (1 bloc) | 5 |
| Separateurs/titres | 10 |
| **TOTAL hors memo+historique** | **~214** |

### Memo + Historique + Performance (exclus du cap)

| Section | Lignes |
|---------|--------|
| Historique interventions | 22 |
| Performance agents | 6 |
| Memos archives (renvoi) | 3 |
| Memo S15 | 53 |
| Blockers + commande | 11 |
| **Sous-total** | **~95** |

### Total projete : ~309 lignes (214 hors cap + 95 memo/historique)

**Cap 250L hors memo : 214/250 -- CONFORME (marge 36 lignes)**

---

## 5. Destination des archives

### Fichier cible : `docs/project-context-archive.md`

Ce fichier existe deja (memos S5-S9 archives). Ajouter les nouvelles sections :

```
## Filiation fondatrice (archive depuis S15)
[Section JP complete + Sonia + enfants + 2J Impression + trajectoire internationale]

## CV Thomas Issa (archive depuis S15)
[Expertise fondateur complete : parcours, experiences, formation, distinctions, langues, domaines, clients, asset confidentiel]

## Decisions Phase 0 -- Hypotheses (archive depuis S15)
[Tableau H1-H12 + archetype + taglines ecartees]

## Corrections factuelles S6 (archive depuis S15)
[2J Impression 2016 pas 1994, parcours Thomas chronologique]
```

### Renvoi dans project-context.md (bloc unique)

```markdown
## Archives de reference

Les informations suivantes sont archivees dans `docs/project-context-archive.md` :
- Biographies detaillees : Jean-Pierre, Sonia, 2J Impression, enfants
- CV complet Thomas Issa (parcours, distinctions, formations)
- Tableau hypotheses Phase 0 (H1-H12, toutes validees)
- Corrections factuelles S6
```

---

## 6. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Un agent Phase 1-3 (copy/design/strategy) a besoin du detail bio JP/Thomas | Le renvoi pointe vers l'archive. L'agent lit l'archive si necessaire. Les livrables amont (brand-platform, copy) contiennent deja le detail. |
| Perte de tracabilite des validations Thomas | Les validations restent dans l'archive avec date+contexte. Le project-context condense mentionne "verrouille par Thomas [date]". |
| Formulations autorisees/interdites "famille libanaise" perdues | GARDEES dans project-context (section Identite familiale condensee). C'est une regle operationnelle, pas un detail biographique. |
| Asset confidentiel (agence com) oublie | Mentionne dans la section Expertise condensee ("1 asset confidentiel NDA -- detail archive") + reste dans archive pour declenchement futur. |

---

## 7. Actions proposees (a valider par Thomas)

1. **Deplacer ~257 lignes** vers `docs/project-context-archive.md` (bio, CV, hypotheses, corrections S6)
2. **Condenser ~226 lignes en ~73 lignes** (principe directeur, identite familiale, participations, accompagnement, decisions Phase 0)
3. **Ajouter un bloc "Archives de reference"** de 5 lignes avec renvois
4. **Resultat** : 214 lignes hors memo (cap 250 -- conforme, marge 36L)
5. **Ne PAS toucher** : memo S15, historique, performance, blockers (exclus du cap)

**Question Thomas** : valides-tu cette refonte ? Si oui, j'execute l'archivage + condensation dans le prochain message. Si tu veux garder certaines sections dans le fichier principal, dis-moi lesquelles.

---

**Handoff -> Thomas**
- Fichier produit : `docs/audits/project-context-audit-s15.md`
- Decision requise : validation AVANT edition
- Prochaine etape : si valide, execution de la refonte + Etape 2 (propagation P0/P1 S14)
