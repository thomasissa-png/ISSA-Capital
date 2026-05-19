---
type: outil
nom: Anya — Bot Telegram secrétariat
date_mise_a_jour: 2026-05-19
version: 2.0 (refonte session S20.A)
source: docs/ia/anya-current-architecture.md (repo ISSA-Capital, branche claude/add-sanity-check-TD0Ao)
tags:
  - outils
  - ia
  - bot
  - automatisation
  - secretariat
---

# Anya — Bot Telegram secrétariat ISSA Capital

> Fiche technique partageable. Source de vérité pour tout autre Claude (Cowork, Desktop, autre repo) qui doit comprendre ou faire évoluer Anya.
> Dernière mise à jour : 2026-05-19 (session S20.A — edit preview inbox-router + hotfix system-prompt + restitution complète evolutions S14-S20).

## Identité

| Champ | Valeur |
|---|---|
| Nom | Anya |
| Rôle | Secrétariat IA personnel de Thomas Issa (ISSA Capital) |
| Interface | Bot Telegram unique, conversation privée mono-utilisateur |
| Mission | Ingérer texte / photos / vocaux / documents / emails, classifier, générer des artefacts (CR, quittances, baux, drafts), écrire dans le vault Obsidian (Drive), gérer les tâches via TickTick, synchroniser Gmail + Google Calendar |
| Statut | Production depuis S9 (2026-04-09), 11 sessions live |
| Mono-user | Thomas Issa uniquement (pas de RBAC, pas de multi-tenant) |

## Stack technique

| Couche | Outil / Version |
|---|---|
| Runtime | Node.js / TypeScript strict |
| Framework | Next.js 14 App Router (API routes) |
| Hébergement | Replit (autoscale — pas de fire-and-forget, tout après ack dans la même request) |
| LLM | Anthropic SDK `^0.86.1` (Sonnet 4 `claude-sonnet-4-20250514` + Haiku 4.5 `claude-haiku-4-5-20251001`) |
| STT | OpenAI Whisper (vocaux Telegram FR) |
| Validation | Zod `^3.24.4` (schémas Telegram + responses Claude, retry self-correction) |
| Auth Google | OAuth2 refresh token, scopes `drive` + `calendar.events` + `gmail.readonly` + `gmail.modify` |
| PDF / DOCX | PDFKit `^0.18.0` + docx `^9.6.1` |
| EXIF photos | exifr `^7.1.3` (JPEG) + ExifReader `^4.38.1` (HEIC) |
| Tests | Vitest `^2.1.9` — 1716+ tests verts (baseline S19.B), ×3.4 vs S13 (511) |
| CI cron | GitHub Actions (7 workflows actifs) |

## Architecture globale

- **Webhook unique** `POST /api/telegram/webhook/route.ts` (~2503 lignes — fichier monolithe d'orchestration)
- **Ack < 5 s exigé par Telegram** (sinon retry). Replit autoscale = toute action lourde (LLM, Drive PATCH, PDF) est faite **après ack dans la même request**, jamais en fire-and-forget.
- **Router 5 niveaux** (priorité décroissante, première branche gagnante) :
  1. Slash commande active (`/cr`, `/quittance`, `/bail`, …) → workflow dédié
  2. Workflow déjà actif dans `conversation-store` → poursuite step
  3. Batch photo en attente (timer date prompt) → inbox-photo-batch
  4. **NOUVEAU S20.A** — pending edit actif (`awaitingField !== null`) → handler `inbox-edit` AVANT routage normal
  5. Texte ≥ 100 chars → auto-CR (Sonnet 4 streaming) | Texte < 100 chars → inbox-message-router (Haiku 4.5)
- **Dispatch par MIME** (signature bytes inférée, pas Content-Type) — règle 25.

## Workflows et handlers

Distinction structurelle :

- **Workflow** = machine d'états multi-steps avec TTL, persistée en `conversation-store.ts`. Une seule active par chat à la fois. Slash commande pour démarrer.
- **Handler** = traitement ciblé pendant validation Telegram, sans état long. Appelé depuis le dispatch callback du webhook. R4 obligatoire : handler + dispatch + test E2E.

### Workflows enregistrés (`workflows/registry.ts`)

| Workflow | Slash | Sortie |
|---|---|---|
| `cr` | `/cr` | PDF CR de réunion + write-back vault entité |
| `quittance` | `/quittance` | PDF quittance loyer (batch N×M locataires) |
| `bail` | `/bail` | DOCX + PDF bail meublé (24 sections juridiques) |
| `findebail` | `/findebail` | Lettre fin de bail PDF |
| `candidat` | `/candidat` | Fiche candidat locataire vault |
| `inbox-photo-batch` | (mode inbox, pas de slash) | Photos groupées + date prompt → vault Inbox |
| `inbox-message-router` | (mode inbox, pas de slash) | Carte preview 7 boutons → GCal / TickTick / annulation |

### Handlers (`handlers/`)

| Handler | Déclencheur | Action |
|---|---|---|
| `a-classifier` | Triage email catégorie générique | Classification CR / note / rdv |
| `apporteur` | Triage email "apporteur" | Enrichit fiche apporteur immobilier vault |
| `candidat` | Triage email "candidat" | Lookup + upsert fiche candidat |
| `contact-pro` | Triage email "contact-pro" | Enrichit fiche contact pro |
| `cr-writeback` | Post-génération CR | Append section CR à fiche Projet (PATCH in-place R5) |
| **`inbox-edit`** (S20.A) | Tap ✏️ sur carte preview inbox-router | Set `awaitingField`, texte suivant parsé, patch draft, re-render in-place |
| `locataire` | Triage email "locataire" | Lookup locataire (bail/quittance) |

### Handlers de validation Telegram (`telegram-validation/handlers/`)

`health-renewed`, `health-snooze`, `hot-context-patch` (S19.B), `ticktick-projects-confirm` (S18.1). Chacun branché via préfixe callback unique (R4).

## Mode vs Workflow

| Critère | Mode (inbox) | Workflow (slash) |
|---|---|---|
| Démarrage | Implicite (tout message hors slash) | Explicite (`/cr`, `/bail`, …) |
| État | Stateless ou batch court (timer ms) | Machine d'états multi-steps, persistée |
| Sortie | Carte preview Telegram (validation tap) | Artefact final (PDF/DOCX) + write Drive |
| Modèle | Haiku 4.5 (router + triage) | Sonnet 4 (CR, registre juridique) |
| Coût | Très bas (~0,0002 USD / message) [HYPOTHÈSE coût exact, ordre de grandeur post-S17 wrapper cache_control] | Modéré (CR ~0,01 USD, bail ~0,03 USD) [HYPOTHÈSE] |
| Edit pré-validation | NOUVEAU S20.A (4 champs éditables ✏️) | N/A (workflow re-runable via /annuler + slash) |

## Commandes Telegram

| Commande | Workflow / Action |
|---|---|
| `/cr` | Démarre workflow CR de réunion |
| `/quittance` | Démarre workflow quittance batch |
| `/bail` | Démarre workflow bail meublé |
| `/findebail` | Démarre workflow lettre fin de bail |
| `/candidat` | Démarre workflow fiche candidat |
| `/annuler` | Annule le workflow actif en cours |
| `/status` | Affiche workflow actif + version build |
| `/help` | Liste les commandes disponibles |

(Confirmation : aucune nouvelle slash commande ajoutée S14-S20 — toutes les évolutions sont en mode inbox ou via handlers de validation.)

## Comportement par type de message — Mode inbox

| Type | Comportement |
|---|---|
| **Photo (JPEG/HEIC)** | Workflow `inbox-photo-batch` : groupe les photos arrivant dans une fenêtre courte, prompt date (EXIF abandonné — Telegram iOS strippe HEIC EXIF, règle 25), upload vault Inbox |
| **Texte < 100 chars** | Inbox-message-router (Haiku 4.5) → carte preview 7 boutons → édition conversationnelle S20.A possible avant validation (cf bloc dédié) |
| **Texte ≥ 100 chars** | Auto-CR (Sonnet 4 streaming) — seuil 100 chars validé S13. Génère draft CR, propose validation via carte Telegram |
| **Vocal (.ogg)** | Whisper STT (OpenAI, FR) → texte → re-dispatch dans le router (seuil 100 chars appliqué) |
| **Document (PDF/DOCX)** | Ingestion + analyse, archivage vault `_Inbox/Documents/` |
| **Vidéo** | Archivage vault (pas d'analyse V1) |
| **Sticker** | Ignoré (log only) |

### Workflow `inbox-photo-batch` (S13, inchangé)

Groupe les photos d'un même envoi iPhone (Telegram en streame 1 par 1) dans une fenêtre temporelle. À la fin du timer, prompt date (saisie manuelle car HEIC EXIF perdu côté iOS Telegram, règle 25). Upload vault `_Inbox/Photos/YYYY-MM-DD/`. Pas d'analyse LLM (purement archivage).

### Workflow `inbox-message-router` (S13 + refacto S20.A)

**Carte preview 7 boutons** : ✏️ Titre · ✏️ Date · ✏️ Heure · ✏️ Lieu · 📅 GCal · 📋 Tâches · ✗ Annuler.

**Flow édit conversationnel (S20.A nouveau)** :
1. Thomas tape `Anya rdv notaire 14h` → Haiku 4.5 extrait {titre, date, heure, lieu} → carte preview affichée avec `pendingId`.
2. Thomas tap ✏️ Heure → message remplacé par "Tape la nouvelle heure (ex: 14h30, 14:30, 14h, 2pm)" + 1 seul bouton ✗ Annuler (bloque les autres taps en attendant la saisie).
3. Thomas tape `14h30` → webhook détecte `hasActivePendingEdit(chatId)` (priorité 4 du router, AVANT routage normal) → dispatch `handleInboxEditText` → parser FR `parseHeure` (variants `14h` / `14h30` / `14:30` / `2pm`) → patch draft → `awaitingField=null` → re-render carte 7 boutons in-place via `editMessageTextWithButtons`.

**Pending-store** : `inbox-preview-store.ts` (165L), clé `inbox-preview:{pendingId}`, TTL **7 jours strict** (R3). Multi-pending supporté : on prend toujours le plus récent (`createdAt` desc) par `findLatestAwaitingForChat`.

**Dispatch R4 — 4 préfixes callback ajoutés S20.A** :
- `cb_inbox_edit_titre_{pendingId}` → `handleInboxEditCallback(field='titre')`
- `cb_inbox_edit_date_{pendingId}` → `handleInboxEditCallback(field='date')`
- `cb_inbox_edit_heure_{pendingId}` → `handleInboxEditCallback(field='heure')`
- `cb_inbox_edit_lieu_{pendingId}` → `handleInboxEditCallback(field='lieu')`

Tous branchés ligne 1619 du webhook (`if (callbackData.startsWith('cb_inbox_edit_'))`).

**Parsers permissifs** (`workflows/inbox-edit-parsers.ts`) :
- `parseDate` : ISO `2026-05-22`, JJ/MM `22/05`, FR naturel "demain", "lundi prochain", "22 mai"
- `parseHeure` : `HH:MM`, `Hh`, `HhMM`, `H pm`, variants FR/EN
- `parseTitre` : trim + capitalisation douce
- `parseLieu` : trim seulement (pas de validation adresse, future S21)

**Aucun appel LLM pour l'édition** — parsing 100% déterministe, économe & rapide. Cohérent avec ROI : seul l'extraction initiale Haiku 4.5 (1 appel par message) consomme des tokens.

## Workflow CR (compte-rendu)

- Seuil auto-CR : 100 chars (validé S13)
- Modèle : Sonnet 4 streaming, Zod retry self-correction
- Mode solo (S16 Q2) : pipeline accepte 0 participant tiers (visite immo seul, signature notariale solo, activité perso). Libellé "Présent" vs "Participants". RÈGLE 14 system prompt.
- Write-back (S16 Q3) : `cr-writeback.ts` append section CR à fiche Projet vault via PATCH in-place R5. Idempotence par `includes(webViewLink)`. Lookup entité via `vault-reader.findProjetFicheByEntite()` (S17 — retrait hardcoded `PROJET_FICHE_FILE_IDS` qui violait R7).
- **Hotfix S20** : system-prompt restauré depuis archive S17.R3 suite à bug `ENOENT` (lecture `fs.readFileSync` cassée par bundle Next.js). Dette code à apurer S21 → migration `fs.readFileSync` → import TS constant.

## Workflows Quittance / Bail / Fin de bail / Candidat

Inchangés depuis S11-S13. Pour mémoire :
- **Quittance** : batch N locataires × M mois, OAuth scope `drive`, Levenshtein matching locataires, PDFKit.
- **Bail meublé** : 24 sections juridiques, DOCX + PDF. **AUDIT @legal S12 = NO-GO en l'état** : encadrement loyers manquant, IRL INSEE non câblé, clause pénale absente. Backlog S21.
- **Fin de bail** : lettre PDF datée, état des lieux non couvert.
- **Candidat** : fiche vault locataire candidat, lookup Levenshtein, no-match card 5 boutons (S14).

## ÉVOLUTIONS S14-S20

### Email-ingest Gmail → vault (S14, 4 jalons)

Pipeline `email-ingest/` complet livré en S14 :
- **Source** (`gmail-source/`) : fetch Gmail brut par label, parsing MIME, déduplication.
- **Triage** (`triage/`) : Haiku 4.5 sur 6 catégories (apporteur, candidat, contact-pro, locataire, a-classifier, autre). Prompt versionné `triage-v1.md` enrichi listes contacts réels via `contacts-cache.ts`. **Matrice confusion 100% precision / 100% recall sur 20 fixtures.**
- **Handlers** (`handlers/`) : 6 handlers métier (apporteur, candidat, contact-pro, locataire, a-classifier, cr-writeback).
- **Validation Telegram** (`telegram-validation/`) : pending-store Drive (TTL 7j R3) + cartes 5 boutons (valider / modifier / no-match / skip / délai).
- **Pré-filtre heuristique** amont (~70 % d'économie tokens en sautant les emails newsletters / no-reply avant Haiku).
- **Cron 1h** GitHub Actions (`cron-email-ingest.yml`).

### Vault-client + Vault-reader (S14-S17)

- `vault-client/` : écriture Drive — `updateFileContent()` (PATCH in-place R5), `createFile()`, `searchByName()`. Audit trail JSONL append-only `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl`. Write-lock par path. Cache resolver TTL 1h.
- `vault-reader/` : lecture live — `getFileContent()`, `findByPath()`, `findProjetFicheByEntite()` (S17). Cache mémoire TTL 1h cohérent avec contacts-cache. Fallback gracieux `null` + warn (jamais throw).

### Wrapper LLM unifié `llm/client.ts` (S17 R1)

- Centralisation des 6 call sites Anthropic (triage, draft-composer, inbox-message-router, webhook ×3).
- `cache_control` auto sur le system prompt stable (`splitSystemPrompt(stable, dynamic)`).
- `recordAnthropicUsage()` systématique (cache_read_input_tokens, cache_creation_input_tokens, output_tokens).
- Retry 429/500 (3× backoff 1/2/4 s) + retry JSON ×1 sur format JSON.
- Modèles centralisés (`HAIKU_4_5`, `SONNET_4`) avec override `ANTHROPIC_MODEL_OVERRIDE_*`.
- **Conséquence** : facture Anthropic désormais 100 % trackée. Pré-requis pour A/B Sonnet 4 → 4.6 (reco audit S16 long-terme).

### TickTick sync vault ↔ TickTick (S18, 3 sous-jalons)

- **S18.1 push vault → TickTick** : `ticktick-sync/` (parser markdown `- [ ]` → VaultTask, projet auto via `PROJECT_TAG_MAPPING` 7 projets, SHA-1 canonical hash idempotent, state JSON Drive PATCH in-place R5, push engine create/update/complete/delete avec backoff 429, cron 5 min, carte Telegram confirmation 7 projets, tag `#hide-tcw` filtré).
- **S18.2 pull TickTick → vault** : pull-engine conflict resolver last-write-wins canonique vault. Vault-scanner étendu inline tasks 4 dossiers (Réunions mois courant + Projets Perso/Pro + Notes). Exclusions strictes Profil/Archive/_Inbox/_Outbox/AnyaLogs/AnyaState + frontmatter `hide-tcw` + ligne `#hide-tcw`. Verrou anti-concurrence push/pull TTL 30 s. Cron 5 min décalé 30 s vs push.
- **S18.3a iCal feed réunions vault read-only** : RFC 5545, endpoint `?token=TICKTICK_ICAL_SECRET`. Parser frontmatter `date`/`heure`/`duree`/`participants`/`lieu`/`categorie`, fenêtre `[year-1 ; year+1]` × 12 mois. UID djb2 stable (8-hex), all-day ou timed floating selon `heure`, deep-link Obsidian encodé. Vault → TickTick (refresh ~3-24 h par GCal).

**Direction unique : TickTick → GCal (via iCal)**. **Pas de sync inverse** GCal → TickTick (choix volontaire). Silent delete TickTick (S19) : tâches supprimées dans TickTick UI → propagation iCal < 1 h.

### Silent completion vault (S19 — remplace delete-confirm S18.2)

Décision Thomas verbatim S19 : *« Si je supprime des tâches dans TickTick, Anya pas besoin de me le dire »*. Red line §9.2 historique (« pas de delete silencieux + Telegram OBLIGATOIRE ») **remplacée** par completion silencieuse : ligne vault `- [ ]` patchée `- [x]` via PATCH in-place R5, zéro notification, JSONL trace `ticktick-delete-silent-completion`. Idempotent (déjà `[x]` = no-op). Préserve l'historique vault. `ticktick-delete-confirm` handler supprimé.

### Calendar-ingest GCal → vault Réunions (S18.6)

Module `calendar-ingest/` : ingère événements GCal primary → fiches vault `06. Réunions/YYYY/MM/`. Enrichissement auto fiches contacts (apporteurs, candidats, locataires). Cron `cron-calendar-ingest.yml`. Orthogonal au TickTick → GCal (ne touche pas TickTick).

### Hot-context updater (S19.B Phase B)

- Module `hot-context/` qui maintient `00. Me/hot-context.md` à jour automatiquement (4 sections, cible 500 tokens warn-only).
- **4 sources** : emails JSONL ingérés + CR vault `06. Réunions/YYYY/MM/*.md` + Telegram explicite `#hotcontext` / `Anya note` + notes vault récentes 24 h via Drive `modifiedTime`.
- Détection Haiku 4.5 (wrapper `llm/client.ts`, `cache_control` auto) + pré-filtre heuristique amont (keywords FR/EN).
- Patches PATCH in-place R5 sur `hot-context.md` + `hot-context-state.json`.
- **Validation Telegram TTL 7 j R3** : carte 3 boutons (Valider / Modifier / Skip), handler `hot-context-patch.ts`, préfixe `hotcontext:` (R4).
- Audit JSONL §4 (6 events). Idempotence par `signalId = sha1(source+sourceId+section+action+canonical(payload))`.
- **Anti-race R-A** : re-lecture live AVANT chaque PATCH + mutex write-lock par path.
- **Red line Maintenance** : `maintenanceChanged()` check, applier refuse tout patch qui altère cette section.
- **Red line wikilink** : payload DOIT contenir `[[...]]` (sinon rejet `red_line_no_wikilink_in_payload`).
- **Cron** `cron-hot-context-scan.yml` 5 min décalé 90 s vs TickTick pull (offset workflow).

### Pending-store unifié (R3 propagée)

- `pending-store.ts` (cartes email-ingest, hot-context, ticktick-projects) + `inbox-preview-store.ts` (NOUVEAU S20.A — preview inbox-router avec `awaitingField`).
- **TTL ≥ 7 jours strict** sur tous les pendings (red line R3). Récidive S14 corrigée : TTL 24 h → 7 j sur email-ingest.

### Inbox-edit (S20.A — NOUVEAU)

Détaillé dans la section "Workflow inbox-message-router" ci-dessus. Résumé impact :
- +1 handler (`handlers/inbox-edit.ts`)
- +1 store (`inbox-preview-store.ts`)
- +1 module parsers (`workflows/inbox-edit-parsers.ts`)
- +4 préfixes callback dispatchés ligne 1619 webhook (R4)
- Priorité 4 du router (avant routage normal) : `hasActivePendingEdit(chatId)`
- Zéro appel LLM pour l'édition (parsing déterministe)

## Sécurité

- **Mono-utilisateur** : whitelist `TELEGRAM_ALLOWED_CHAT_ID` côté webhook. Tout chat autre = `403` silencieux.
- **Webhook secret** : `TELEGRAM_WEBHOOK_SECRET_TOKEN` validé en header `X-Telegram-Bot-Api-Secret-Token`.
- **Cron secret** : `CRON_SECRET` validé sur tous les endpoints `/api/secretariat/*/cron-*`.
- **OAuth2 refresh token** : Google Drive + Calendar + Gmail. Scopes minimaux (`drive` + `calendar.events` + `gmail.readonly` + `gmail.modify`).
- **R5 PATCH in-place** pour toute édition fichier Drive existant : préserve `fileId`, wikilinks Obsidian, partages. Jamais create+delete.
- **R6 batch n>1** : tester 1 fichier ET attendre validation visuelle Thomas (Obsidian) avant de lancer le batch.
- **Audit trail** JSONL append-only dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` (toutes les écritures + LLM usages + cron runs).
- **Pas de PII en clair dans les logs LLM** : payloads tronqués / hashés avant `recordAnthropicUsage()`.

## Variables d'environnement requises

| Variable | Usage |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot Telegram |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Header validation webhook |
| `TELEGRAM_ALLOWED_CHAT_ID` | Whitelist mono-user |
| `ANTHROPIC_API_KEY` | Sonnet 4 + Haiku 4.5 |
| `ANTHROPIC_BUDGET_EUR` | Alerte health 95 % budget mensuel (défaut 50 EUR) |
| `ANTHROPIC_MODEL_OVERRIDE_SONNET` / `_HAIKU` | Override modèles (futur A/B Sonnet 4.6) |
| `OPENAI_API_KEY` | Whisper STT |
| `GOOGLE_OAUTH_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | Drive + Calendar + Gmail |
| `OBSIDIAN_VAULT_NAME` | Deep-link Obsidian (S18.2) |
| `TICKTICK_CLIENT_ID` / `_CLIENT_SECRET` / `_ACCESS_TOKEN` / `_REFRESH_TOKEN` | Sync TickTick (S18) |
| `TICKTICK_ICAL_SECRET` | Token query iCal feed (S18.3a) |
| `CRON_SECRET` | Validation endpoints cron |
| `APP_BASE_URL` | Secret GitHub Actions (cron-pull + cron-hot-context) |

## Edge cases gérés

- Photo HEIC iPhone : EXIF strippé par Telegram iOS → date saisie manuellement (règle 25).
- Vocal Telegram .ogg : Whisper FR. Si STT échoue → message texte d'erreur, pas de retry auto.
- Pending expiré (>7 j) : `getPreview` retourne `null` → carte Telegram répond "session expirée, refais ta demande".
- Multi-pending sur même chat : `findLatestAwaitingForChat` prend le plus récent par `createdAt` desc.
- TickTick API timeout / 429 : backoff exponentiel 1/2/4 s, 3 retries max.
- Conflit GCal vs vault : `last-write-wins canonique vault` (vault gagne en cas d'égalité timestamp).
- Parsing date FR variants : `parseDate` accepte ISO, JJ/MM, "demain", "lundi prochain", "22 mai".
- ICS sync 3-24 h delay : doc Thomas, pas un bug — limite GCal côté refresh iCal subscribe.
- Drive PATCH échec : `writeBackCrToFiche` isolé en try/catch — n'interrompt pas le workflow CR principal (warn console only).
- LLM JSON malformé : retry self-correction ×1 (renvoie l'erreur Zod au modèle avec instruction de corriger).
- ENOENT system-prompt (S20) : hotfix S20 restauration archive S17.R3, migration TS constant programmée S21.

## Architecture extensible

### Pattern Workflow (machine d'états)

1. Créer `workflows/<nom>.ts` implémentant l'interface `Workflow` (types.ts) : `command`, `commandDescription`, `firstStep`, `steps: Record<StepName, Step>`.
2. Enregistrer dans `workflows/registry.ts` (`WORKFLOW_REGISTRY`).
3. État persisté via `conversation-store.ts` (TTL configurable, défaut 1 h).
4. Slash commande auto-injectée dans le menu Telegram via `/api/telegram/setup` (`listWorkflowCommands()`).

### Pattern Handler (validation Telegram) — R4

1. Créer `handlers/<nom>.ts` ou `telegram-validation/handlers/<nom>.ts` exposant `handleCallback` et/ou `handleText`.
2. **Dispatch R4 obligatoire** : ajouter une branche `if (callbackData.startsWith('<prefixe>:'))` dans `webhook/route.ts` (dispatch callback_query).
3. Si état persistant : pending-store avec **TTL ≥ 7 j (R3)**.
4. **Test E2E obligatoire** : 1 test minimum qui couvre le flow callback → handler → action finale.
5. Si nouveau préfixe : grep `webhook/route.ts` pour vérifier qu'aucune cascade ne route vers un mauvais handler.

## Fichiers clés

| Chemin | Rôle | Lignes approx. |
|---|---|---|
| `src/app/api/telegram/webhook/route.ts` | Entry point unique webhook Telegram | ~2503 |
| `src/lib/secretariat/workflows/` | 5 workflows enregistrés (CR, quittance, bail, fin-de-bail, candidat) + inbox-photo-batch + inbox-message-router | ~3000 |
| `src/lib/secretariat/workflows/inbox-edit-parsers.ts` | Parsers FR déterministes (titre, date, heure, lieu) — S20.A | ~150 [HYPOTHÈSE] |
| `src/lib/secretariat/handlers/` | 7 handlers métier (incluant inbox-edit S20.A) | ~1500 |
| `src/lib/secretariat/telegram-validation/handlers/` | 4 handlers de validation (health-renewed, health-snooze, hot-context-patch, ticktick-projects-confirm) | ~800 |
| `src/lib/secretariat/llm/client.ts` | Wrapper Anthropic unifié S17 (cache_control + recordAnthropicUsage + retry) | ~200 |
| `src/lib/secretariat/inbox-preview-store.ts` | Store pending inbox-router avec `awaitingField` — S20.A | 165 |
| `src/lib/secretariat/pending-store.ts` | Store pendings email-ingest / hot-context / ticktick TTL 7 j | ~200 |
| `src/lib/secretariat/vault-reader.ts` | Lecture live vault Drive + cache TTL 1 h | ~300 |
| `src/lib/secretariat/vault-client/` | Écriture vault (PATCH in-place R5 + audit JSONL + write-lock) | ~600 |
| `src/lib/secretariat/ticktick-sync/` | Push + pull + iCal réunions + state Drive | ~1800 |
| `src/lib/secretariat/hot-context/` | Hot-context-updater 4 sources + Haiku 4.5 + applier | ~900 |
| `src/lib/secretariat/email-ingest/` | Pipeline Gmail S14 (source + triage + handlers + cache) | ~1200 |
| `src/lib/secretariat/calendar-ingest/` | GCal → vault Réunions (S18.6) | ~400 [HYPOTHÈSE] |
| `src/lib/secretariat/health-monitor/` | 7 items + budget Anthropic + cron daily | ~600 |
| `src/lib/secretariat/rent/` | Quittance + bail + fin-de-bail + candidat (PDFKit + docx) | ~2000 |
| `.github/workflows/cron-*.yml` | 7 crons actifs (email-ingest, calendar-ingest, health-check, hot-context-scan, ticktick-poll, ticktick-sync-pull, ticktick-sync-push) | — |

## Tests

**1716+ tests verts** (baseline S19.B), **×3.4 vs S13** (511). 113 fichiers `.test.ts`. Répartition approximative :

| Domaine | Tests approx. |
|---|---|
| Workflows (cr, quittance, bail, fin-de-bail, candidat, inbox-photo-batch, inbox-message-router) | ~400 |
| Handlers (a-classifier, apporteur, candidat, contact-pro, cr-writeback, inbox-edit, locataire) | ~250 |
| Telegram-validation (cartes, pending-store, health, hot-context-patch, ticktick-projects-confirm) | ~150 |
| Hot-context (parser, applier, state-store, signal-detector, scanner, token-estimator, audit + cron) | ~65 |
| TickTick-sync (push + pull + iCal réunions + delete silent completion + crons) | ~250 |
| Email-ingest (gmail-source, triage, handlers, cache, prefilter, eval matrix 20 fixtures) | ~250 |
| Vault-client + vault-reader (parser frontmatter, write-lock, cache, drive-resolver) | ~150 |
| LLM wrapper (client, models, splitSystemPrompt, retry, cache_control) | ~32 |
| Parsers (date FR, heure FR, EXIF, frontmatter) | ~80 |
| Utils (drive-upload, photo-timestamp, reference-counter) | ~80 |

[HYPOTHÈSE : répartition exacte non extraite, ordre de grandeur basé sur l'historique des interventions S14-S19 et les fichiers `__tests__/` listés.]

## Roadmap

### Déployé (S9 → S19.B)

- **S9** : MVP Telegram + workflow CR + write Drive.
- **S10** : Vault Obsidian arbo Alt C + 14 contacts. Mode inbox.
- **S11** : Workflow quittance batch + OAuth scope drive.
- **S12** : Workflow bail meublé (24 sections) + fin-de-bail + candidat. Audit légal bail = NO-GO bloquant.
- **S13** : Inbox-photo-batch + inbox-message-router + voice Whisper + seuil auto-CR 100 chars.
- **S14** : Email-ingest complet (gmail-source + triage + handlers + telegram-validation + pré-filtre). Pending-store TTL 7 j (R3). No-match card 5 boutons.
- **S15** : Évaluations LLM (Kimi écarté RGPD CN, Mistral écarté ROI < 3) → statu quo Anthropic. Refonte project-context (TTL audit).
- **S16** : CR mode solo + write-back CR → fiche Projet vault (PATCH in-place R5). Audit Anya 7,1/10.
- **S17** : Wrapper LLM unifié (cache_control + recordAnthropicUsage) + retrait hardcoded `PROJET_FICHE_FILE_IDS` (R7 fermée). Anya-current-architecture.md + archivage docs S4 (1620L).
- **S18** : TickTick sync vault ↔ TickTick (push + pull + iCal réunions). Verrou anti-concurrence TTL 30 s. Calendar-ingest GCal → vault Réunions.
- **S19** : Silent completion vault (remplace delete-confirm). Hot-context-updater 4 sources + Haiku 4.5 + cron 5 min + validation Telegram TTL 7 j.
- **S20.A** : Edit preview inbox-router (4 champs ✏️ + parsing FR déterministe + re-render in-place). Hotfix system-prompt CR (`fs.readFileSync` ENOENT). Restitution doc anya-v2.

### Backlog visible

- **S21 P0** — Migration `fs.readFileSync` → import TS constant (élimine fragilité bundle Next.js, cf bug S20 ENOENT).
- **S21 P1** — Corrections juridiques bail (encadrement loyers, IRL INSEE, clause pénale) audit @legal S12.
- **S21 P1** — Promotion candidat → locataire (Phase 5, toujours pas démarré).
- **S22** — Envoi email locataire automatique (Gmail API draft).
- **S22** — Cron mensuel quittances (auto-batch début de mois).
- **Long terme** — Migration Sonnet 4 → Sonnet 4.6 avec A/B testing (reco audit S16). Pré-requis : wrapper LLM unifié S17 (FAIT).

## Red lines applicables à Anya

Issues de la section persistante de `CLAUDE.md` ISSA Capital :

| Red line | Application Anya |
|---|---|
| **R1** Vault Drive = source de vérité unique | Tout (contacts, locataires, projets, hot-context, state TickTick) est lu live via `vault-reader`. Jamais hardcodé. |
| **R2** Scanner MCP `mcp__*` proactivement | En début de session, scanner Drive / Gmail / Calendar / TickTick / Asana via MCP avant de poser une question à Thomas. |
| **R3** TTL pendings ≥ 7 j | `inbox-preview-store`, `pending-store`, `hot-context-state` : 7 j strict. Jamais < 72 h. |
| **R4** Nouveau préfixe callback = handler + dispatch + test E2E | 4 préfixes ajoutés S20.A (`cb_inbox_edit_{titre,date,heure,lieu}_`) tous branchés ligne 1619 webhook. |
| **R5** Édit Drive = PATCH in-place via `_zap_raw_request` | Tous les write-back (CR, hot-context, state TickTick, fiches Projet) passent par `updateFileContent()` PATCH in-place. Préserve fileId / wikilinks / partages. |
| **R6** Batch n>1 = tester 1 fichier d'abord | Hot-context patch + quittances batch + write-back CR : test unitaire visuel Obsidian avant batch. |
| **R7** Source live remplace hardcoded → retirer hardcoded même jalon | S17 : `PROJET_FICHE_FILE_IDS` retiré quand `findProjetFicheByEntite` mis en prod. Pas de dette "au cas où". |

## Préférences fondateur applicables à Anya

- **Vault = source vérité absolue** (verbatim Thomas S14 : *"tes questions m'ennuient, toutes les réponses sont dans le vault"*).
- **Mindset IA, pas équipe humaine** : Anya = V1 complète (pas MVP), parallélisation par défaut, plan par dépendances pas par sprints, ne jamais couper une feature "par manque de temps".
- **Calibration vélocité IA** : verdicts GO/NO-GO basés VALEUR persona, pas ROI/payback humains. Un projet à valeur user élevée mais ROI négatif court terme = GO POC, pas NO-GO.
- **Préserver l'historique > destructive delete** (S19 silent completion). Pas de delete vault. Tâches cochées restent visibles.
- **UX épurée** : zéro notification superflue (S19 silent completion exemple type).
- **PATCH in-place > recréation** : préserve écosystème vault Obsidian (wikilinks, partages, backlinks).
- **Premium éditorial** : pas de copy persuasif, pas de tactique conversion, posture institutionnelle.

---

> Fiche maintenue par l'équipe d'agents Gradient. Pour la dernière version, vérifier ce fichier sur GitHub : [anya-current-architecture.md](https://github.com/thomasissa-png/ISSA-Capital/blob/claude/add-sanity-check-TD0Ao/docs/ia/anya-current-architecture.md)



