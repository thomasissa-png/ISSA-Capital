---
name: quittance
description: "Génère un batch de quittances de loyer PDF (N locataires × M mois) à partir d'une sélection Telegram. Workflow piloté par `src/lib/secretariat/workflows/quittance.ts`. Source de vérité : fiches locataires + bailleur + bien dans le vault."
---

# Skill quittance — quittances de loyer PDF (batch)

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/quittance/SKILL.md`.
> Génère 1 à N×M quittances de loyer PDF en une seule invocation. Le mode "1 quittance simple" est le cas N=1, M=1. Génération directe sans confirmation (décision Thomas) — dès que la période est validée, le batch démarre.

## 1. Trigger

Commande Telegram `/quittance`. Thomas sélectionne les locataires concernés puis la période (mois unique, plage, ou ensemble de mois).

## 2. Input

- **Locataires** (fiches `07. Contacts/05. Locataires/01. Actuels/`) — sélection multiple par numéros.
- **Période** : mois unique (`05/2026`), plage (`01/2026-06/2026`), ou liste (`03/2026, 05/2026`).
- **Bailleur** : résolution automatique via la fiche bien du locataire.
- **Variables calculées** : montant loyer, charges, total TTC, montant en lettres (`nombreEnLettres`).

## 3. Étapes

### 3.1 selecting_locataires
Liste numérotée des locataires actuels. Thomas saisit `1,3,5` ou `1-4`.

### 3.2 selecting_periode
Saisie de la période (mois, plage, liste).

### 3.3 generating
Boucle N×M : pour chaque (locataire, mois), résolution bien + bailleur + chargement signature + génération PDF + upload Drive.

### 3.4 done
Récap : nombre de PDFs générés, liens Drive, durée totale.

## 4. Output

- N×M PDFs `quittance-<bien>-<locataire>-<mois>.pdf` dans Drive (`Quittances/<année>/<mois>/`)
- Liste de liens Drive renvoyée via Telegram

## 5. Méthode

### 5.1 Red lines

1. Aucune limite N×M (Thomas peut générer 50 quittances d'un coup).
2. Montant loyer = celui de la fiche locataire (jamais inventé).
3. Date de paiement = dernier jour du mois (convention `dernierJourDuMois`).
4. Si la signature bailleur est introuvable → quittance générée SANS signature (warn, pas crash).
5. Encodage UTF-8 strict — accents préservés dans le PDF et le nom de fichier.

### 5.2 Arbre de décision

```
/quittance
├── Locataires sélectionnés (>0) ?
│   ├── Oui → demander période
│   └── Non → annuler
└── Période valide (parse OK) ?
    ├── Oui → générer batch direct (PAS de confirmation)
    └── Non → re-demander
```

### 5.3 Critères de qualité

- PDFs mono-page, signature visible quand dispo.
- Numérotation séquentielle par bien (référence dans le footer).
- Dossier Drive structuré par année puis mois.
