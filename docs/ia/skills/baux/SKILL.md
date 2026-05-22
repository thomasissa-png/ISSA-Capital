---
name: baux
description: "Génère un bail meublé complet (DOCX + PDF) à partir d'un candidat sélectionné et de dates (entrée + signature). Workflow Telegram interactif piloté par `src/lib/secretariat/workflows/bail.ts`. Source de vérité : fiche candidat + fiche bien + inventaire."
---

# Skill baux — bail meublé DOCX + PDF

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/baux/SKILL.md`.
> Génère un bail meublé légal complet (DOCX + PDF) à partir d'une fiche candidat. Décision Thomas appliquée : pas de confirmation des infos vault (vault = SOT). Confirmation uniquement sur le récap avant génération (dates + montants calculés/inférés).

## 1. Trigger

Commande Telegram `/bail`. Thomas a déjà créé la fiche candidat (via `/candidat`) et veut maintenant générer le bail.

## 2. Input

- **Candidat** (fiche `07. Contacts/05. Locataires/_Candidats/<Prenom Nom>.md`) — sélection fuzzy par nom.
- **Date d'entrée** dans les lieux (DD/MM/YYYY).
- **Date de signature** du bail (DD/MM/YYYY).
- **Bien** : résolu via la fiche candidat (champ `bien_id`).
- **Inventaire** : `verifierFicheBail()` charge l'inventaire meublé depuis la fiche bien.
- **Bailleur** : résolu via le bien.

## 3. Étapes

### 3.1 selecting_locataire
Liste des candidats — sélection fuzzy.

### 3.2 collecting_date_debut
Date d'entrée dans les lieux.

### 3.3 collecting_date_signature
Date de signature (par défaut = date du jour si Thomas tape "aujourd'hui").

### 3.4 confirming_recap
Récap : candidat, bien, dates, loyer + charges, dépôt de garantie. Boutons Valider / Annuler.

### 3.5 generating
Génération DOCX (`genererBailDocx`) puis conversion PDF (`genererBailPdf`).

### 3.6 done
Upload Drive dans `Baux/`, envoi Telegram des 2 documents (DOCX + PDF).

## 4. Output

- DOCX `bail-<bien>-<locataire>-<date>.docx` dans Drive
- PDF `bail-<bien>-<locataire>-<date>.pdf` dans Drive
- 2 liens Drive renvoyés à Thomas

## 5. Méthode

### 5.1 Red lines

1. Pas de confirmation des infos vault (vault = SOT) — Thomas valide UNIQUEMENT dates + montants calculés.
2. L'inventaire meublé vient de la fiche bien — jamais inventé, jamais résumé.
3. Dépôt de garantie = 2 mois de loyer hors charges (convention légale meublé).
4. Date de signature >= date du jour - 30j (rejet si trop ancien, prévention erreur).
5. Statut candidat → bascule "actuel" après génération du bail (TODO via bail-config).
6. Encodage UTF-8 strict.

### 5.2 Arbre de décision

```
/bail
├── Candidat trouvé ?
│   ├── Oui → demander date d'entrée
│   └── Non → lister candidats numérotés
├── Dates valides ?
│   ├── Oui → récap → valider
│   └── Non → re-demander
└── Récap validé ?
    ├── Oui → générer DOCX + PDF + upload Drive
    └── Annuler → suppression workflow state
```

### 5.3 Critères de qualité

- DOCX éditable post-génération (Thomas peut corriger une typo avant signature).
- PDF identique au DOCX (rendu fidèle).
- Référence dans le footer.
- Articles légaux conformes (loi 89-462 meublé).
