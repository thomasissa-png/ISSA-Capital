# Questionnaire structure vault Drive Anya — calibrage email-ingest

> À transmettre à Cowork (ou autre source qui connaît la structure réelle du vault Drive de Thomas).
> Date : 2026-05-14 (S14 — Anya email-ingest V1).

## Contexte

Anya est le secrétariat IA de Thomas (ISSA Capital). Elle écrit dans le vault Drive de Thomas pour append historique, créer fiches contacts, créer notes "à classifier", créer fiches biens immobiliers. Pour que les actions de validation Telegram fonctionnent, j'ai besoin de connaître la structure **exacte** du vault Drive.

Merci de répondre par paths complets, en gardant accents/espaces/numérotation comme dans Drive. Si un dossier n'existe pas mais qu'il devrait, indique où Thomas veut qu'il soit créé.

---

## A. Structure racine du vault Drive

**A1.** Quels sont les dossiers visibles à la racine du vault Drive Anya ? Liste-les exactement (avec numérotation et accents si présents).

**A2.** Le dossier `_Inbox/` existe-t-il bien à la racine ? (utilisé pour `_Inbox/AnyaLogs/` et `_Inbox/AnyaState/` — audit et state Anya)

---

## B. Paths exacts pour les 4 handlers Anya

**B1. Notes "à classifier"** — emails dont Anya ne sait pas où ranger, ou candidats sans handler dédié.
- Chemin complet du dossier ?
- Convention nom de fichier ? (proposition : `YYYY-MM-DD - Sujet email.md`)
- Existe-t-il déjà ou faut-il le créer ?

**B2. Fiches contacts professionnels** (avocats, notaires, comptables, partenaires business, fournisseurs).
- Chemin complet du dossier ?
- Convention nom de fichier ? (`Prénom Nom.md` ? Sans accents dans le filename ?)
- Y a-t-il des sous-dossiers par type (avocats / notaires / partenaires) ou tout à plat ?

**B3. Fiches locataires actuels** (locataires en bail actif).
- Chemin complet du dossier ?
- Convention nom de fichier ?
- Distinction Actuels vs Anciens ? Si oui : path pour Anciens aussi.

**B4. Candidats locataires** (personnes qui postulent pour un logement, pas encore locataires).
- Chemin complet du dossier ?
- Convention nom de fichier ?
- Existe-t-il déjà ou à créer ?

**B5. Fiches biens immobiliers (apporteurs / opportunités off-market)**.
- Chemin complet du dossier "Pipeline" / "Opportunités" ?
- Convention nom de fichier ? (proposition : `YYYY-MM-DD - Adresse courte.md`)
- Existe-t-il déjà ou à créer ?

---

## C. Conventions de nommage des fichiers

**C1.** Les noms de fichiers contiennent-ils des accents (`é à ç`) ou tout ASCII (`Prenom Nom.md`) ?

**C2.** Caractères interdits / à transformer dans les noms ? (ex: `/` `:` `?` `*` — à remplacer par quoi ?)

**C3.** Longueur max d'un nom de fichier respectée ? (proposition : 60 caractères)

---

## D. Structure interne des fiches contacts (pour append historique)

**D1. Frontmatter YAML** — quels champs sont attendus dans une fiche contact ? Exemple souhaité :
```yaml
---
nom: Martin Yhuel
email: martin@pnmavocats.law
type: avocat
date_derniere_interaction: 2026-05-14
---
```
Confirme la structure réelle ou corrige.

**D2.** Le champ "email" est-il unique (`email: martin@x.com`) ou multiple (`emails: [a@x, b@x]`) ? Anya doit pouvoir matcher l'expéditeur via cette information.

**D3. Section "Historique"** — y a-t-il une section dédiée dans chaque fiche pour les interactions ? Format attendu :
```markdown
## Historique

### 2026-05-14 — Demande validation clause bail
Avocat demande validation clause bail spécifique. [Lien email]
```
Confirme le format souhaité (titre section, format date entrée, etc.).

**D4.** Anya doit-elle écrire les interactions en **chrono-inverse** (plus récent en haut) ou chrono-direct ? *(Note : vault-client utilise chrono-inverse par défaut.)*

---

## E. Todo.md (utile pour Jalon 5 cron + TickTick à venir)

**E1.** Le fichier `Todo.md` est-il à la racine du vault ou dans un sous-dossier ?

**E2.** Quelles sont les sections existantes ? (ex : `## Inbox`, `## Cette semaine`, `## En attente`, `## Quelqu'un/un jour`)

**E3.** Format d'une ligne tâche standard ?
```markdown
- [ ] description 📅 2026-05-20 #tag1 #tag2
```
Confirme ou corrige.

**E4.** Anya peut-elle ajouter des tâches dans `## Inbox` automatiquement ? (suggestion handlers `add_todo`)

---

## F. Réunions

**F1.** Chemin du dossier réunions ?

**F2.** Convention nom de fichier ? (proposition `YYYY-MM-DD - Personnes - Sujet.md`)

**F3.** Y a-t-il un fichier `Calendrier.md` central ou seulement les fichiers individuels ?

---

## G. Cas particuliers

**G1. Versi vs ISSA Capital** — y a-t-il 2 vaults distincts (un par entité) ou un seul ? Si un seul : distinction des contacts par dossier (`Contacts/ISSA/`, `Contacts/Versi/`) ou par tag/frontmatter ?

**G2. Famille vs Pro** — les contacts famille/perso sont-ils dans le même dossier que les contacts pro ou séparés ?

**G3. Comptes mail multiples** — Thomas reçoit-il des emails sur plusieurs adresses (perso + pro) ? Anya doit-elle traiter tout ou filtrer ?

---

## H. Listes maîtres (pour le contexte injecté au triage Haiku)

**H1. Liste maître des locataires actuels** — fichier unique listant tous les locataires avec leurs emails, ou listing dynamique du dossier `Locataires/Actuels/` ?

**H2. Liste maître des contacts pro principaux** — quels sont les contacts pro principaux à toujours injecter en contexte du triage (avocats, comptable, notaire récurrent) ? Top 10-20 emails + noms.

**H3.** Si un email arrive d'un contact non listé mais nominatif (ex: `jean.dupont@gmail.com`) : Anya doit-elle créer une fiche stub par défaut ou demander confirmation Telegram avant ?

---

## I. Permissions Drive (technique)

**I1.** Le service account / OAuth Anya a-t-il **droit d'écriture** sur tous les dossiers mentionnés ci-dessus ? *(Si non, certaines actions échoueront même avec les bons paths.)*

**I2.** Y a-t-il des dossiers en read-only (ex: documents légaux, archives) où Anya ne doit JAMAIS écrire ?

---

## Format de réponse souhaité

Format markdown copy-paste, exemple :
```markdown
A1. Racine = `01. Profil/`, `02. Projets/`, ...
A2. _Inbox existe, OK.

B1. Notes à classifier = `Notes/A classifier/` (sans numérotation)
B2. Contacts pro = `Contacts/Pro/`
...
```

Une fois reçu, je corrige le code des 4 handlers + le prompt `triage-v1.md` + les tests en ~15 min. Push, sync Replit, restart, et la boucle valider → vault marche.

---

**Question bonus** : si Cowork connaît aussi les paths utilisés par les **autres** modules Anya déjà en prod (workflow quittance S12, workflow bail S13, inbox-photo-batch S13), ce serait utile pour vérifier la cohérence transverse.
