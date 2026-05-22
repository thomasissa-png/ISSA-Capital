---
name: cr-reunion
description: "Produit un compte rendu de réunion au format PDF légal à partir d'une note (texte ou vocal transcrit). À utiliser quand Thomas dit 'fais le CR', 'rédige un compte rendu', 'compte rendu de ma réunion / mon déjeuner avec X', 'transforme cette note en CR', ou quand une note de réunion substantielle (≥ 100 caractères) doit être formalisée. Détecte le mode solo ou multi-participants, structure le CR en 4 sections légales (Art. 39-1 CGI), génère le PDF via scripts/generate_cr_pdf.js (rendu identique au bot Anya), le range dans le dossier de l'entité (IC / GO / VI / VV) et le propage dans la fiche de l'entité du vault."
---

# Skill cr-reunion — compte rendu PDF d'une réunion

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/cr-reunion/SKILL.md`.
> À partir d'une note de réunion, produire un compte rendu structuré au format PDF légal, le ranger dans le dossier de l'entité concernée, et le propager dans la fiche de cette entité. Copie exécutable du workflow maître `08. Outils/Anya/Skills/Workflow CR Reunion.md`. Le rendu PDF est produit par `scripts/generate_cr_pdf.js` — portage fidèle du moteur du bot Anya, donc rendu identique.

## 1. Trigger

### Déclencheurs verbaux
Thomas exprime l'intention de produire un compte rendu : « fais le CR de [réunion] », « rédige un compte rendu », « compte rendu de mon déjeuner avec [personne] », « CR réunion [sujet] », « transforme cette note en CR ».

### Déclencheur contextuel
Une note de réunion substantielle (≥ 100 caractères, décrivant un échange, un rendez-vous, une visite ou une activité professionnelle) peut enclencher la skill automatiquement.

### Variantes
- **Multi-participants** : la note nomme au moins un tiers → libellé « Participants ».
- **Solo** : activité sans tiers (visite seul, signature solo) → libellé « Présent ».

### Hors trigger
Photo sans note, email entrant, note sous 100 caractères → ne pas produire de CR.

## 2. Input

- **Fiche de l'entité concernée** (`02. Projets/02. Pro/`) — pour la propagation.
- **`hot-context.md`** — contexte récent.
- **Fiches contacts des participants nommés** (`07. Contacts/`) — à lire pour chaque participant tiers : nom exact, titre/fonction, société, qualité de la relation.
- **La note** transmise par Thomas — matière première unique.
- **Photos** éventuellement jointes (jusqu'à ~10) → annexes.

Entités possibles : **IC** (ISSA Capital SAS), **GO** (Gradient One), **VI** (Versi Immobilier), **VV** (Versi Invest).

## 3. Étapes

### 3.1 Identifier l'entité et le mode
Déterminer l'entité (IC / GO / VI / VV) et le mode (solo si aucun tiers nommé, multi sinon).

### 3.2 Attribuer la référence séquentielle
Référence `<ENTITÉ>-CR-<ANNÉE>-<NNNN>`. Lister les CR existants du dossier « Comptes Rendus » de l'entité, prendre le numéro le plus haut de l'année + 1.

### 3.3 Rédiger le CRDraft (Zod)
Champs : entite, type_reunion, date_reunion, lieu, participants[], objet, montant_ttc_eur, etablissement_nom, section_1_objet_art_39_1, section_2_points_abordes, section_3_decisions, section_4_suites_a_donner, annexes_photographiques[].

### 3.4 Générer le PDF via le moteur
### 3.5 Déposer le PDF dans Comptes Rendus de l'entité
### 3.6 Propager dans la fiche entité (## Compte rendu, complete jamais remplace)
### 3.7 Confirmer (récap entité, mode, référence, lien PDF)

## 4. Output

- PDF légal `<référence>.pdf` dans Comptes Rendus de l'entité
- Fiche entité complétée d'une ligne dans `## Compte rendu`
- Récap rendu à Thomas

## 5. Méthode

### 5.1 Red lines

1. Zéro invention de participant — tiers non identifiable → solo ou « (à identifier) ».
2. Zéro invention de fait — montant, date, lieu, décision : uniquement note.
3. Compléter ≠ remplacer — section `## Compte rendu` s'enrichit jamais s'écrase.
4. Propagation non bloquante.
5. Nom du PDF = la référence — rien d'autre.
6. Format légal respecté — 4 sections, Art. 39-1, footer DGFiP.
7. Jamais de placeholder — renvoi vers Tiime si justificatif manquant.

### 5.2 Arbre de décision — solo vs multi

```
Note de réunion
├── Au moins un tiers nommé (autre que Thomas) ?
│   ├── Oui → mode multi-participants → libellé « Participants »
│   └── Non → mode solo → libellé « Présent », participants = []
```

### 5.3 Critères de qualité

- 4 sections + en-tête + participants
- Aucune donnée inventée
- Référence séquentielle sans trou
- Fiche entité enrichie sans perte
- PDF valide format légal
