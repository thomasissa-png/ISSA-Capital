---
name: traite-inbox
description: "Triage et propagation de l'inbox du vault Obsidian de Thomas Issa. Use when the user says 'traite mon inbox', 'vide l'inbox', 'nettoie l'inbox', 'trie mon inbox'. Also support dry-run mode: 'dry-run', 'simulation', 'à blanc', 'dis-moi ce que tu ferais'. Sources : _Inbox/Plaud/ (transcripts), _Inbox/Photos/ (photos & vidéos iPhone), _Inbox/Voice/ (vocaux .ogg auto-transcrits Haiku 4.5), _Inbox/Notes/ et _Inbox/Documents/ (Anya), _Inbox/A classifier/, 03. Tâches/Todo.md ## Inbox. Inclut verrou de session anti-concurrence, dédoublonnage Plaud à l'écriture, classification, transitions cycle de vie projets (À venir → Passés / en cours → terminé / abandonné), matching anti-doublon contacts (Levenshtein), propagations en cascade, validation post-traitement, références aux templates 08. Outils/Templates/ (Bilan voyage, Bilan projet, Post-mortem, Historique contact, Fiche lecture)."
---

# Workflow Inbox — triage & propagation (v5.1 consolidé)

> Skill installable Cowork. Copie alignée de `08. Outils/Workflows/Workflow Inbox.md` (vault — source de vérité). Architecture du pipeline complet : `08. Outils/Workflows/Workflow Journal + Photos.md`. Templates : `08. Outils/Templates/`. Mount cassé → `08. Outils/Manipulation du vault (Drive API + Zapier).md`.

## 1. Trigger

### Déclencheurs verbaux

- "traite mon inbox"
- "vide l'inbox"
- "nettoie l'inbox"
- "trie mon inbox"

### Mode dry-run

Un verbe ci-dessus + "dry-run" / "simulation" / "à blanc" / "dis-moi ce que tu ferais" → exécution sans écriture vault. Récap avec en-tête `**Mode : dry-run — aucune modification appliquée.**`. Voir § 5.9.

### Skill Cowork

`traite-inbox` (`08. Outils/Skills/traite-inbox.skill`). Invocation par phrase déclencheuse ou par nom.

### Commande Anya (Telegram)

**`/inbox`** — aujourd'hui = retour mode inbox du bot. À étendre (câblage Anya séparé).

### Variante ciblée

"traite Plaud", "vide A classifier", "transcris les vocaux" → ne traiter que cette source.

### Hors trigger

- "traite mes emails" → phase email-ingest non câblée.
- Pas d'exécution silencieuse / cron. Demande explicite obligatoire.

## 2. Input

CLAUDE.md (racine vault) et fiches profil chargés automatiquement. Ne pas les recharger.

### Fiches à consulter

- `hot-context.md` (racine vault) — projets actifs.
- `08. Outils/Workflows/Workflow Journal + Photos.md` — vue architecturale du pipeline.
- `08. Outils/Templates/_README.md` — index des templates structurels.

### Sources à scanner

| Source | Contenu | Origine |
|---|---|---|
| `_Inbox/Plaud/` | Transcripts Plaud Note S | Zapier (Plaud → Drive) |
| `_Inbox/Photos/` | Photos / vidéos iPhone (`.jpg`, `.jpeg`, `.heic`, `.png`, `.mp4`, `.mov`) | iOS Shortcut **ou** Anya (`inbox-photo-batch`) |
| `_Inbox/Voice/` | Vocaux Telegram orphelins | Anya (cas marginal) |
| `_Inbox/Notes/` | Textes courts (rare) | Anya |
| `_Inbox/Documents/` | PDFs et fichiers | Anya |
| `_Inbox/A classifier/` | Notes ambiguës + bucket d'ambigus du triage | Thomas / Anya email-ingest (futur) / ce workflow |
| `03. Tâches/Todo.md` → `## Inbox` | Brain dump tâches | Anya **ou** Thomas |
| `_Inbox/AnyaLogs/` | JSONL audit Anya | **Hors scope** |
| `_Inbox/AnyaState/` | État interne Anya (nomatch-pendings, pending-validations, ticktick-sync-state) | **Hors scope** |
| `_Inbox/_Traité/` | Quarantaine | Géré par ce workflow |
| `_Inbox/_Archive_heic/` | HEIC archivées | Script externe — hors scope |
| `_Inbox/.lock` | Verrou de session | Géré par ce workflow — § 5.14 |

> **7 sources actives** = 6 dossiers `_Inbox/` (Plaud, Photos, Voice, Notes, Documents, A classifier) + `03. Tâches/Todo.md > ## Inbox`. Le récap doit couvrir les 7.

### Convention de nommage par source

| Source | Format |
|---|---|
| Plaud | `YYYY-MM-DDTHH mm ssZ - Titre.md` |
| Photos iOS | `YYYY-MM-DD_HH-mm_photo.jpg` (+ `_photo_2`...) |
| Photos Anya | `YYYY-MM-DD_HH-mm-ss.jpg` |
| Vidéos | `YYYY-MM-DD_HH-mm-ss.{mp4,mov}` |
| Voice | `YYYY-MM-DD_HH-mm-ss_Xs.ogg` |
| Documents | `YYYY-MM-DD_nom-original.ext` |
| A classifier | Variable |
| Todo.md `## Inbox` | Lignes `- [ ] ...` sans date ni tag |

Fichier hors convention → signaler, ne pas traiter en aveugle.

### Outils API requis (skill autonome)

| Usage | Outil MCP |
|---|---|
| Transcription vocaux `.ogg` | Claude Haiku 4.5 (input audio natif) |
| **Copie/renommage photos & vidéos** | **MCP Google Drive** (`search_files` + `copy_file`) |
| **Création de fiches** | MCP Google Drive (`create_file`) ou Read/Write/Edit |
| **Quarantaine sources** | MCP Zapier Google Drive (`move_file`) |
| **Renommage fiche existante** | MCP Zapier Google Drive (`update_file_name`) |
| Listing | `search_files` (Drive) ou Glob (Read tool) |

Tout passe par les MCP natifs Cowork. Pas de script externe. Si le mount casse → fallback Drive API + Zapier, cf. `08. Outils/Manipulation du vault (Drive API + Zapier).md`.

## 3. Étapes

### 3.0 Vérifier l'exclusivité de session (lock)

Avant toute action — vérifier `_Inbox/.lock` :

- **Lock absent** → créer `_Inbox/.lock` (`started_at: <ISO UTC>` + `session: <id Cowork>`). Continuer.
- **Lock présent < 30 min** → refuser : `"Triage en cours, démarré à HH:mm. Réessayer après <HH:mm + 30 min>, ou supprimer manuellement _Inbox/.lock."`. Pas de modification.
- **Lock présent ≥ 30 min** → orphelin (session crashée). Supprimer, recréer, signaler dans récap.

Mode dry-run : pas de lock. Fin de traitement → supprimer le lock (§ 3.15).

### 3.1 Lister toutes les sources

Scanner les 7 sources actives. Lister avec timestamp. **Source vide → noter explicitement dans le récap** (section "Sources scannées").

### 3.1bis Principe anti-doublon Plaud (réimport Zapier)

Zapier réimporte parfois un Plaud déjà traité. **La détection ne scanne PAS `_Inbox/_Traité/`** (dossier qui grossit sans limite). Elle se fait **à l'écriture, contre la destination** (§ 3.5).

Principe : un Plaud déjà traité a forcément déposé son contenu dans sa fiche cible (journal du jour, réunion, idée…). Avant d'écrire, on regarde si ce contenu exact y est déjà :

- **Contenu exact déjà dans la destination** → doublon de réimport. Ne pas réécrire. Quarantaine `_Inbox/_Traité/<original>_dup_YYYYMMDD-HHmm.md`. Signaler (section "Doublons").
- **Contenu proche mais différent** au même créneau → conflit Plaud (re-transcription ?). Signaler "Anomalies" (§ 3.5 gère le `## HHhMM (2)`).
- **Rien dans la destination** → traitement standard.

`_Inbox/_Traité/` est une **archive de quarantaine**, jamais relue pour le dédoublonnage.

### 3.2 Apparier les fichiers liés

- Photos ↔ notes Plaud : ±30 min, élargi à ±2 h si zéro match et une seule note candidate.
- Vocaux ↔ notes A classifier : ±30 min.
- Photos du jour ↔ journal du jour : si journal `04. Journal/YYYY/MM/YYYY-MM-DD.md` existe ou va être créé.
- **Rafale de photos (±5 min)** : grouper, rattacher la rafale au même point. Une question, pas N.
- Orphelins purs : marquer pour § 3.7.

### 3.3 Classifier chaque note (Plaud + A classifier)

Appliquer **arbre de décision § 5.2** (table complète là-bas — ne pas dupliquer).

Indices forts : *"ce matin / aujourd'hui / je suis / j'ai fait"* + Plaud daté → Journal du jour ; personne identifiable + date → Journal du jour + propagation contact/projet (§ 3.11) ; doute → A classifier/ + signaler.

### 3.4 Nettoyer le transcript Plaud

- **Mono-speaker** : virer tous les labels (`Speaker N:`, `Thomas:`).
- **Multi-speakers** (réunion) : garder + normaliser (noms si identifiables, sinon labels bruts + signaler).
- Virer timestamps secondaires (`[00:01:23]`).
- Garder texte intégral, zéro reformulation.

### 3.5 Écrire dans la destination

> **Vérification anti-doublon (§ 3.1bis)** : chaque cas inclut un contrôle « ce contenu est-il déjà dans la destination ? ». C'est LE mécanisme de dédoublonnage Plaud — il remplace tout scan de `_Inbox/_Traité/`.

#### Cas Plaud journal

1. Ouvrir/créer `04. Journal/YYYY/MM/YYYY-MM-DD.md`.
2. Calculer la section `## HHhMM` (heure Plaud convertie UTC→Paris).
3. **Vérifier si la section `## HHhMM` existe déjà** :
 - Contenu strictement identique → **doublon de réimport**. Ne rien écrire. Quarantaine `_dup_`, signaler (section "Doublons").
 - Contenu proche mais différent → `## HHhMM (2)` + signaler conflit ("Anomalies").
 - Section absente → écrire normalement (étape 4).
4. Coller le transcript nettoyé.
5. Photos appariées → § 3.5b → `04. Journal/YYYY/MM/images/YYYY-MM-DD-N.{ext}`, embed sous `## Photos`.

#### Frontmatter journal (si nouveau)

```yaml
---
type: journal
date: YYYY-MM-DD
tags: [journal]
voyage: "[[YYYY-MM - Destination]]" # si voyage actif uniquement
---
```

#### Cas autres destinations

1. **Vérifier le doublon avant de créer/compléter** : ouvrir la fiche cible candidate (idée / learning de cette date et ce sujet). Si ce contenu Plaud exact y est déjà → doublon de réimport, ne rien écrire, quarantaine `_dup_`, signaler "Doublons". Sinon → continuer.
2. Créer ou compléter la fiche cible (jamais remplacer — cf. § 5.8).
3. Photos & vidéos → § 3.5b vers dossier pièces jointes adjacent : Journal → `images/` ; Voyage / autres → `Pièces jointes/`.
4. Embed `![[chemin/photo.jpg]]` ou `![[chemin/video.mp4]]`. Vidéos traitées comme photos.
5. Vocal apparié → idem, mentionner durée.

#### Frontmatter par type d'objet créé

| Type | Champs obligatoires |
|---|---|
| `journal` | `type, date, tags` (+ `voyage` si applicable) |
| `voyage` | `type, mode, statut, destination, date_début, date_fin, participants, journaux, tags, date_mise_a_jour` |
| `idee` | `type, date, titre, tags, date_mise_a_jour` |
| `learning` | `type, titre, auteur, format, date_lecture, tags, date_mise_a_jour` |
| `contact` | `type, nom_complet, role, contexte, premiere_mention, derniere_mise_a_jour, sources, tags` |
| `projet` | `type, statut, date_debut, porteur, parties_prenantes, tags, date_mise_a_jour` |

Structures complètes : templates `08. Outils/Templates/` (§ 5.7).

#### 3.5b — Procédure Drive API (copie + renommage binaires)

1. `search_files` `title = '<dossier>' and mimeType = 'application/vnd.google-apps.folder'` → fileId source.
2. `search_files` `parentId = '<sourceId>'`, `pageSize=100`, `excludeContentSnippets=true` → liste fichiers. **Si >100** : `nextPageToken` et paginer.
3. Idem cible (cascade `04. Journal` → `YYYY` → `MM` → `images`).
4. Trier par jour puis `createdTime` ASC, attribuer N=1,2,3...
5. `copy_file(fileId=<src>, title="YYYY-MM-DD-N.<ext>", parentId=<tgt>)`. Bulk-friendly (15-20 en parallèle).

### 3.6 Transcrire les vocaux

1. Haiku 4.5 — *"Transcris fidèle, sans reformuler. Inaudible → `[inaudible]`."*
2. Apparié → ajouter dans la note sous `## Transcription vocal du HHhMM`.
3. Orphelin → créer `_Inbox/A classifier/YYYY-MM-DD_HH-mm - Vocal transcrit.md`, classifier (§ 3.3).
4. < 2 s sans contenu → quarantaine, signaler.
5. Déplacer `.ogg` vers `_Inbox/_Traité/`.

### 3.7 Photos/vidéos orphelines

- **Détecter rafales** (±5 min) — traiter en bloc, une question pour le groupe.
- Lister rafales + isolés avec timestamp dans le récap.
- Demander à quoi rattacher.
- Garder dans `_Inbox/Photos/` tant que non décidé.
- Exception sujet identifiable (plats, immo, projet `hot-context`) → proposer, attendre validation.

### 3.8 Traiter `_Inbox/Documents/`

- Pièce admin → router selon CLAUDE.md, `Workflow Admin` si besoin.
- Document projet → `02. Projets/.../Documents/`.
- Ambigu → laisser, signaler.

### 3.9 Traiter `_Inbox/A classifier/`

- Classifier via § 3.3, ranger.
- Toujours ambigu → laisser, signaler raison.

### 3.10 Traiter Todo.md > ## Inbox

**Horizons temporels (définition stricte)** :
- `Aujourd'hui` = J ou J+1 (24h).
- `Cette semaine` = J+2 à J+7 (7 jours glissants).
- `Ce mois` = J+8 à J+30.
- `Planning futur` = > 30 jours.
- `Un jour` = pas d'échéance.

Règles :
- Action **datée** → bucket horizon.
- Action **sans date** → `Un jour` avec tag domaine.
- **Idée, pas action** → `02. Projets/00. Idées/YYYY-MM-DD - Titre.md` + supprimer de Todo.
- **Récurrent** → section `Récurrents` avec `ð every ...`.
- **Doublon** → supprimer + signaler.

Ne JAMAIS reformuler. Compléter (date, tag, contexte).

### 3.11 Propager (premier niveau)

- Note de rencontre (personnes identifiables) → propager la substance vers la section `## Historique` de chaque fiche contact, et vers la fiche projet si applicable. Transcript brut conservé dans le journal du jour.
- Action items détectés dans une note de rencontre → `Todo.md` avec source `(cf. [[YYYY-MM-DD]])`.
- Personne mentionnée → cf. § 3.17 (matching anti-doublon).
- Décision impactant la semaine → proposer MAJ `hot-context.md`.
- Nouvelle skill régulière → proposer création du dossier skill.
- Bonne adresse → cf. § 5.13.

Cascades de second niveau → § 5.10.

### 3.12 Quarantaine

Déplacer chaque source traitée vers `_Inbox/_Traité/`. Pas de suppression. **Dry-run : pas de déplacement.**

### 3.13 Validation post-traitement

Avant le récap, contrôler :
1. **Count croisé** : `sources_scannées = traités + ambigus + anomalies + doublons + déplacés vers _Traité`. Écart → ligne "Anomalies".
2. **Couverture des 7 sources** : le récap traite bien les 7, pas seulement les 5 dossiers `_Inbox/` — `A classifier/` et `Todo > Inbox` inclus.
3. **Spot-check photos** : pour chaque jour avec photos, vérifier (via `search_files`/Glob) qu'au moins 1 photo cible existe physiquement. Manquant → anomalie.
4. **Frontmatter** : fiches créées → champs obligatoires (§ 3.5) présents. Manquant → anomalie.
5. **Aucune fiche corrompue** : pas de section écrasée, frontmatter intact.

### 3.14 Produire le récap

Livrer le récap structuré (§ 4). Toujours, même sans anomalie.

### 3.15 Supprimer le lock

Si pas dry-run et lock créé en § 3.0 : supprimer `_Inbox/.lock`. Échec → signaler anomalie, traitement quand même terminé.

### 3.16 Transition cycle de vie projet

#### A. Voyage `À venir/` → `Passés/`

Critère : `date_fin < aujourd'hui`.
1. Proposer à Thomas : "[[YYYY-MM - Destination]] a date_fin passée. Migration + bilan ?"
2. Sur validation : renommer ancien en `_OLD_`, créer nouveau depuis `Bilan voyage.md`, démouler l'ancien dans annexe `<details>`, supprimer le `_OLD_` après validation visuelle.
3. **Zéro invention** : sections sans matière → `_(à compléter avec Thomas)_`.

#### B. Projet `en cours` → `terminé`

Critère : `statut: en cours` + signal de clôture ("terminé"/"signé"/"livré") ou demande Thomas.
1. Demander à Thomas. 2. Sur validation : template `Bilan projet.md`.

#### C. Projet `en cours` → `abandonné` / `échoué`

Critère : mention explicite d'arrêt.
1. Toujours valider (sensible). 2. Template `Post-mortem.md`. Causes racines JAMAIS supposées — Thomas les fournit.

### 3.17 Création / MAJ fiche contact (matching anti-doublon)

#### Normalisation

Accents, casse, espaces multiples retirés. Prénom + nom complet si dispo.

#### Anti-doublon dans `07. Contacts/`

1. **Match exact** sur `nom_complet` (insensible casse/accents).
2. **Match flou Levenshtein ≤ 2** : `Dupont` vs `Dupond` (1), `Naomie` vs `Noémie` (1 après norm).
3. **Prénom seul** + plusieurs candidats → prendre le plus actif, demander confirmation.

#### Décisions

- Exact → MAJ fiche (historique, `derniere_mise_a_jour`, `sources`).
- Flou → ne pas créer, demander Thomas.
- Pas de match + 1ère mention → stub minimal.
- Pas de match + 2ème mention → fiche complète (`Historique contact.md`).

#### Frontmatter contact

```yaml
---
type: contact
nom_complet: <Prénom Nom>
role: <rôle si déductible>
contexte: <projet principal>
premiere_mention: YYYY-MM-DD
derniere_mise_a_jour: YYYY-MM-DD
sources: ["[[YYYY-MM-DD]]"]
tags: [contact]
---
```

#### Catégorie

`07. Contacts/01. Famille/`, `02. Amis/`, `03. Pro/`, `04. Médical/`, `05. Admin/`, `06. Prestataires/`. Demander si pas évident. Sans accents.

### 3.18 Propagations en cascade

Effets domino entre fiches. Détecter et **signaler** dans le récap (jamais en silence). Cf. § 5.10.

## 4. Output

### Modifications vault

- Fiches créées ou complétées.
- Photos & vidéos copiées (Journal → `images/`, autres → `Pièces jointes/`).
- Vocaux transcrits.
- Tâches propagées dans `Todo.md` (hors Inbox).
- Contacts créés/MAJ avec matching documenté.
- Transitions cycle projet appliquées (toujours après validation).
- Cascades signalées (jamais en silence).
- Suggestions MAJ `hot-context.md` (jamais appliquées sans validation).

### Quarantaine

Sources traitées → `_Inbox/_Traité/`. Réversible. **Dry-run : aucune action.**

### Récap (livrable principal)

```
## Traitement inbox du YYYY-MM-DD HH:mm

[Si dry-run :]
**Mode : dry-run — aucune modification appliquée.**

**Bilan** : X notes traitées · Y photos appariées · Z vocaux · A items Todo Inbox migrés · B ambigus · C transitions cycle projet · D contacts (créés/MAJ) · E doublons.

### Sources scannées
- _Inbox/Plaud/ : 3 fichiers
- _Inbox/Photos/ : 12 fichiers (dont 2 rafales)
- _Inbox/Voice/ : vide
- _Inbox/Notes/ : vide
- _Inbox/Documents/ : 1 fichier
- _Inbox/A classifier/ : 1 fichier
- Todo.md > Inbox : 4 lignes

### Traités
- ...

### Doublons (Plaud réimportés)
- ...

### Photos/vidéos non appariées
- ...

### Vocaux à valider
- ...

### Ambigus (laissés dans A classifier/)
- ...

### Transitions cycle projet
- ...

### Contacts (créés / MAJ)
- ...

### Cascades proposées
- ...

### Anomalies
- ...
```

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention** — `[À CONFIRMER]` + signaler.
2. **Compléter ≠ remplacer** — append ou patch ciblé (§ 5.8). Conflit → signaler.
3. **Quarantaine avant suppression** — `_Inbox/_Traité/`, jamais delete direct.
4. **Ambigu = `A classifier/`** — jamais de classement forcé.
5. **Zéro reformulation transcript Plaud** — nettoyer, pas réécrire.
6. **Zéro reformulation vocaux** — mot pour mot, `[inaudible]` si besoin.
7. **Pas de modification silencieuse** — refonte → fiche maître + sync skill + repackage `.skill`.
8. **Transitions cycle projet et création contact** — toujours validation Thomas.
9. **Cascades** — toujours signalées, jamais appliquées sans validation.
10. **Conventions transverses** (accents, contacts, pièces admin) → se référer à CLAUDE.md.
11. **Lock toujours nettoyé** — fin de traitement (succès) ou démarrage suivant (orphelin). Pas de blocage permanent.

### 5.2 Arbre de décision — classification d'une note

| Indice | Type | Destination |
|---|---|---|
| *"ce matin", "aujourd'hui", "j'ai fait", "je suis", "ce soir"* + Plaud daté | **Journal** | `04. Journal/YYYY/MM/YYYY-MM-DD.md` (section `## HHhMM`) |
| Personne(s) identifiable(s) + date | **Rencontre** | Transcript brut → journal du jour (`## HHhMM`) + propagation fiches contacts (`## Historique`) et projet (§ 3.11). Plus de note de réunion autonome. CR formel d'entité → skill `cr-reunion`. |
| Principe / concept structuré | **Idée** | `02. Projets/00. Idées/YYYY-MM-DD - Titre.md` |
| Référence livre/film/podcast/article | **Learning** | `02. Projets/01. Perso/Skills/Culture/Fiches de lecture/[Type] Titre.md` — ou `Skills/[Famille]/Fiches de lecture/` si lié à une skill pratiquée (template `Fiche lecture.md`) |
| Méthode personnelle | **Méthode** | `02. Projets/01. Perso/Skills/Culture/Methodes/Titre.md` |
| Recette / plat | **Cuisine** | `02. Projets/01. Perso/Skills/Cuisine/Recettes/Nom du plat.md` |
| Destination voyage | **Voyage** | `02. Projets/01. Perso/Voyages/[À venir\|Passés]/YYYY-MM - Destination.md` (template `Bilan voyage.md`) |
| Bonne adresse (3+ fois) | **Bonne adresse** | cf. § 5.13 |
| Mention skill active | **Session** | `02. Projets/01. Perso/Skills/[Famille]/[Skill]/[Sessions\|Fiches de lecture]/...md` |
| Note projet existant | **MAJ projet** | `02. Projets/.../Nom.md` (§ 5.8) |
| Note contact existant | **MAJ contact** | `07. Contacts/.../Prenom Nom.md` (§ 3.17) |
| Pièce admin | **Admin** | Tableau "Où ranger quoi" de CLAUDE.md |
| Aucun match | **A classifier** | `_Inbox/A classifier/` + signalement |

**Cas limite — première mention** : contact nouveau → § 3.17 ; projet nouveau → pas de fiche auto, signaler.

### 5.3 Critères de qualité

- Bilan chiffré exact.
- Sources scannées listées même si vides — les 7.
- Count croisé bouclé (§ 3.13) : `traités + ambigus + anomalies + doublons = total scanné`.
- Spot-check photos OK : chaque jour avec photos a au moins 1 cible vérifiée sur disque.
- Aucune fiche corrompue.
- Aucune tâche reformulée.
- Toutes transitions cycle projet validées par Thomas.
- Tous contacts documentent leur match.
- Lock supprimé en fin de traitement.
- Pas de drift `Workflow Inbox.md` / SKILL.md / `.skill` packagé.

### 5.4 Exemple — récap complet

Voir `08. Outils/Workflows/Workflow Inbox.md` § 5.4 pour un exemple complet sur une semaine type (voyage Madère, mai 2026, avec 1 doublon Plaud).

### 5.5 Maintenance

- Nouvelle source d'inbox → MAJ § 2 + § 3.
- Nouveau type de contenu → MAJ arbre § 5.2.
- Nouveau template → ajouter à `08. Outils/Templates/`, référencer § 5.7 et § 3.5/3.16.
- Modification structurelle → fiche maître `08. Outils/Workflows/Workflow Inbox.md` en premier, puis sync ce SKILL.md, puis regénérer `.skill`.
- Câblage Anya `/inbox` → MAJ § 1 quand fait.
- Migration vault hors Google Drive → fallback `08. Outils/Scripts/copier-photos-inbox.py`.

### 5.6 Changelog skill

- **v5.1 (2026-05-21)** — Adaptation à la dissolution de `05. Notes` et `06. Réunions`. Source `A classifier` → `_Inbox/A classifier/`. Destinations : Idées → `02. Projets/00. Idées/`, Learnings → `Skills/Culture/Fiches de lecture/`, Méthodes → `Skills/Culture/Methodes/`, Recettes → `Skills/Cuisine/Recettes/`. Catégorie « Réunion » supprimée : note de rencontre → journal du jour + propagation contacts/projet ; CR formel d'entité → skill `cr-reunion`.
- **Patch dédoublonnage (2026-05-20 soir)** — Le dédoublonnage Plaud ne scanne plus `_Inbox/_Traité/` (dossier qui grossit sans limite). Il se fait à l'écriture, contre la destination (§ 3.1bis + § 3.5). `_Traité/` redevient une archive jamais relue. Ajout § 3.13 "couverture des 7 sources". Origine : 1er run réel de la skill (suggestion Thomas).
- **v5 (2026-05-20)** — Refonte post-revue externe : corrections critiques (dédup classification, horizons Todo, rafale photos), corrections moyennes (frontmatter par type, vidéos, matching contacts Levenshtein), frictions mineures. Nouvelles sections : transitions cycle projet (§ 3.16), création/MAJ contact (§ 3.17), cascades (§ 3.18, § 5.10), templates (§ 5.7), patch ciblé (§ 5.8), dry-run (§ 5.9), bonnes adresses (§ 5.13), versioning (§ 5.12). **Patches v5** : validation post-traitement (§ 3.13), lock concurrence (§ 3.0, § 3.15, § 5.14), AnyaState hors scope (§ 2), cascades juridique + admin (§ 5.10). **Consolidation** : fusion de deux v5 développées en parallèle.
- v4 (2026-05-20) — Autonomie MCP Google Drive native.
- v3 (2026-05-20) — Plaud→Journal, photos `images/`, nettoyage transcript.
- v2 (2026-05-19) — Format 5 sections.
- v1 — Workflow basique.

### 5.7 Templates par type d'objet

Source de vérité : **`08. Outils/Templates/`** (cf. `_README.md`).

| Type | Template | Déclencheur |
|---|---|---|
| Voyage clôturé | `Bilan voyage.md` | § 3.16 cas A |
| Projet clôturé (non-voyage) | `Bilan projet.md` | § 3.16 cas B |
| Projet abandonné / échoué | `Post-mortem.md` | § 3.16 cas C |
| Fiche contact | `Historique contact.md` | § 3.17 |
| Fiche lecture | `Fiche lecture.md` | § 5.2 (Learning) |

Règle : lire le template avant création, reproduire la structure, zéro invention.

### 5.8 Patch ciblé fiches existantes

**Add-only** : nouvelle section au bon endroit ; append avec préfixe `**YYYY-MM-DD** —` ; frontmatter compléter sans écraser, MAJ `date_mise_a_jour`.

**Patch ciblé** : identifier ligne par contexte ; conserver original en `<!-- était : "..." -->` si non trivial ; signaler.

**Annexe repliable (refonte majeure)** : renommer en `_OLD_`, créer nouvelle, démouler ancien dans `<details>`, supprimer `_OLD_` après validation.

**Anti-pattern** : jamais remplacement silencieux, suppression section sans validation, réécriture phrases Thomas.

### 5.9 Mode dry-run

Mots-clés § 1. Effets : aucune écriture vault, aucune quarantaine, aucun lock créé, récap avec en-tête dry-run décrivant ce qui aurait été fait.

### 5.10 Cascade de propagations

À détecter et signaler (jamais en silence).

| Source de la modification | Cascade à vérifier |
|---|---|
| Voyage migré vers `Passés/` | `Todo.md` : clôturer tâches voyage. |
| Contact MAJ avec nouveau sujet | `hot-context.md` : ajouter à "Je bouge sur" ou "J'attends". |
| Projet `statut: terminé` | `hot-context.md` : retirer. `Todo.md` : clôturer tâches liées. |
| Réunion avec décision | `hot-context.md` (décisions) + projet concerné. |
| Bonne adresse 3+ fois | cf. § 5.13. |
| Nouveau contact "avocat/notaire/prestataire" | Vérifier fiche projet liée, mentionner contact. |
| Artefact juridique signé (pacte, KBis, acte, PV) | MAJ fiche entité (`statut`, dossier `Documents/`), clôturer items Todo liés, signaler aux contacts parties prenantes. |
| Pièce admin renouvelée (CNI, passeport, permis, RIB) | Déplacer ancienne version vers `09. Administratif/99. Archive/`, MAJ frontmatter fiche identité, signaler si expiration < 6 mois. |

Format : `- Suggestion MAJ <fiche cible> : "<changement>" (déclenché par <source>).`

### 5.11 Matching contacts (référence)

§ 3.17. Seuils : exact (insensible casse/accents) → MAJ auto ; flou Lev. ≤2 → demander ; prénom seul ambigu → demander ; pas de match + 1ère → stub ; +2ème → fiche complète.

### 5.12 Versioning du workflow

- **Patch (vX.Y → vX.Y+1)** : correction doc.
- **Mineur (vX → vX.Y)** : nouvelle étape/type/source. Rétrocompatible.
- **Majeur (vX → vX+1)** : refonte, breaking. v5 = cycle projet + matching contacts + templates + cascades + lock + dédup.

Procédure : MAJ `version` + `date_mise_a_jour` → entrée changelog § 5.6 → sync `08. Outils/Workflows/Workflow Inbox.md` ↔ ce SKILL.md → repackage `.skill`. Breaking → prévenir Thomas.

### 5.13 Mécanisme bonnes adresses

- 1ère et 2ème mention : laisser dans journal/voyage source.
- **3ème mention** : intégrer la bonne adresse à la fiche bilan du voyage concerné (`02. Projets/01. Perso/Voyages/Passés/YYYY-MM - Destination.md`). Pas de dossier `Bonnes adresses/` séparé.
- Pas de duplication automatique depuis bilans voyage (décision 2026-05-20).

### 5.14 Exclusivité de session (lock)

Voir § 3.0. Principes : un seul triage actif à la fois ; lock = `_Inbox/.lock` (`started_at` ISO UTC + `session`) ; timeout 30 min → orphelin écrasé ; dry-run = pas de lock ; erreur en cours → lock conservé, signaler.

## Liens

- Source de vérité : `08. Outils/Workflows/Workflow Inbox.md`
- Templates : `08. Outils/Templates/_README.md`
- Pipeline : `08. Outils/Workflows/Workflow Journal + Photos.md`
- Mount cassé / fallback : `08. Outils/Manipulation du vault (Drive API + Zapier).md`
- Conventions vault : `CLAUDE.md` (racine)
- Briefing courant : `hot-context.md`
- Bot Telegram : `08. Outils/Anya/Anya.md`
