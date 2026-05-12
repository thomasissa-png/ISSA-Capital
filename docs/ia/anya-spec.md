# Anya — Bot Telegram secrétariat ISSA Capital

> Fiche technique partageable. Source de vérité pour tout autre Claude (Cowork, Desktop, autre repo) qui doit comprendre ou faire évoluer Anya.
> Dernière mise à jour : 2026-05-12 (session 11 — menu commandes Telegram auto-maintenu).

---

## Identité

**Nom** : Anya
**Rôle** : Secrétariat IA personnel de Thomas Issa (Président ISSA Capital)
**Interface** : Bot Telegram (1 conversation privée avec Thomas)
**Statut** : En production depuis session 9 (2026-04-09), étendu session 10 (mode inbox + architecture multi-workflows)

## Stack technique

| | |
|---|---|
| Runtime | Node.js / TypeScript strict |
| Framework | Next.js 14 App Router (API route webhook) |
| LLM | Anthropic SDK — Claude Sonnet 4.6 (qualité > coût) |
| Validation | Zod (schémas Telegram + Claude responses) |
| Stockage | Google Drive (OAuth2 refresh token) + JSON files persistés (conversation, drafts, contacts, compteur référence) |
| PDF | PDFKit (compte-rendus A4 avec annexes photographiques) |
| Tests | Vitest — 324/324 passent (68 CR + 34 inbox/router + 10 photo-timestamp + 193 rent/quittance batch + 10 registry + 9 autres) |
| Hébergement | Replit |

## Architecture globale

**Webhook unique** : `POST /api/telegram/webhook` reçoit toutes les updates Telegram (messages texte, photos, vocaux, documents, callbacks de boutons inline).

**Router 3 niveaux** dans `src/app/api/telegram/webhook/route.ts` :

```
Message reçu
   ↓
1. Commande slash (/cr, /inbox, /cancel, /status) → handleCommand()
2. Workflow actif (CR en cours) → workflow.handleMessage/Photo/Voice/Callback
3. Sinon → mode inbox (upload Drive direct selon type)
```

## Concept clé : Mode vs Workflow

| | **Mode `inbox`** (état par défaut) | **Workflow** (CR, futurs quittance/bail) |
|---|---|---|
| État | Stateless (chaque message indépendant) | Machine à états (3-8 steps + TTL 24h) |
| Validation | Confirmation simple | Boutons inline Valider/Modifier/Annuler |
| Livrable | Fichier brut → Drive `_Inbox/` | PDF structuré → Drive entité |
| API Claude | Zéro (juste upload) | Sonnet 4.6 |
| Coût | 0 € | ~12 €/an (usage Thomas) |

**Un seul workflow actif par chat à la fois.** Quand il termine ou est annulé → retour mode inbox automatique.

## Commandes disponibles

| Commande | Effet |
|---|---|
| `/start` | Message de bienvenue, vérifie whitelist |
| `/cr` | Force le workflow CR (compte-rendu) |
| `/quittance` | Démarre le workflow quittance de loyer |
| `/inbox` | Force retour mode inbox + clear workflow actif |
| `/cancel` | Annule le workflow en cours, retour inbox |
| `/status` | Affiche le mode actuel + workflow actif s'il y en a un |

## Menu commandes Telegram (auto-maintenu)

Le menu auto-complétion Telegram (suggestions quand Thomas tape `/`) est synchronisé automatiquement depuis le code via l'endpoint `/api/telegram/setup`.

**Fonctionnement** : chaque workflow dans `workflows/registry.ts` declare `command` et `commandDescription` dans son interface `Workflow`. L'endpoint `/api/telegram/setup` lit le registry, ajoute les commandes systeme (`/status`, `/inbox`, `/cancel`), et appelle l'API Telegram `setMyCommands`.

**Commandes actuelles configurées** :

| Commande | Description (visible dans Telegram) |
|---|---|
| `/cr` | Démarrer un compte rendu de réunion |
| `/quittance` | Générer des quittances de loyer |
| `/status` | Voir l'état d'Anya (mode actif, photos en attente) |
| `/inbox` | Revenir au mode inbox (réception simple) |
| `/cancel` | Annuler le workflow en cours |

**Comment ajouter une nouvelle commande** :

1. Dans le nouveau workflow (ex: `workflows/bail.ts`), ajouter les champs `command: 'bail'` et `commandDescription: 'Générer un bail de location'` dans l'objet Workflow
2. Enregistrer le workflow dans `workflows/registry.ts`
3. Redéployer sur Replit
4. Visiter `https://issa-capital.com/api/telegram/setup?token=<ADMIN_SETUP_TOKEN>`
5. La page verte confirme la mise à jour. Tester en tapant `/` dans le chat Telegram

**Pourquoi ce design** : le menu est auto-maintenu par le code. Pas de configuration manuelle sur BotFather, pas de risque de désynchronisation entre les commandes réellement gérées par le webhook et celles affichées dans Telegram. Ajouter un workflow = le menu se met à jour au prochain appel setup.

**Sécurité** : l'endpoint est protégé par `ADMIN_SETUP_TOKEN` (Replit Secrets). Sans token valide, retourne 401.

## Comportement par type de message — Mode inbox

| Type entrant | Action | Dossier Drive | Naming | Bonus |
|---|---|---|---|---|
| **Photo** unique | Download (qualité max) + upload | `_Inbox/Photos/` | `YYYY-MM-DD_HH-mm-ss_{slug-caption}.jpg` | Timestamp : EXIF DateTimeOriginal → Telegram message.date → now (pile de 3 fallback) |
| **Album** (media_group) | Accumulation 2s puis batch upload | `_Inbox/Photos/` | `..._01.jpg`, `_02.jpg`, ... | Timestamp : idem photo unique (1re photo de l'album) |
| **Texte court** (<80 chars) | Génère `.md` avec frontmatter YAML | `_Inbox/Notes/` | `YYYY-MM-DD_HH-mm-ss_{30-chars-slug}.md` | Source: Telegram |
| **Vocal** | Download `.ogg` brut | `_Inbox/Voice/` | `YYYY-MM-DD_HH-mm-ss_voice_Xs.ogg` | Durée en métadonnée |
| **Document** (PDF, image, ...) | Download + upload tel quel | `_Inbox/Documents/` | `YYYY-MM-DD_HH-mm-ss_{nom-original}` | MIME loggé |
| **Sticker/GIF/Vidéo** | Type non supporté | — | — | Réponse explicite |

## Comportement par type de message — Workflow CR

**Démarrage** :
- Auto si **texte ≥80 caractères** sans workflow actif (habitude Thomas préservée)
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

**Mode batch (session 11b)** : une seule invocation de `/quittance` peut produire N locataires × M mois = N×M PDFs.

**Sélection locataires** : numéros séparés par virgule (`1,3,5`), plage (`1-5`), tous (`tous` / `*`), ou recherche futée par nom. La recherche futée (session 11) est préservée : tolérante aux typos, accents, et recherche dans le `nom_officiel` du frontmatter (exact match → startsWith → contains → Levenshtein ≤ 2). Cache en mémoire 60s.

**Sélection période** : mois unique (`2026-05`, `mai 2026`), liste (`2026-04,2026-05`), plage (`2026-04 à 2026-08`), trimestre (`T2 2026`), année (`2026`), ou relatif (`mois en cours`, `mois dernier`). Max 24 mois par batch.

**Cycle complet** :

1. Thomas tape `/quittance`
2. Anya charge toutes les fiches locataires (cache 60s) depuis Drive et affiche la liste numérotée
3. Thomas sélectionne les locataires (numéros, plage, "tous", ou nom)
4. Anya confirme la sélection et demande la période
5. Thomas sélectionne la période (un ou plusieurs mois)
6. Anya affiche le récapitulatif batch (N locataires × M mois = X PDFs) + boutons "Lancer" / "Annuler"
7. Thomas clique "Lancer" → génération PDF en boucle (PDFKit A4)
8. Chaque PDF est envoyé individuellement sur Telegram avec caption "X/Y Quittance {Locataire} - {mois}"
9. Upload simultané vers Drive (`Quittances/{Locataire}/Quittance-{Locataire}-YYYY-MM.pdf`)
10. Si le PDF existe déjà → écrasement silencieux
11. Message récap final : "X/Y générées" + erreurs éventuelles ("Pauline Farssi - mai 2026 (montant_loyer manquant)")
12. Retour mode inbox

**Compatibilité ascendante** : le cas N=1 M=1 (un locataire, un mois) fonctionne identiquement — c'est juste le cas minimal du batch. La recherche futée par nom est toujours disponible.

**Fichiers lib** : `src/lib/secretariat/rent/` (types, locataires, biens, bailleur, num-en-lettres, dates-fr, signature, pdf-quittance)

**Variables d'environnement optionnelles** :
- `DRIVE_QUITTANCES_FOLDER_ID` — ID du dossier parent pour les quittances
- `DRIVE_VAULT_ROOT_ID` — ID du dossier racine Obsidian (pour naviguer vers les fiches locataires)

## Sécurité

- **Token Telegram** : `process.env.TELEGRAM_BOT_TOKEN` (jamais en clair, jamais committé)
- **Secret webhook** : `X-Telegram-Bot-Api-Secret-Token` vérifié via `timingSafeEqual` (`TELEGRAM_WEBHOOK_SECRET`)
- **Whitelist statique** : `TELEGRAM_ALLOWED_CHAT_IDS` (chat_id de Thomas en dur) — refuse tout autre user
- **OAuth Google Drive** : refresh token (`GOOGLE_REFRESH_TOKEN`) avec scope Drive uniquement
- **Anti-replay Telegram** : retourne toujours 200 OK pour éviter les reposts agressifs

## Variables d'environnement requises

```
TELEGRAM_BOT_TOKEN          # token bot @BotFather
TELEGRAM_WEBHOOK_SECRET     # secret arbitraire pour vérifier la provenance
TELEGRAM_ALLOWED_CHAT_IDS   # chat_id Thomas (CSV pour plusieurs)
ANTHROPIC_API_KEY           # Claude API
GOOGLE_CLIENT_ID            # OAuth2 Drive
GOOGLE_CLIENT_SECRET        # OAuth2 Drive
GOOGLE_REFRESH_TOKEN        # OAuth2 Drive (long-lived)
DRIVE_INBOX_FOLDER_ID       # ID du dossier _Inbox/ du vault Obsidian
ADMIN_SETUP_TOKEN           # token admin pour /api/telegram/setup (menu commandes)
```

Folder IDs Drive pour CR par entité juridique (hardcodés dans `drive-upload.ts`) :

- `IC` = ISSA Capital
- `GO` = Gradient One
- `VI` = Versi Immobilier
- `VV` = Versi Invest

## Edge cases gérés

| Cas | Comportement |
|---|---|
| Fichier > 20 MB | Réponse explicite "Fichier trop volumineux, max 20 MB" (limite Telegram Bot API) |
| Doublon timestamp | Suffixe millisecondes (`HH-mm-ss-SSS`) |
| HEIC iOS | Pas de conversion nécessaire (Telegram convertit déjà en JPEG) |
| Caractères accentués | `slugify()` ASCII pour les noms de fichiers (règle CLAUDE.md n°20) |
| Forward message | Ignoré par défaut (le `forward_from` n'est pas stocké en v1) |
| Album multi-photos | `media_group_id` accumulé avec timer 2s, batch upload |
| Workflow zombie | TTL 24h → cleanup auto au prochain message |
| User non whitelisté | Ignoré silencieusement |

## Architecture extensible — Pattern Workflow

Pour ajouter un nouveau workflow (ex: quittance de loyer, bail) :

```
src/lib/secretariat/
├── rent/                 # lib partagée quittance/bail
│   ├── types.ts          # Zod schemas (Locataire, Bien, BailleurConfig, QuittanceVariables)
│   ├── locataires.ts     # lecture fiches locataires depuis Drive
│   ├── biens.ts          # résolution des biens (biens.json)
│   ├── bailleur.ts       # config bailleur
│   ├── num-en-lettres.ts # conversion nombre → texte français
│   ├── dates-fr.ts       # formatage dates en français
│   ├── signature.ts      # chargement signature PNG
│   ├── pdf-quittance.ts  # rendu PDF (PDFKit)
│   ├── data/biens.json   # copie statique de second-cerveau/biens.yml
│   └── __tests__/        # 97 tests Vitest
└── workflows/
    ├── types.ts          # interface Workflow commune (WorkflowType = 'cr' | 'quittance')
    ├── registry.ts       # workflowRegistry: Record<WorkflowType, Workflow>
    ├── cr.ts             # workflow CR (existant)
    ├── quittance.ts      # workflow quittance de loyer
    └── bail.ts           # ← à créer Phase 3
```

**Ajouter un workflow = 4 actions :**

1. Créer `workflows/{nom}.ts` implémentant l'interface `Workflow` (`command`, `commandDescription`, `start`, `handleMessage`, `handlePhoto`, `handleVoice`, `handleCallback`, `cancel`)
2. Ajouter `'{nom}'` au type union `WorkflowType`
3. Enregistrer dans `workflowRegistry`
4. Visiter `/api/telegram/setup?token=XXX` pour synchroniser le menu Telegram

Le routing dans `route.ts` ne change pas, les autres workflows ne sont pas impactés, les tests existants passent toujours.

## Fichiers clés (à lire pour comprendre/modifier Anya)

```
src/app/api/telegram/webhook/route.ts      # entry point webhook (~1280 lignes)
src/app/api/telegram/setup/route.ts        # endpoint admin — synchronise le menu commandes Telegram
src/lib/secretariat/inbox.ts               # handlers mode inbox
src/lib/secretariat/workflows/types.ts     # interface Workflow
src/lib/secretariat/workflows/registry.ts  # registry
src/lib/secretariat/workflows/cr.ts        # workflow CR wrapper
src/lib/secretariat/conversation-store.ts  # persistance JSON (conversation, draft, photos, activeWorkflow)
src/lib/secretariat/drive-upload.ts        # uploadToDrive (CR) + uploadToInbox (inbox)
src/lib/secretariat/telegram.ts            # API Telegram (sendMessage, downloadFile, etc.)
src/lib/secretariat/pdf-generator.ts       # génération PDF CR (PDFKit)
src/lib/secretariat/types.ts               # schémas Zod
```

## Tests

```bash
npm test
# → 324/324 passent
# - 68 tests CR existants (integration + pdf-generator + counter)
# - 23 tests inbox (slugify, naming, types, edge cases)
# - 11 tests router (commandes, auto-CR, bascule mode, TTL)
# - 193 tests rent/quittance (num-en-lettres, dates-fr, biens, locataires fuzzy, types, pdf, workflow, batch parseurs)
# - 10 tests registry (listWorkflowCommands, getWorkflow, doublons, format)
# - 11 tests autres (contactSchema, rateLimit, drive-subfolder)
```

## Roadmap

**Phase 1 — Déployée**

- Mode inbox (photos, textes, vocaux, documents, albums)
- Architecture workflows extensible
- Workflow CR (wrap léger de l'existant)

**Phase 2 — Déployée (session 11)**

- Workflow quittance de loyer : `/quittance` → sélection locataire (Drive) → confirmation → période → montants → PDF A4 → upload Drive + envoi Telegram
- Lib partagée `src/lib/secretariat/rent/` : types, locataires Drive, biens, bailleur, num-en-lettres, dates-fr, signature, pdf-quittance
- **Batch N×M** : sélection multi-locataires (numéros, plages, "tous", recherche futée) + multi-mois (plage, trimestre, année) + récap + génération en boucle + envoi individuel Telegram

**Phase 3 — À venir**

- Workflow bail (parties + bien + conditions + clauses → DOCX+PDF bail)
- Envoi email locataire (Gmail API) pour quittances
- Cron mensuel quittances automatiques
- Workflows futurs : factures, devis, attestations (même pattern)

**Phase 3 — Idées en suspens**

- Transcription des vocaux en mode inbox (`_Inbox/Voice/*.ogg` + `.txt` transcription)
- Détection d'intent par Claude (proposer un workflow via bouton inline quand un mot-clé est détecté)
- Multi-user (whitelist étendue à équipe, contexte par user)

## Préférences fondateur applicables à Anya

- **Qualité > coût** : Sonnet 4.6 conservé, pas de bascule vers Haiku pour économiser quelques euros
- **Zéro MVP** : tout livrable est fini, pas bancal
- **Si on n'a rien à dire, on ne dit rien** : pas d'invention dans les CR
- **Vouvoiement institutionnel** dans les CR (Thomas dicte parfois en tutoiement, Anya structure en vouvoiement)
- **Délais réalistes** : pas de "dans la journée" dans les CR — préfère "sous 72h"

---

> Fiche maintenue par l'équipe d'agents Gradient. Pour la dernière version, vérifier ce fichier sur GitHub.
