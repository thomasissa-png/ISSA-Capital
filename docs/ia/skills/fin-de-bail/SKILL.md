---
name: fin-de-bail
description: "Produit une attestation de fin de bail (PDF) — le document par lequel Thomas, propriétaire-bailleur, certifie qu'un ancien locataire a quitté le logement (pour son assurance, sa banque, un futur bailleur). À utiliser quand Thomas dit 'attestation de fin de bail pour X', 'atteste que X est parti', 'X a quitté le logement le [date]'. Document post-départ. Ne couvre pas la lettre de congé ni la génération de bail."
---

# Skill fin-de-bail — attestation de fin de bail

> Produire une **attestation de fin de bail** : Thomas, propriétaire-bailleur, certifie qu'un ancien locataire a quitté le logement, pour que celui-ci le prouve à son assurance / sa banque. Document **post-départ**.
>
> Le PDF est produit par `scripts/generer_fin_de_bail.js` — portage fidèle de `pdf-fin-de-bail.ts` du bot Anya : génération PDF directe (PDFKit), déterministe, rendu identique au bot. Inclut la mention légale du dépôt de garantie (art. 22 loi 89-462).
>
> À ne pas confondre avec une lettre de congé (notification de résiliation, avant le départ).

## 1. Trigger

### Déclencheurs verbaux

« attestation de fin de bail pour [locataire] », « atteste que [locataire] est parti », « [locataire] a quitté le logement le [date], fais l'attestation ».

### Skill

La skill s'appelle **`fin-de-bail`**. Chargée automatiquement sur phrase déclencheuse, ou invoquée par son nom.

### Canaux

La demande peut venir de n'importe quel canal — Cowork (saisie directe), Telegram via Anya.

### Hors trigger

- Lettre de congé (notifier une résiliation, avant le départ) → autre sujet.
- Nouveau bail → workflow Baux.
- Quittance de loyer → workflow Quittances.

## 2. Input

### Données fournies par Thomas

- Le **nom du locataire** (ou un fragment — matching tolérant aux accents et à l'ordre).
- La **date de fin du bail** (date effective du départ, format `AAAA-MM-JJ`).
- Éventuellement la **date d'émission** de l'attestation (défaut : aujourd'hui).

### Lu automatiquement

- **Fiche du locataire** — `07. Contacts/05. Locataires/01. Actuels/` ou `02. Anciens/`. Fournit le `nom_officiel` et l'`adresse_bien`.
- **`config/bail-config.yml`** (dans le bundle) — état civil et coordonnées du bailleur.
- **`config/biens.yml`** (dans le bundle) — référentiel des biens, pour résoudre l'adresse propre du logement.

### Convention de nommage du livrable

`Fin-de-bail-<Prénom-Nom>-<AAAA-MM-JJ>.pdf`. La date est celle de la fin du bail.

## 3. Étapes

### 3.0 Prérequis techniques

Le moteur `scripts/generer_fin_de_bail.js` requiert **pdfkit** et **js-yaml** (Node). Au premier usage, dans le dossier de la skill : `npm install pdfkit js-yaml`. Le PDF est généré directement — aucune conversion, aucune dépendance bureautique.

Variables d'environnement :

- `VAULT_ROOT` — racine du vault, pour localiser la fiche locataire et le dossier de sortie. À résoudre au moment de l'exécution.
- `SIGNATURE_PNG_PATH` — chemin du PNG de la signature manuscrite de Thomas. Pointer vers `08. Outils/Skills/_assets/signature-thomas-issa.png` du vault. Sans cette variable, l'attestation est produite sans signature manuscrite.

### 3.1 Identifier le locataire et la date

Récupérer le nom du locataire et la date de fin auprès de Thomas. Le script cherche la fiche dans `01. Actuels/` puis `02. Anciens/`. Si plusieurs locataires correspondent, ou aucun, le script s'arrête avec un message — demander une précision à Thomas. Si un champ critique manque dans la fiche (`nom_officiel`, `adresse_bien`), le script s'arrête aussi — le compléter avec Thomas avant de regénérer.

### 3.2 Générer l'attestation

Depuis le dossier de la skill :

```
VAULT_ROOT=<racine du vault> SIGNATURE_PNG_PATH=<chemin signature> \
 node scripts/generer_fin_de_bail.js --locataire "<nom>" --date-fin <AAAA-MM-JJ>
```

Option : `--date-emission <AAAA-MM-JJ>` (défaut aujourd'hui).

Le script produit le PDF de l'attestation et le dépose dans `02. Projets/01. Perso/Immobilier Direct/Fins de bail/<Locataire>/`.

### 3.3 Confirmer à Thomas

Rendre le récap : locataire, date de fin, lien du PDF. Inviter Thomas à relire avant transmission.

## 4. Output

- Un **PDF** d'attestation dans `02. Projets/01. Perso/Immobilier Direct/Fins de bail/<Locataire>/`.
- Un récap rendu à Thomas.

### Cas d'échec

- Locataire introuvable ou ambigu → le script s'arrête ; demander une précision à Thomas.
- Champ critique manquant dans la fiche locataire → le script s'arrête ; compléter la fiche.

### Récap (rendu à Thomas)

```
Attestation de fin de bail générée.

Locataire : [Nom]
Logement : [adresse du bien]
Fin du bail : [date]
PDF : [lien]

À relire avant transmission au locataire / à son assureur.
```

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention** — nom officiel, adresse, dates viennent de la fiche locataire et de la config. Champ manquant → le script s'arrête, compléter avec Thomas.
2. **Document final** — jamais de `[à compléter]` dans l'attestation produite.
3. **Signature scannée admise** — l'attestation est une certification post-départ ; la signature scannée du bailleur y figure légitimement.
4. **Vérification visuelle** — relire nom, adresse et dates avant de confirmer.
5. **Ne pas confondre avec une lettre de congé.**

### 5.2 Critères de qualité

- Attestation conforme : en-tête bailleur, objet, corps de certification, mention du dépôt de garantie (art. 22), signature.
- Nom officiel et adresse exacts, traçables à la fiche locataire.
- Dates correctes et cohérentes.
- PDF valide, rendu identique au moteur du bot.

### 5.3 Exemple

**Demande** : « attestation de fin de bail pour Léa Lebioda, partie le 17 mai 2024 ».

Fiche `07. Contacts/05. Locataires/02. Anciens/Lea Lebioda.md` trouvée → `nom_officiel` et `adresse_bien`. Le PDF `Fin-de-bail-Lea-Lebioda-2024-05-17.pdf` est produit : il certifie que Léa Lebioda n'est plus locataire depuis le 17 mai 2024, porte la mention du dépôt de garantie (art. 22 loi 89-462) et la signature de Thomas Issa. Déposé dans `02. Projets/01. Perso/Immobilier Direct/Fins de bail/Lea Lebioda/`.

## Contenu du bundle

- `SKILL.md` — ce fichier.
- `scripts/generer_fin_de_bail.js` — moteur de génération PDF (portage fidèle de `pdf-fin-de-bail.ts`).
- `config/bail-config.yml` — état civil et coordonnées du bailleur.
- `config/biens.yml` — référentiel des biens (résolution d'adresse).

La signature manuscrite n'est pas dans le bundle : le moteur lit le PNG via `SIGNATURE_PNG_PATH`, à l'emplacement partagé `08. Outils/Skills/_assets/signature-thomas-issa.png`. Pour un bundle `.skill` totalement autonome, déposer le PNG dans un dossier `assets/` du bundle.

## Liens

- Workflow maître : `08. Outils/Anya/Skills/Workflow Fin de Bail.md`
- Skill de référence (modèle d'usage) : `08. Outils/Skills/traite-inbox/`
- Moteur d'origine : `src/lib/secretariat/rent/pdf-fin-de-bail.ts` (repo Anya)
- Conventions vault : `CLAUDE.md` (racine vault)
