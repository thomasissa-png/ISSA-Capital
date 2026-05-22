---
name: fiche-candidat
description: "Crée une fiche Markdown structurée (frontmatter + sections) dans le vault Obsidian pour un candidat locataire en pré-sélection. Workflow Telegram interactif piloté par `src/lib/secretariat/workflows/candidat.ts`. Source de vérité : la fiche est créée dans `07. Contacts/05. Locataires/_Candidats/`."
---

# Skill fiche-candidat — fiche candidat locataire dans le vault

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/fiche-candidat/SKILL.md`.
> Crée une fiche structurée (frontmatter YAML + sections) dans le dossier `_Candidats` du vault pour un dossier de pré-sélection locataire. Pas de génération PDF.

## 1. Trigger

Commande Telegram `/candidat`. Thomas saisit progressivement les infos d'un candidat reçu (mail, appel, visite). Le workflow guide étape par étape.

## 2. Input

- Saisie Telegram interactive : nom, contact, situation, garanties, bien visé, notes.

## 3. Étapes

### 3.1 collecting_nom
Prénom + nom du candidat.

### 3.2 collecting_contact
Email + téléphone.

### 3.3 collecting_situation
Profession, revenus, composition foyer.

### 3.4 collecting_garanties
Garant éventuel, type de garantie (Visale, garant physique, dépôt complémentaire).

### 3.5 collecting_bien
Bien visé (résolution via biens.ts).

### 3.6 collecting_notes
Notes libres (impression Thomas, points d'attention).

### 3.7 confirming_recap
Récap → Valider / Annuler / Modifier.

### 3.8 creating_fiche
Création de la fiche Markdown dans `07. Contacts/05. Locataires/_Candidats/<Prenom Nom>.md`.

## 4. Output

- Fiche Markdown créée dans le vault Drive (frontmatter YAML conforme + 6 sections)
- Lien Drive renvoyé à Thomas

## 5. Méthode

### 5.1 Red lines

1. Fiche créée UNIQUEMENT après validation explicite Thomas (étape `confirming_recap`).
2. Pas d'écrasement — si fiche `<Prenom Nom>.md` existe déjà, suffix `_2`, `_3` automatique.
3. Frontmatter conforme aux conventions existantes (champs `nom`, `prenom`, `email`, `telephone`, `bien_id`, `statut: candidat`, `created_at`).
4. Pas d'inférence — chaque champ vient d'une saisie Thomas explicite.

### 5.2 Arbre de décision

```
/candidat
├── Étape par étape (10 étapes) → recap → valider
│   ├── Validé → créer fiche
│   ├── Modifier → retour à l'étape demandée
│   └── Annulé → suppression workflow state
```

### 5.3 Critères de qualité

- Frontmatter parseable par parseObsidianFile().
- Wikilinks Obsidian fonctionnels vers le bien.
- Fiche immédiatement visible dans Obsidian après sync Drive.
