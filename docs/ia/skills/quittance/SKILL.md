---
name: quittance
description: "Génère une ou plusieurs quittances de loyer au format PDF légal à partir de la fiche d'un locataire actuel, et prépare optionnellement un brouillon Gmail d'envoi. À utiliser quand Thomas dit 'génère la quittance de X', 'quittance de mai pour Y', 'les 3 dernières quittances pour Z', 'génère toutes les quittances du mois', ou quand un locataire/garant envoie un email demandant une quittance. Lit le loyer et l'adresse dans la fiche locataire (07. Contacts/05. Locataires/01. Actuels/), résout le bien via config/biens.yml, génère le PDF via scripts/generer_quittance.py (moteur fpdf2 déterministe), range le PDF dans le dossier Immobilier Direct. N'envoie jamais d'email — toujours un brouillon validé par Thomas."
---

# Skill quittance — quittance de loyer PDF

> À partir de la fiche d'un locataire actuel, produire une ou plusieurs quittances de loyer au format PDF légal, les ranger dans le dossier du locataire, et préparer optionnellement un brouillon Gmail d'envoi. Copie exécutable du workflow maître `08. Outils/Workflows/Workflow Quittances.md`. Le rendu PDF est produit par `scripts/generer_quittance.py` — moteur fpdf2 (pur Python), déterministe.

## 1. Trigger

### Déclencheurs verbaux

Thomas exprime l'intention de produire une quittance : « génère la quittance de mai pour [locataire] », « quittance pour [locataire], mois en cours », « envoie les 3 dernières quittances à [locataire] », « génère janvier à mars pour [locataire] », « génère toutes les quittances du mois », « quittances pour le bilan LMNP 2025 ».

### Déclencheur contextuel

Un email entrant d'un locataire — ou de son garant — demandant une quittance (mots-clés « quittance », « loyer », « attestation de paiement ») enclenche la skill : détecter, générer, préparer le brouillon de réponse.

### Canaux d'apport de la demande

La demande peut venir de **n'importe quel canal** — saisie/dictée directe dans Cowork, email transmis, message Telegram via Anya. Le déclencheur, c'est l'intention « produire une quittance », pas le canal.

### Hors trigger

- Demande sur un **ancien locataire** (fiche dans `02. Anciens/`) → vérifier d'abord avec Thomas ; le script ne scanne que `01. Actuels/`.
- Attestation de fin de bail → skill `fin-de-bail`.
- Génération de bail → workflow Baux.

## 2. Input

- **Fiche du locataire** — `07. Contacts/05. Locataires/01. Actuels/<Prénom Nom>.md`. Frontmatter requis : `montant_loyer`, `adresse_bien`. Utiles : `montant_charges` (défaut 0), `email`, `civilite`, `nom_officiel`, `tutoiement`.
- **`config/biens.yml`** (dans le bundle) — référentiel des 4 biens loués : état civil du bailleur, adresses canoniques, signature. Résout l'adresse propre du logement à partir de l'`adresse_bien` de la fiche locataire.
- **`config/email-body.txt`** (dans le bundle) — 4 variantes de corps d'email (1 mois / plage × direct / neutre), pour le brouillon d'envoi.
- **La demande** transmise par Thomas — locataire(s) + période.

## 3. Étapes

### 3.0 Prérequis techniques

Le moteur `scripts/generer_quittance.py` requiert **fpdf2**, **num2words** et **pyyaml**. Au premier usage, dans le dossier de la skill : `pip install fpdf2 num2words pyyaml`. fpdf2 est pur Python — aucune dépendance GTK/Cairo.

Variables d'environnement :

- `VAULT_ROOT` — racine du vault, pour localiser les fiches locataires et le dossier de sortie. À résoudre au moment de l'exécution.
- `SIGNATURE_PNG_PATH` — chemin du PNG de la signature manuscrite de Thomas. Pointer vers `08. Outils/Skills/_assets/signature-thomas-issa.png` du vault. Sans cette variable, la quittance est produite sans signature manuscrite ; le reste du rendu est intact.
- `QUITTANCE_CONFIG_DIR` — facultatif ; par défaut le moteur lit `biens.yml` dans le dossier `config/` du bundle.

### 3.1 Identifier le locataire

Si la demande nomme le locataire (« pour Kenan ») → matching partiel tolérant aux accents sur le nom de fichier. Si plusieurs locataires correspondent, le script s'arrête — préciser. Depuis un email : extraire le nom de l'expéditeur, vérifier qu'une fiche existe dans `01. Actuels/` ; si pas de match exact, demander confirmation à Thomas avant de générer. « Toutes les quittances » → option `--tous`.

### 3.2 Identifier la période

« Quittance de mai » sans année → année en cours. « Les 3 derniers mois » → mois en cours + 2 précédents. « Pour le bilan LMNP 2025 » → janvier à décembre 2025. Période ambiguë → demander à Thomas (date floue = pas de génération).

### 3.3 Vérifier la fiche locataire

Lire le frontmatter. Si `montant_loyer` ou `adresse_bien` manque → **ne pas générer en aveugle** : signaler dans le récap et demander la valeur exacte à Thomas (red line : zéro invention). Si le bien n'est pas résolu par `biens.yml`, le script s'arrête avec un message explicite.

### 3.4 Vérifier le paiement (red line)

Une quittance atteste un paiement **reçu**. Ne jamais générer une quittance pour un mois dont le loyer n'a pas été payé sans confirmation explicite de Thomas. Vigilance sur les cas connus d'impayés (cf. § 5.3).

### 3.5 Générer le(s) PDF

Depuis le dossier de la skill :

```
VAULT_ROOT=<racine du vault> SIGNATURE_PNG_PATH=<chemin signature> \
 python scripts/generer_quittance.py --locataire "<nom>" --mois <AAAA-MM>
```

Variantes : `--mois 2026-01 2026-02 2026-03` (mois discontinus), `--du 2026-01 --au 2026-05` (plage), `--tous --mois 2026-05` (tous les locataires actuels). Options : `--date-emission`, `--date-paiement`, `--moyen-paiement`, `--dry-run`. Vérifier que chaque PDF a bien été créé (fichier non vide).

### 3.6 Préparer le brouillon Gmail (si l'envoi est demandé)

Cibler l'`email` de la fiche locataire — ou celui du garant si la demande vient du garant (cf. § 5.3). Choisir la variante de `email-body.txt` selon le ton : `1-mois-direct` / `plage-direct` pour un locataire tutoyé (`tutoiement: true`), `neutre-vouvoiement` / `neutre-plage` sinon. Créer un **brouillon** Gmail (`create_draft`) avec les PDF en pièces jointes. **Jamais d'envoi automatique** — Thomas relit et envoie.

### 3.7 Confirmer

Rendre le récap : PDF générés (chemins), brouillon Gmail créé, données manquantes ou blocages signalés.

## 4. Output

- Un ou plusieurs **PDF** `Quittance-<Prénom-Nom>-<AAAA-MM>.pdf` dans `02. Projets/01. Perso/Immobilier Direct/Quittances/<Prénom Nom>/`.
- Optionnellement un **brouillon Gmail** avec les PDF en pièces jointes (jamais envoyé).
- Un récap rendu à Thomas.

### Récap (rendu à Thomas)

```
## Quittances générées

X quittance(s) générée(s), Y brouillon(s) créé(s).

PDF :
- [Locataire] [Période] → [chemin]

Brouillon Gmail :
- [Locataire] → [email destinataire] (X pièces jointes)

Données manquantes / blocages :
- [Locataire] : [champ manquant] — action attendue
```

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention** — montant de loyer, charges, nom, adresse : uniquement ce que la fiche locataire et `biens.yml` contiennent. Champ manquant → demander à Thomas, ne pas générer.
2. **Jamais d'envoi automatique** — toujours un brouillon Gmail ; Thomas valide et envoie lui-même.
3. **Jamais modifier la fiche locataire** — elle est lue, jamais écrite par cette skill.
4. **Jamais de quittance pour un loyer impayé** sans confirmation explicite de Thomas — une quittance atteste un paiement reçu.
5. **Document final** — jamais de `[à compléter]` dans une quittance produite.
6. **Nom du PDF figé** — `Quittance-<Prénom-Nom>-<AAAA-MM>.pdf`, rien d'autre.

### 5.2 Critères de qualité

- Quittance conforme : en-tête, bloc bailleur + bloc adresse, corps de quittance, détail loyer/charges/total, date et moyen de paiement, signature, mentions légales (art. 21 loi 89-462).
- Montants, nom et adresse exacts, traçables à la fiche locataire et à `biens.yml`.
- Numéro de quittance séquentiel cohérent (`QL-AAAA-MM-INITIALES`).
- PDF valide, rendu déterministe et stable.

### 5.3 Cas particuliers connus

- **Lucas Geoffroy** (7 passage Saint-Michel, côté rue) — virements depuis les Émirats (REIKI FZCO), impayés récurrents. Vérifier le paiement avant de générer.
- **Timilas Mehmel** — loyer payé par les parents (Amrouche + Louiza Mehmel). Les demandes viennent souvent du père (`amrouchemehmel971@gmail.com`) : la quittance reste libellée au nom de Timilas, mais le brouillon d'envoi va au père.
- **Nzioka Mutheu** (Studio 5, bd de la Seine) — difficultés financières, paiement parfois partiel. Demander avant de générer.

### 5.4 Exemple — quittance avec brouillon d'envoi

**Demande** : « génère la quittance de mai 2026 pour Kenan et prépare l'envoi ».

**Traitement** : fiche `07. Contacts/05. Locataires/01. Actuels/Kenan Beguigneau.md` trouvée → `montant_loyer: 700`, `montant_charges: 90`, `adresse_bien` résolue via `biens.yml` (2 bis boulevard de la Seine, Studio 4, 6e étage, 92000 Nanterre), `tutoiement: true`. Le moteur produit `Quittance-Kenan-Beguigneau-2026-05.pdf` (total 790 €, n° `QL-2026-05-KBE`) dans `02. Projets/01. Perso/Immobilier Direct/Quittances/Kenan Beguigneau/`.

Brouillon Gmail à `kbeguigneau@gmail.com`, variante `1-mois-direct`, PDF en pièce jointe — non envoyé. Récap rendu à Thomas.

## Contenu du bundle

- `SKILL.md` — ce fichier.
- `scripts/generer_quittance.py` — moteur de génération PDF (fpdf2, pur Python, déterministe).
- `config/biens.yml` — référentiel des 4 biens loués et état civil du bailleur.
- `config/email-body.txt` — 4 variantes de corps d'email pour le brouillon d'envoi.

La signature manuscrite n'est pas dans le bundle : le moteur la lit via `SIGNATURE_PNG_PATH`, à l'emplacement partagé `08. Outils/Skills/_assets/signature-thomas-issa.png`. Pour un bundle `.skill` totalement autonome, déposer le PNG dans `config/`.

## Liens

- Workflow maître : `08. Outils/Workflows/Workflow Quittances.md`
- Skill de référence (modèle d'usage) : `08. Outils/Skills/traite-inbox/`
- Conventions vault : `CLAUDE.md` (racine vault)
