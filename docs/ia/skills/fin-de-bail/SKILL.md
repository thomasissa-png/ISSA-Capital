---
name: fin-de-bail
description: "Génère une attestation PDF de fin de bail à partir d'un locataire sélectionné et d'une date de fin. Workflow Telegram interactif piloté par `src/lib/secretariat/workflows/fin-de-bail.ts`. Source de vérité : fiche locataire vault + fiche bailleur."
---

# Skill fin-de-bail — attestation PDF de fin de bail

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/fin-de-bail/SKILL.md`.
> Document simple (1 page) permettant à un ancien locataire de prouver qu'il a quitté le logement (banque, assurance, nouveau bailleur).

## 1. Trigger

Commande Telegram `/findebail` ou détection contextuelle (Thomas demande explicitement une attestation de fin de bail pour un locataire).

## 2. Input

- **Locataire** (fiche vault `07. Contacts/05. Locataires/`) — recherche fuzzy par nom.
- **Date de fin de bail** — saisie Telegram (`DD/MM/YYYY` ou `YYYY-MM-DD`).
- **Bailleur** (fiche `02. Projets/02. Pro/<entité>/Bailleur.md`) — résolution automatique via bail-config.
- **Bien** — résolu via la fiche locataire (champ `bien_id`).

## 3. Étapes

### 3.1 Sélection locataire
Recherche fuzzy dans `listerLocatairesActuels()` + parcours candidats.

### 3.2 Saisie date de fin
Parse via `parseDateInput()` (DD/MM/YYYY, YYYY-MM-DD).

### 3.3 Confirmation récap
Récap : locataire, adresse bien, date fin, bailleur. Boutons Valider / Annuler.

### 3.4 Génération PDF
`genererFinDeBailPdf()` avec signature base64 du bailleur.

### 3.5 Upload Drive
Dossier `Baux/` du bien concerné via `getOrCreateSubfolder`.

### 3.6 Envoi Telegram
Document PDF envoyé à Thomas avec lien Drive.

## 4. Output

- PDF `attestation-fin-de-bail-<locataire>-<date>.pdf` dans Drive
- Lien Drive renvoyé via Telegram

## 5. Méthode

### 5.1 Red lines

1. Pas de confirmation des infos vault (vault = SOT) — Thomas valide UNIQUEMENT le récap.
2. La signature est celle du bailleur, jamais inventée — `chargerSignatureBase64()`.
3. La date de fin de bail ne peut pas être antérieure à la date de début de bail.
4. Pas d'attestation pour un locataire candidat (statut != "actuel" rejeté).

### 5.2 Arbre de décision

```
/findebail
├── Locataire trouvé (fuzzy) ?
│   ├── Oui → demander date de fin
│   └── Non → lister candidats numérotés, attendre choix
└── Date saisie valide ?
    ├── Oui → récap → génération
    └── Non → re-demander
```

### 5.3 Critères de qualité

- PDF mono-page, signature visible.
- Référence dans le footer.
- Encodage UTF-8 strict (accents préservés).
