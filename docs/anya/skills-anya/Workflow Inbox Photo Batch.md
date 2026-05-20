---
skill: inbox-photo-batch
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~20-50/mois
modules_code:
  - src/lib/secretariat/photo/inbox-batch.ts [À CONFIRMER chemin]
  - src/app/api/telegram/webhook/route.ts
  - src/lib/secretariat/vault-client/
modeles_llm: []
trigger_principal: photo(s) envoyée(s) à Anya via Telegram (souvent en série depuis iPhone)
output_principal: photos uploadées dans `_Inbox/Photos/[YYYY-MM-DD]/`
---

# Workflow Inbox Photo Batch — batcher les photos Telegram par date, upload vault

> Source : `src/lib/secretariat/photo/inbox-batch.ts` [À CONFIRMER chemin]. Pipeline parent : webhook Telegram (`src/app/api/telegram/webhook/route.ts`). Architecture : voir `docs/ia/anya-current-architecture.md`. Leçon S13 critique : **Telegram iOS ne préserve PAS l'EXIF HEIC** → impossible de dater automatiquement.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — message Telegram photo
- Message Telegram de type `photo` envoyé par Thomas au bot Anya.
- Format : JPEG (Telegram convertit HEIC → JPEG côté iPhone iOS, mais perd l'EXIF dans le processus).
- Dispatch par signature bytes (MIME inferé).

### Variantes ciblées
- **1 photo isolée** : carte Telegram "Date de prise de vue ?" boutons (aujourd'hui / hier / date custom).
- **2+ photos en série** (intervalle < 30s [À CONFIRMER seuil]) : batch automatique sous la même date, demande date une seule fois.
- **Photo avec caption** : si Thomas ajoute un caption "rue Barbusse 2", utilisé pour suggérer un sous-dossier ou tag [À CONFIRMER comportement].

### Hors trigger
- Photos en `document` (envoyées non compressées, format original HEIC préservé) → workflow différent avec EXIF lecture native [À CONFIRMER existence].
- Photos avec déclencheur quittance loyer (rare) → workflow `rent/` dédié [À CONFIRMER].

---

## 2. Input

### Fiches à consulter en début de workflow
- **Aucune** par défaut — workflow purement d'ingestion vers `_Inbox/Photos/`.
- Si caption évoque un projet (ex. "Henri Barbusse 2"), possible lookup fiche projet pour suggestion sous-dossier [À CONFIRMER feature implémentée].

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Telegram update | `message.photo` (array de PhotoSize, prendre la plus haute résolution) | webhook update |
| Telegram File API | Binaire JPEG | `getFile` + download |
| EXIF | Perdu côté iOS (leçon S13) — non exploitable | exifr / ExifReader |

### Convention de nommage
- **Dossier** : `_Inbox/Photos/[YYYY-MM-DD]/`
- **Fichiers** : `photo_001.jpg`, `photo_002.jpg`, etc. (numérotation séquentielle dans le batch).
- Pas de renommage sémantique automatique (Thomas trie/renomme manuellement dans Obsidian).

### Outils API requis
- **Telegram Bot API** — `getFile(file_id)` → URL temporaire, download binaire.
- **Google Drive API** — `vault-client.createFile()` pour upload dans `_Inbox/Photos/[date]/`.
- **Telegram Bot API** — carte 3 boutons + dialogue date custom (via pending-store Drive TTL 7j R3).

---

## 3. Étapes

### 3.1 Ack webhook < 5s
Webhook Telegram ack immédiat. Téléchargement + carte date + upload se font dans la même request (Replit autoscale).

### 3.2 Détection batch
- À chaque photo reçue, vérifier si une session batch en cours pour ce `chat_id` (cache mémoire TTL 30s [À CONFIRMER seuil]).
- Si OUI → ajouter la photo au batch en cours, ne pas re-demander la date.
- Si NON → démarrer une nouvelle session batch + envoyer carte Telegram "Date de prise de vue ?".

### 3.3 Carte Telegram demande date
- 3 boutons standards : `Aujourd'hui` / `Hier` / `Date custom`.
- Préfixe callback `photo_date:` (R4 — handler + dispatch + test E2E).
- Pending-store Drive TTL 7j R3 : la session batch est persistée (au cas où Thomas ne répond pas immédiatement).

### 3.4 Téléchargement des photos
- Pour chaque photo du batch : `getFile(file_id)` → download JPEG.
- Stockage temporaire mémoire ou `/tmp` (pas de persistance long-term hors vault).

### 3.5 Upload Drive
- Lookup ou création du sous-dossier `_Inbox/Photos/[YYYY-MM-DD]/` via `vault-client` :
  - `searchByName()` pour vérifier existence.
  - `createFolder()` si absent.
- Pour chaque photo : `createFile()` avec nom `photo_NNN.jpg` (incrément séquentiel selon contenu existant du dossier).
- Pas de PATCH in-place ici (création de nouveaux fichiers, pas modification).

### 3.6 Confirmation Telegram
- Message court à Thomas : "X photo(s) uploadée(s) dans _Inbox/Photos/[date]/" + lien Drive dossier.

### 3.7 Date custom (si bouton cliqué)
- Thomas répond avec date au format libre ("12/05/2026" / "samedi" / "2 mai").
- Parsing date par regex + heuristique (pas de LLM nécessaire pour économie tokens [À CONFIRMER]).
- Si parsing ambigu → re-demande à Thomas (format strict).

---

## 4. Output

### Modifications vault
1. **Sous-dossier date** créé dans `_Inbox/Photos/` si absent.
2. **Photos JPEG** uploadées avec nom séquentiel `photo_NNN.jpg`.

### Quarantaine
- Si upload Drive échoue (rate limit, quota) → retry x1 puis warn Telegram à Thomas. Photos en mémoire perdues si pas de retry réussi [À CONFIRMER stratégie : persister temporairement le buffer ?].
- Si Thomas ne répond pas à la date dans la session TTL → photos uploadées sous date du jour avec tag warning, ou perdues [À CONFIRMER comportement par défaut].

### Récap (gabarit Telegram envoyé à Thomas)
```
[X] photo(s) ajoutée(s) à _Inbox/Photos/[YYYY-MM-DD]/

Dossier : [lien Drive]

Pense à les déplacer/renommer dans le bon projet vault.
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS inventer une date EXIF** (leçon S13 — Telegram iOS perd l'EXIF). Toujours demander à Thomas ou défaut explicite "date du jour".
- **JAMAIS perdre une photo** — retry upload obligatoire, ou notification d'échec explicite à Thomas (pas de silent fail).
- **JAMAIS écraser un fichier existant** — utiliser numérotation incrémentale (`photo_001`, `photo_002`...) avec scan dossier existant.
- **JAMAIS uploader hors `_Inbox/Photos/`** — Thomas déplace lui-même vers le bon projet ensuite (séparation des responsabilités).
- **JAMAIS hardcoder le fileId du dossier `_Inbox/Photos/`** (R7 P1 #101) — résolution dynamique via `searchByName()` ou `findByPath()`.

### 5.2 Arbre de décision — batch vs photo isolée
```
Photo reçue Telegram
├── Session batch en cours pour ce chat_id (TTL 30s) ?
│   ├── OUI → ajouter au batch en cours, pas de re-demande date
│   └── NON → démarrer session batch + carte 3 boutons "Date ?"
└── Sur callback date :
    ├── Aujourd'hui → upload _Inbox/Photos/[today]/
    ├── Hier → upload _Inbox/Photos/[today-1]/
    └── Date custom → dialogue Thomas → parsing → upload _Inbox/Photos/[date]/
```

### 5.3 Critères de qualité
- **G1 (zéro photo perdue)** : retry upload + notification explicite si échec.
- **G2 (date explicite)** : toute photo uploadée a une date Thomas-validée (jamais auto-EXIF iOS qui n'existe plus).
- **G3 (batch efficace)** : 2+ photos en < 30s ne génèrent qu'UNE seule carte "Date ?".
- **G4 (numérotation safe)** : pas d'écrasement de fichier existant (`photo_001` déjà présent → `photo_002`).

### 5.4 Exemple complet (cas réel)
**Input Telegram** : Thomas envoie 5 photos d'un appartement en visite, intervalle < 5s entre chaque.

**Pipeline** :
1. Photo 1 reçue → pas de session en cours → démarrage batch + carte Telegram "Date ?" boutons `Aujourd'hui / Hier / Date custom`.
2. Photos 2-5 reçues dans la foulée → ajoutées au batch en cours (session TTL 30s OK), pas de re-demande.
3. Thomas clique `Aujourd'hui` 8 secondes après la photo 5.
4. Anya vérifie : `_Inbox/Photos/2026-05-20/` n'existe pas → créé via `createFolder()`.
5. Upload séquentiel : `photo_001.jpg`, `photo_002.jpg`, `photo_003.jpg`, `photo_004.jpg`, `photo_005.jpg`.
6. Message Telegram : "5 photos ajoutées à _Inbox/Photos/2026-05-20/. [lien Drive]".

### 5.5 Maintenance
- **Seuil batch** : 30s [À CONFIRMER] — ajustable selon usage Thomas (si batches plus longs, augmenter).
- **TTL session batch** : 30s en cache mémoire. Si Thomas envoie 6e photo après 35s → nouvelle session (donc re-demande date).
- **Politique date par défaut si Thomas ne répond pas** : [À CONFIRMER — date du jour automatique après TTL pending ? archivage `_Inbox/Photos/_orphelines/` ?].
- **Évolution iOS** : si Apple/Telegram restaurent l'EXIF HEIC un jour, ce workflow pourra basculer en datation automatique (lire EXIF avant de demander Thomas).
- **Tests** : couverture minimale (photo isolée / batch 5 photos / date custom / nom collision) [À CONFIRMER suite test].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S13 | — | Leçon critique : Telegram iOS perd l'EXIF HEIC → ne plus tenter datation auto, toujours demander Thomas [À CONFIRMER verbatim]. |
| S? | — | Mise en production batch + carte 3 boutons [À CONFIRMER session origine]. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~20-50 photos/mois (visites immo, photos de pièces administratives, etc.). Coût négligeable (pas de LLM impliqué).

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/photo/inbox-batch.ts` ?
- [À CONFIRMER] Seuil temporel batch : 30s ? 60s ?
- [À CONFIRMER] Comportement si caption Thomas évoque un projet (suggestion sous-dossier ou tag — implémenté ?).
- [À CONFIRMER] Stratégie sur upload échec : persister buffer temporaire ou notifier perte ?
- [À CONFIRMER] Comportement si Thomas ne répond pas à la date dans TTL pending : date du jour par défaut ou archivage spécial ?
- [À CONFIRMER] Préfixe callback Telegram `photo_date:` — handler + dispatch + test E2E (R4) existants ?
- [À CONFIRMER] Workflow différent pour photos en `document` (HEIC préservé) ?
- [À CONFIRMER] Verbatim leçon S13 sur perte EXIF Telegram iOS.
- [À CONFIRMER] Suite de tests dédiée photo batch.
