---
name: baux
description: "Génère un bail meublé d'habitation (DOCX + PDF) à partir de la fiche d'un locataire ou d'un candidat, conforme à la loi 89-462. À utiliser quand Thomas dit 'génère le bail de X', 'bail pour le nouveau locataire de Y, début le Z', 'fais le contrat de location pour W'. Lit l'état civil et le logement dans la fiche locataire (07. Contacts/05. Locataires/01. Actuels/ ou _Candidats/), résout le bien via config/biens.yml + config/bail-config.yml, génère le DOCX (24 sections) via scripts/generer_bail.py puis le convertit en PDF. Ne couvre pas l'attestation de fin de bail (skill fin-de-bail) ni la quittance de loyer (skill quittance)."
---

# Skill baux — bail meublé d'habitation

> À partir de la fiche d'un locataire ou d'un candidat, produire un **bail meublé d'habitation** (DOCX + PDF) conforme à la loi n° 89-462 du 6 juillet 1989, et le ranger dans le dossier du locataire. Copie exécutable du workflow maître `08. Outils/Workflows/Workflow Baux.md`. Le document est produit par `scripts/generer_bail.py` — moteur python-docx, déterministe.

## 1. Trigger

### Déclencheurs verbaux

Thomas exprime l'intention de produire un bail : « génère le bail de [locataire] », « bail pour le nouveau locataire de [bien], début le [date] », « fais le contrat de location pour [candidat] », « bail meublé pour [personne], entrée le [date] ».

### Canaux d'apport de la demande

La demande peut venir de **n'importe quel canal** — saisie/dictée directe dans Cowork, message Telegram via Anya. Le déclencheur, c'est l'intention « produire un bail ».

### Hors trigger

- **Attestation de fin de bail** (certifier qu'un locataire est parti) → skill `fin-de-bail`.
- **Quittance de loyer** → skill `quittance`.
- **Congé bailleur, avenant, acte de cautionnement** → non couverts ; édition manuelle.
- **Bail commercial ou professionnel** → non couvert ; uniquement bail meublé d'habitation (résidence principale).

## 2. Input

- **Fiche du locataire ou du candidat** — `07. Contacts/05. Locataires/01. Actuels/<Prénom Nom>.md` (locataire en place, renouvellement) **ou** `_Candidats/<Prénom Nom>.md` (futur locataire pré-signature). Le moteur cherche dans les deux. Frontmatter requis : `civilite`, `nom_officiel`, `date_naissance`, `lieu_naissance`, `nationalite`, `adresse_bien`, `montant_loyer`, `montant_charges`. Utiles : `surface_m2`, `depot_garantie`, `date_entree_bail`, `jour_paiement`.
- **`config/bail-config.yml`** (dans le bundle) — état civil du bailleur, valeurs par défaut (dépôt, préavis, durée), caractéristiques par bien (surface, pièces, charges incluses), inventaires-types.
- **`config/biens.yml`** (dans le bundle) — référentiel des 4 biens, pour résoudre l'adresse canonique.
- **La demande** transmise par Thomas — locataire + date de début (et de signature si différente).

## 3. Étapes

### 3.0 Prérequis techniques

Le moteur `scripts/generer_bail.py` requiert **python-docx**, **num2words** et **pyyaml**. Au premier usage, dans le dossier de la skill : `pip install python-docx num2words pyyaml`. Le DOCX est ensuite converti en PDF via Word (`docx2pdf`, Windows) ou **libreoffice** en fallback. Sans aucun des deux, seul le DOCX est produit.

Variable d'environnement : `VAULT_ROOT` — racine du vault, pour localiser les fiches locataires et le dossier de sortie. `BAIL_CONFIG_DIR` — facultatif ; par défaut le moteur lit `bail-config.yml` et `biens.yml` dans le dossier `config/` du bundle.

### 3.1 Identifier le locataire

Matching partiel tolérant aux accents sur le nom de fichier. Le moteur cherche dans `01. Actuels/` (locataire en place) puis `_Candidats/` (futur locataire). Plusieurs correspondances → il s'arrête, préciser. Aucune → demander à Thomas, ne pas inventer.

### 3.2 Vérifier l'état civil (bloquant)

L'état civil complet du preneur est **obligatoire** : `civilite`, `nom_officiel`, `date_naissance`, `lieu_naissance`, `nationalite`, `adresse_bien`, `montant_loyer`. Si un champ manque, le moteur s'arrête (code 2) et indique la fiche à compléter. **Aucun défaut, aucune invention** — surtout pas le lieu de naissance ni la nationalité. Compléter la fiche avec Thomas avant de regénérer.

### 3.3 Identifier les dates

Date de début du bail (obligatoire). Date de signature : par défaut la veille du début, sauf indication contraire.

### 3.4 Générer le DOCX + PDF

Depuis le dossier de la skill :

```
VAULT_ROOT=<racine du vault> \
 python scripts/generer_bail.py --locataire "<nom>" --date-debut <AAAA-MM-JJ>
```

Overrides : `--date-signature`, `--loyer`, `--charges`, `--depot`, `--jour-paiement`, `--delai-restitution`. Options : `--no-pdf` (DOCX seul), `--dry-run` (vérifier les variables sans générer). Le moteur produit un DOCX d'environ 8 pages (24 sections + état des lieux + inventaire) puis tente la conversion PDF.

### 3.5 Vérification visuelle (obligatoire)

Un bail est un acte juridique. Relire au moins une fois : nom et état civil du preneur, adresse et complément du logement, surface, dates en lettres ET en chiffres, montants en lettres ET en chiffres, inventaire pertinent pour le bien.

### 3.6 Confirmer

Rendre le récap : locataire, statut (actuel / candidat), bien, dates, chemins DOCX et PDF, champs manquants éventuels.

## 4. Output

- Un **DOCX** `Bail-<bien>-<Prénom-Nom>-<AAAA-MM-JJ>.docx` dans `02. Projets/01. Perso/Immobilier Direct/Baux/<Prénom Nom>/`.
- Le **PDF** correspondant (si Word ou libreoffice est disponible).
- Un récap rendu à Thomas.

### Cas d'échec

- Locataire introuvable ou ambigu → le moteur s'arrête ; préciser.
- État civil incomplet → le moteur s'arrête (code 2) ; compléter la fiche avant de regénérer.
- Ni Word ni libreoffice → seul le DOCX est produit ; le convertir en PDF manuellement.

### Récap (rendu à Thomas)

```
Bail généré.

Locataire : [Nom] ([actuel | candidat])
Bien : [adresse + complément]
Début : [date] · Signature : [date]
DOCX : [lien]
PDF : [lien, ou « non généré — convertir manuellement »]

À relire (acte juridique) avant transmission au locataire.
```

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention** — état civil, adresse, montants : uniquement ce que la fiche locataire et la config contiennent. Champ manquant → le moteur s'arrête, compléter avec Thomas. Jamais de lieu de naissance ou de nationalité devinés.
2. **Pas de bail sans état civil complet** — c'est bloquant, pas de valeur par défaut sur ces champs.
3. **Le bailleur ne signe jamais automatiquement** — le bail est transmis non signé au locataire pour relecture ; la signature physique se fait en personne à la remise des clés.
4. **Vérification visuelle obligatoire** — un bail est un acte juridique ; relire noms, dates, montants avant de confirmer.
5. **Document final** — jamais de `[à compléter]` dans le bail produit (hors les champs d'état des lieux laissés vides à dessein pour remplissage manuel).
6. **Périmètre** — uniquement bail meublé d'habitation. Pas de bail commercial, pas de colocation cosignée.

### 5.2 Critères de qualité

- Bail conforme loi 89-462 : parties (état civil complet), logement (adresse, surface, pièces), durée 1 an tacite reconduction, préavis 1 mois locataire / 3 mois bailleur, loyer et charges en lettres et en chiffres, indexation IRL, dépôt ≤ 2 mois, délai de restitution 1 mois, clause résolutoire, clause pénale 10 %, obligations des parties, liste des annexes obligatoires, état des lieux + inventaire.
- Accords féminin/masculin corrects (Né/Née, désigné/désignée, M./Mme/Mlle).
- Adresse, surface et inventaire cohérents avec le bien.
- DOCX valide, PDF conforme, rendu déterministe et stable.

### 5.3 Cas particuliers connus

- **Locataires multiples (cosignataires)** — non gérés ; éditer le DOCX manuellement après génération.
- **Garants** (cas Timilas Mehmel, parents) — pas inclus dans le bail générique ; acte de cautionnement séparé à rédiger manuellement.
- **Candidat qui signe** — déplacer sa fiche de `_Candidats/` vers `01. Actuels/` et retirer `statut: candidat` (cf. skill `fiche-candidat`).
- **Candidat qui se retire** — archiver ou supprimer la fiche selon le choix de Thomas.

### 5.4 Exemple

**Demande** : « génère le bail de Hella, début le 23 mai 2024 ».

**Traitement** : fiche `07. Contacts/05. Locataires/01. Actuels/Hella Taoutaou.md` trouvée → `civilite: Mademoiselle` (accords féminin appliqués : Mlle, Née, désignée), état civil complet, `adresse_bien` résolue via `biens.yml` + `bail-config.yml` (54 rue Henri Barbusse, RDC sur cour, studio 14 m²), loyer 590 € + 100 € de charges. Date de signature par défaut : 22 mai 2024 (veille).

**Document produit** : `Bail-barbusse-studio-Hella-Taoutaou-2024-05-23.docx` (+ PDF), 8 pages, déposé dans `02. Projets/01. Perso/Immobilier Direct/Baux/Hella Taoutaou/`. Récap rendu à Thomas, invitation à relire avant transmission.

## Contenu du bundle

- `SKILL.md` — ce fichier.
- `scripts/generer_bail.py` — moteur de génération DOCX (python-docx, déterministe) + conversion PDF.
- `config/bail-config.yml` — état civil du bailleur, valeurs par défaut, caractéristiques par bien, inventaires-types.
- `config/biens.yml` — référentiel des 4 biens (résolution d'adresse).

## Liens

- Workflow maître : `08. Outils/Workflows/Workflow Baux.md`
- Skills sœurs : `08. Outils/Skills/quittance/`, `08. Outils/Skills/fin-de-bail/`
- Conventions vault : `CLAUDE.md` (racine vault)
