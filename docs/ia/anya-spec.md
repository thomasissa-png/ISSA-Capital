# Anya — Bot Telegram secrétariat ISSA Capital

> Fiche technique partageable. Source de vérité pour tout autre Claude (Cowork, Desktop, autre repo) qui doit comprendre ou faire évoluer Anya.
> Dernière mise à jour : 2026-05-12 (session 13 — workflows inbox-photo-batch + inbox-message-router).

---

## Identité

**Nom** : Anya
**Rôle** : Secrétariat IA personnel de Thomas Issa (Président ISSA Capital)
**Interface** : Bot Telegram (1 conversation privée avec Thomas)
**Statut** : En production depuis session 9 (2026-04-09)

## Stack technique

| | |
|---|---|
| Runtime | Node.js / TypeScript strict |
| Framework | Next.js 14 App Router (API route webhook) |
| LLM | Anthropic SDK — **Sonnet 4.6** (CR, qualité critique) + **Haiku 4.5** (router inbox, économie) |
| Validation | Zod (schémas Telegram + Claude responses) |
| Stockage | Google Drive (OAuth2 refresh token, scope `drive + calendar.events`) + JSON files persistés (conversation, drafts, contacts, compteur référence) |
| PDF / DOCX | PDFKit (CR, quittance, fin de bail) + docx (bail meublé) |
| EXIF photos | exifr (JPEG) + ExifReader (HEIC) — détection par signature bytes, pas par MIME |
| Tests | Vitest — **511/511 passent** |
| Hébergement | Replit |

## Architecture globale

**Webhook unique** : `POST /api/telegram/webhook` reçoit toutes les updates Telegram (messages texte, photos, vocaux, documents, vidéos, callbacks de boutons inline).

**Router 5 niveaux** pour les messages texte (priorité descendante) :

```
Texte reçu
   ↓
1. Commande slash (/cr, /quittance, /bail, /findebail, /candidat, /inbox, /cancel, /status)
2. Workflow actif (CR, quittance, bail, findebail, candidat) → handler du workflow
3. Batch photo en attente de date → interprété comme date du batch
4. Texte ≥ 100 chars → auto-CR (workflow CR démarré automatiquement)
5. Texte < 100 chars → router Calendar/Todo (carte preview + boutons inline)
   └─ fallback si Claude échoue : note Drive _Inbox/Notes/
```

Cette priorité **garantit zéro confusion** entre photos, CR, tâches Calendar/Todo et workflows actifs.

## Concept clé : Mode vs Workflow

| | **Mode `inbox`** (état par défaut) | **Workflow** (CR, quittance, bail, etc.) |
|---|---|---|
| État | Stateless mais peut bufferiser (photos, router) | Machine à états (3-8 steps + TTL 24h) |
| Validation | Boutons inline pour photos et texte court | Boutons inline Valider/Modifier/Annuler |
| Livrable | Fichier brut → Drive `_Inbox/` OU Google Calendar OU Todo.md | PDF/DOCX/MD → Drive entité |
| API Claude | Haiku 4.5 (router uniquement) | Sonnet 4.6 |
| Coût | ~1 €/an (router Haiku) | ~12 €/an (CR Sonnet) |

**Un seul workflow actif par chat à la fois.** Quand il termine ou est annulé → retour mode inbox automatique.

## Commandes disponibles (8)

| Commande | Effet |
|---|---|
| `/start` | Message de bienvenue, vérifie whitelist |
| `/cr` | Force le workflow CR (compte-rendu de réunion) |
| `/quittance` | Démarre le workflow quittance de loyer (batch N×M) |
| `/bail` | Démarre le workflow bail meublé (DOCX + PDF, 24 sections juridiques) |
| `/findebail` | Démarre le workflow attestation de fin de bail (PDF) |
| `/candidat` | Démarre le workflow fiche candidat locataire (.md) |
| `/status` | Affiche le mode actuel + workflow actif + photos en attente |
| `/inbox` | Force retour mode inbox + clear workflow actif + cancel batch photo |
| `/cancel` | Annule le workflow en cours + cancel batch photo, retour inbox |

## Menu commandes Telegram (auto-maintenu)

Le menu auto-complétion Telegram (suggestions quand Thomas tape `/`) est synchronisé automatiquement depuis le code via l'endpoint `/api/telegram/setup`.

**Fonctionnement** : chaque workflow dans `workflows/registry.ts` déclare `command` et `commandDescription`. L'endpoint `/api/telegram/setup` lit le registry, ajoute les commandes système (`/status`, `/inbox`, `/cancel`), et appelle l'API Telegram `setMyCommands`.

**Comment ajouter une nouvelle commande** :
1. Dans le nouveau workflow, ajouter `command` et `commandDescription` dans l'objet Workflow
2. Enregistrer dans `workflows/registry.ts`
3. Redéployer sur Replit
4. Visiter `https://issa-capital.com/api/telegram/setup?token=<ADMIN_SETUP_TOKEN>` (page verte = OK)

## Comportement par type de message — Mode inbox

| Type entrant | Action | Livrable |
|---|---|---|
| **Photo** (1+) en mode inbox | **Bufferise + demande la date à Thomas** (workflow `inbox-photo-batch`, fenêtre 5s) | `_Inbox/Photos/` avec date choisie dans le nom |
| **Texte < 100 chars** | **Router Calendar/Todo** (workflow `inbox-message-router`, carte preview + 3 boutons) | Google Calendar OU `Todo.md > ## Inbox` |
| **Texte ≥ 100 chars** | Auto-CR (workflow CR démarré automatiquement) | PDF CR + référence `IC-CR-YYYY-XXXX` |
| **Vocal** | Transcription Haiku 4.5 native (audio input) puis idem router | Selon contenu |
| **Document** (PDF, image en mode fichier, ...) | Routage par MIME : image → workflow photo batch ; autres → `_Inbox/Documents/` | Drive |
| **Vidéo** | Workflow photo batch (même dossier Photos) | `_Inbox/Photos/` |
| **Sticker/GIF** | Type non supporté | Réponse explicite |

### Workflow `inbox-photo-batch` (Session 13)

**Pourquoi** : Telegram iOS strip systématiquement les EXIF des photos HEIC lors de l'envoi "Send as file" (conversion HEIC→JPEG côté client, perte des métadonnées avant arrivée webhook). Impossible d'extraire la date de prise de vue depuis le buffer reçu. **Solution** : abandonner l'extraction EXIF et demander la date à Thomas.

**Flux** :
1. Thomas envoie 1+ photo(s) en mode inbox (peu importe HEIC/JPEG, mode photo/fichier)
2. Anya bufferise en RAM, attend **5 secondes** après la dernière photo
3. Fin de fenêtre → Anya envoie message + boutons : `[1️⃣ Aujourd'hui] [2️⃣ Hier] [3️⃣ Autre date]`
4. Thomas répond "1", "2", "12/05/2026", "12 mai 2026" (formats flexibles)
5. Anya upload toutes les photos avec cette date dans le nommage
6. Confirmation Telegram : "✅ N photos enregistrées avec la date X"

**Garde-fous** :
- Photo arrivée pendant l'état waiting → ajoutée au batch + message "+1 photo, batch=X"
- Timeout 5 min sans réponse → auto-apply aujourd'hui (rien de perdu)
- Workflows existants (CR, quittance, etc.) prioritaires : photos consommées par le workflow actif si actif

### Workflow `inbox-message-router` (Session 13)

**Pourquoi** : permettre à Thomas d'envoyer une phrase courte type "sortie enfants aquaboulevard le 12/05/2026" et qu'Anya la transforme soit en événement Google Calendar, soit en tâche Todo.md.

**Flux** :
1. Thomas envoie un texte < 100 chars (ou un vocal) en mode inbox
2. Si vocal → Claude Haiku 4.5 transcrit nativement (input audio supporté)
3. Claude Haiku 4.5 extrait un JSON : `{ titre, date (YYYY-MM-DD), heure (HH:MM), lieu, description }`
4. Anya répond avec carte preview + boutons : `[📅 Google Calendar] [📋 Tâches inbox] [✗ Annuler]`
5. Thomas clique :
   - **Calendar** → événement créé dans `thomas.issa@gmail.com` primary calendar
   - **Tâches** → ligne ajoutée dans `Todo.md > ## Inbox` du vault Drive
   - **Annuler** → cleanup, "✗ Annulé"

**Résolution date FR supportée** (validé empiriquement via `scripts/test-haiku-dates.ts`) :
- Mots-clés : "demain", "après-demain", "ce vendredi", "vendredi prochain", "dans 3 jours", "dans 2 semaines", "aujourd'hui"
- Dates explicites : "12/05/2026", "12 mai 2026", "le 25 juin"
- Heures : "14h30", "à 9h", "midi", "18h", "8h du matin"
- Vague (retourne null, pas d'invention) : "matin", "après-midi", "ce soir" seuls

**Coût** : ~5 calls Haiku/jour ≈ 0,08 €/mois.

## Comportement par type de message — Workflow CR

**Démarrage** :
- Auto si **texte ≥ 100 caractères** sans workflow actif (préférence Thomas, ajustable)
- Manuel via `/cr`

**Machine d'états CR** : `collecting` → `pending_photos` → `pending_validation` → `validated` (FIN) OU `cancelled` (FIN)

**Cycle complet** :
1. Thomas dicte son CR (texte ou vocal) + ajoute photos optionnelles
2. Anya appelle Claude (Sonnet 4.6) avec web search → génère le CR structuré
3. Anya peut poser des clarifications multi-tours
4. Quand ready → preview CR + "des photos à joindre ?"
5. Validation par boutons inline
6. Génération PDF (PDFKit A4 + annexes photos)
7. Référence attribuée : `IC-CR-YYYY-XXXX` (compteur persisté)
8. Upload PDF vers Drive (dossier de l'entité : IC / GO / VI / VV)
9. Sauvegarde historique + cleanup
10. Retour mode inbox

## Comportement par type de message — Workflow Quittance (batch N×M)

**Démarrage** : `/quittance`

**Machine d'états** : `selecting_locataires` → `selecting_periode` → `confirming_recap` → `generating` → `done` | `error`

**Mode batch** : une seule invocation peut produire N locataires × M mois = N×M PDFs.

**Sélection locataires** : numéros (`1,3,5`), plage (`1-5`), tous (`tous` / `*`), ou recherche futée par nom (tolérance accents, typos, Levenshtein ≤ 2).

**Sélection période** : mois unique (`2026-05`, `mai 2026`), liste, plage (`2026-04 à 2026-08`), trimestre (`T2 2026`), année, ou relatif (`mois en cours`, `mois dernier`). Max 24 mois.

**PDF** : A4, structure légale conforme (références loi 89-462 + 2014-366), date "Fait à Nanterre, le 03 du mois de la quittance" (Session 13 : fix bug `mois suivant` → mois courant).

**Variables d'environnement optionnelles** :
- `DRIVE_QUITTANCES_FOLDER_ID` — ID du dossier parent des quittances
- `DRIVE_VAULT_ROOT_ID` — ID du dossier racine vault Obsidian (pour fiches locataires)

## Comportement par type de message — Workflow Bail (Session 12)

**Démarrage** : `/bail`

**Sourcing** : depuis `_Candidats/` (fiches candidat .md créées via `/candidat`) **OU** "Nouveau profil" pour saisie manuelle. Session 13 : fix bug, plus de proposition des locataires actuels (qui ont déjà un bail).

**6 étapes** : sélection candidat/profil → bien → durée → montants → garanties → confirmation.

**Livrables** : **DOCX + PDF** d'un bail meublé complet (24 sections juridiques), upload Drive `05. Locataires/01. Actuels/<nom>/Bail/`.

**Décisions juridiques en attente** (Thomas) :
- Encadrement loyers : valeurs €/m² Nanterre + Paris 18 (P0)
- IRL : automatique via API INSEE ou saisie manuelle (P0)
- Clause pénale : 3x (dissuasif, réductible) ou 1x (défensible) (P1)

## Comportement par type de message — Workflow Fin de bail (Session 12)

**Démarrage** : `/findebail`

**Livrable** : attestation PDF 1 page (références loi 89-462, état des lieux, restitution dépôt).

**P0 #4 appliqué Session 12** : clause dépôt corrigée. **P1 en attente** : mention "quittance délivrée gratuitement" (art. 21 al. 5).

## Comportement par type de message — Workflow Candidat (Session 12)

**Démarrage** : `/candidat`

**Livrable** : fiche `.md` créée dans `_Candidats/<Nom>.md` du vault Drive (nom, contact, garanties, revenus, bien envisagé).

**Pré-requis** : `DRIVE_VAULT_ROOT_ID` configuré dans Replit Secrets pour activer ce workflow.

**Phase 6** (non démarré) : promotion candidat → locataire au moment du bail signé (déplacement fiche `_Candidats/` → `05. Locataires/01. Actuels/`).

## Sécurité

- **Token Telegram** : `TELEGRAM_BOT_TOKEN` (jamais en clair, jamais committé)
- **Secret webhook** : `X-Telegram-Bot-Api-Secret-Token` vérifié via `timingSafeEqual` (`TELEGRAM_WEBHOOK_SECRET`)
- **Whitelist statique** : `TELEGRAM_ALLOWED_CHAT_IDS` (chat_id de Thomas) — refuse tout autre user
- **OAuth Google** : `GOOGLE_REFRESH_TOKEN` avec scope **`drive + calendar.events + gmail.readonly + gmail.labels + gmail.compose`** (Session 14 : scopes Gmail ajoutés pour email-ingest)
- **Anti-replay Telegram** : retourne toujours 200 OK pour éviter les reposts agressifs

## Variables d'environnement requises

```
TELEGRAM_BOT_TOKEN          # token bot @BotFather
TELEGRAM_WEBHOOK_SECRET     # secret arbitraire pour vérifier la provenance
TELEGRAM_ALLOWED_CHAT_IDS   # chat_id Thomas (CSV pour plusieurs)
ANTHROPIC_API_KEY           # Claude API (Sonnet 4.6 + Haiku 4.5)
GOOGLE_CLIENT_ID            # OAuth2 Google
GOOGLE_CLIENT_SECRET        # OAuth2 Google
GOOGLE_REFRESH_TOKEN        # OAuth2 Google (long-lived, scope drive + calendar.events)
DRIVE_INBOX_FOLDER_ID       # ID du dossier _Inbox/ du vault Obsidian
DRIVE_VAULT_ROOT_ID         # ID du dossier racine vault (locataires, candidats, Todo.md)
DRIVE_TODO_FILE_ID          # (optionnel) ID direct du fichier Todo.md, sinon recherche dans vault
ADMIN_SETUP_TOKEN           # token admin pour /api/telegram/setup (menu commandes)
```

Folder IDs Drive pour CR par entité juridique (hardcodés) : `IC` (ISSA Capital), `GO` (Gradient One), `VI` (Versi Immobilier), `VV` (Versi Invest).

## Edge cases gérés

| Cas | Comportement |
|---|---|
| Fichier > 20 MB | Réponse explicite "Fichier trop volumineux, max 20 MB" |
| HEIC iPhone EXIF strippé par Telegram iOS | Workflow `inbox-photo-batch` : Anya demande la date au lieu d'extraire l'EXIF |
| Telegram MIME ment (`image/heic` mais buffer JPEG) | Détection par signature bytes (FF D8 FF = JPEG, ftyp + brand = HEIC) — pas par MIME |
| Brand HEIC exotique (`mif2`, etc.) | Fallback ExifReader avec brand patché à `heic` en mémoire (préserve le reste du buffer) |
| Caractères accentués | `slugify()` ASCII pour les noms de fichiers (règle ASCII, accents en contenu uniquement) |
| Album multi-photos | `media_group_id` accumulé dans le workflow batch |
| Workflow zombie | TTL 24h → cleanup auto |
| User non whitelisté | Ignoré silencieusement |
| Date "Fait à Nanterre" quittance | Le 3 du mois de la quittance (pas du mois suivant, fixé Session 13) |
| Texte court ambigu (peut être tâche ou agenda) | Toujours via router avec 3 boutons → Thomas choisit |

## Architecture extensible — Pattern Workflow

Pour ajouter un nouveau workflow :

1. Créer `workflows/{nom}.ts` implémentant l'interface `Workflow` (`command`, `commandDescription`, `start`, `handleMessage`, `handlePhoto`, `handleVoice`, `handleCallback`, `cancel`)
2. Ajouter `'{nom}'` au type union `WorkflowType` dans `workflows/types.ts`
3. Enregistrer dans `workflowRegistry` (`workflows/registry.ts`)
4. Visiter `/api/telegram/setup?token=XXX` pour synchroniser le menu Telegram

Le routing dans `route.ts` ne change pas, les autres workflows ne sont pas impactés.

## Fichiers clés

```
src/app/api/telegram/webhook/route.ts          # entry point webhook (~1700 lignes)
src/app/api/telegram/setup/route.ts            # endpoint admin — synchronise menu commandes
src/app/api/drive-auth/route.ts                # OAuth2 Google (scope drive + calendar.events) + page tokeninfo
src/lib/secretariat/inbox.ts                   # handlers mode inbox (legacy fallback)
src/lib/secretariat/photo-timestamp.ts         # EXIF dual : exifr (JPEG) + ExifReader (HEIC)
src/lib/secretariat/drive-todo.ts              # append Todo.md > ## Inbox
src/lib/secretariat/drive-upload.ts            # uploadToDrive + uploadToInbox
src/lib/secretariat/workflows/types.ts         # interface Workflow
src/lib/secretariat/workflows/registry.ts      # registry
src/lib/secretariat/workflows/cr.ts            # workflow CR
src/lib/secretariat/workflows/quittance.ts     # workflow quittance batch
src/lib/secretariat/workflows/bail.ts          # workflow bail meublé DOCX+PDF
src/lib/secretariat/workflows/fin-de-bail.ts   # workflow fin de bail PDF
src/lib/secretariat/workflows/candidat.ts      # workflow fiche candidat .md
src/lib/secretariat/workflows/inbox-photo-batch.ts    # Session 13 : photos + date prompt
src/lib/secretariat/workflows/inbox-message-router.ts # Session 13 : router Calendar/Todo
src/lib/google/calendar.ts                     # client Google Calendar API (Session 13)
src/lib/secretariat/rent/                      # lib partagée bail/quittance/findebail
src/lib/secretariat/vault-client/              # Session 14 : vault client Obsidian/Drive (7 modules, 81 tests)
src/lib/secretariat/vault-client/index.ts      # API publique : findContactByEmail, appendToHistorique, updateFrontmatter, createVaultFile
src/lib/secretariat/vault-client/frontmatter.ts # Parser frontmatter bit-perfect (zéro gray-matter)
src/lib/secretariat/vault-client/drive-resolver.ts # Résolution path logique → fileId (cache TTL 1h)
src/lib/secretariat/vault-client/obsidian-file.ts  # Lecture/écriture fichiers .md via Drive API
src/lib/secretariat/vault-client/markdown-append.ts # Append chrono-inverse H3 sous H2
src/lib/secretariat/vault-client/write-lock.ts     # Sérialisation écriture par path
src/lib/secretariat/vault-client/audit-log.ts      # Audit trail JSONL dans _Inbox/AnyaLogs/
src/lib/secretariat/vault-client/vault-paths.ts    # Constantes chemins logiques vault
scripts/test-haiku-dates.ts                    # validation empirique résolution dates FR
```

## Tests

```bash
npm test
# → 694/694 passent (593 existants + 101 gmail-source/triage)
```

Couverture :
- Tests CR, quittance, bail, findebail, candidat (workflows complets)
- Tests inbox-photo-batch (39 tests) + inbox-message-router (23 tests)
- Tests gmail-source (49 tests : gmail-client 27, gmail-source 12, label-resolver 10)
- Tests triage (52 tests : triage 30, triage-eval 22)
- Tests photo-timestamp (14 tests dont HEIC ExifReader + brand patch)
- Tests rent lib (num-en-lettres, dates-fr, biens, locataires fuzzy, etc.)
- Tests registry, router, conversation store, drive-upload
- Tests vault-client (81 tests) : frontmatter bit-perfect (7 fixtures réelles), markdown-append chrono-inverse, write-lock sérialisation, drive-resolver cache TTL, obsidian-file I/O, API publique (findContactByEmail, appendToHistorique, updateFrontmatter)

## Roadmap

**Phases déployées** :

- Mode inbox + architecture workflows extensible (Phase 1)
- Workflow CR (compte-rendu réunion PDF) (Phase 1)
- Workflow Quittance batch N×M (Phase 2)
- Workflow Bail meublé DOCX+PDF + Fin de bail + Candidat (Phase 3 — Session 12)
- Workflow `inbox-photo-batch` (Phase 4 — Session 13) — bypass strip EXIF Telegram iOS
- Workflow `inbox-message-router` Calendar + Todo (Phase 4 — Session 13)

**Email-ingest (plan Anya S14+)** :

- **Jalon 0 — Setup env vars** : FAIT (Session 14) — variables documentées dans dev-decisions.md
- **Jalon 1 — Vault client** : FAIT (Session 14) — `src/lib/secretariat/vault-client/` (7 modules, 81 tests, frontmatter bit-perfect, cache TTL 1h, write-lock, audit trail)
- **Jalon 2 — Gmail source** : FAIT (Session 14) — `src/lib/secretariat/gmail-source/` (4 modules, 49 tests). Client Gmail API mutualisé, label-resolver cache TTL 1h, listing+filtre local. OAuth étendu (3 scopes Gmail). CLI `npm run ingest:gmail -- --dry-run`.
- **Jalon 3 — Triage Haiku** : FAIT (Session 14) — `src/lib/secretariat/triage/` (3 modules, 52 tests). Prompt versionné triage-v1.md. Haiku 4.5 (`claude-haiku-4-5-20251001`), validation Zod, retry x1, override confidence < 0.7. Matrice confusion 20 fixtures : 100% catégorie, 100% intent.

**À venir** :

- **Jalon 4-9** : handlers spécialisés (quittance, relance, candidature, etc.) — voir `second-cerveau/Anya - Plan email-ingest.md`
- **Phase 5 — Promotion candidat → locataire** : commande `/promouvoir <nom>` déplace fiche `_Candidats/` vers `05. Locataires/01. Actuels/<nom>/`
- **Phase 6 — Corrections juridiques bail** : encadrement loyers (€/m²), IRL automatique INSEE, clause pénale (décisions Thomas en attente)
- **Phase 7 — Envoi email locataire** : envoi automatique quittances par Gmail API
- **Phase 8 — Cron mensuel quittances** : génération automatique en début de mois

## Préférences fondateur applicables à Anya

- **Modèle adapté à la tâche** : Sonnet 4.6 pour CR (qualité critique, vouvoiement institutionnel, structure), Haiku 4.5 pour router inbox (extraction JSON simple, ~5× moins cher, ~2× plus rapide)
- **Zéro MVP** : tout livrable est fini, pas bancal
- **Zéro invention** : si Anya hésite (date, lieu, participant), elle laisse vide ou demande
- **Vouvoiement institutionnel** dans les CR (Thomas dicte parfois en tutoiement, Anya structure en vouvoiement)
- **Délais réalistes** : pas de "dans la journée" dans les CR — préfère "sous 72h"
- **Photos via Telegram** : abandon de l'extraction EXIF (limite Telegram iOS), Anya demande la date à Thomas — plus fiable que tâtonner

---

> Fiche maintenue par l'équipe d'agents Gradient. Pour la dernière version, vérifier ce fichier sur GitHub.
