# Anya — Bot Telegram secrétariat ISSA Capital

> Fiche technique partageable. Source de vérité pour tout autre Claude (Cowork, Desktop, autre repo) qui doit comprendre ou faire évoluer Anya.
> Dernière mise à jour : 2026-05-12 (session 10 — extension mode inbox + architecture multi-workflows).

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
| Tests | Vitest — 102/102 passent (68 CR + 34 inbox/router) |
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
| `/inbox` | Force retour mode inbox + clear workflow actif |
| `/cancel` | Annule le workflow en cours, retour inbox |
| `/status` | Affiche le mode actuel + workflow actif s'il y en a un |

## Comportement par type de message — Mode inbox

| Type entrant | Action | Dossier Drive | Naming | Bonus |
|---|---|---|---|---|
| **Photo** unique | Download (qualité max) + upload | `_Inbox/Photos/` | `YYYY-MM-DD_HH-mm-ss_{slug-caption}.jpg` | Caption → `.txt` adjacent |
| **Album** (media_group) | Accumulation 2s puis batch upload | `_Inbox/Photos/` | `..._01.jpg`, `_02.jpg`, ... | Caption → 1 `.txt` global |
| **Texte court** (<80 chars) | Génère `.md` avec frontmatter YAML | `_Inbox/Notes/` | `YYYY-MM-DD_HH-mm-ss_{30-chars-slug}.md` | Source: Telegram |
| **Vocal** | Download `.ogg` brut | `_Inbox/Voice/` | `YYYY-MM-DD_HH-mm-ss_voice_Xs.ogg` | Durée en métadonnée |
| **Document** (PDF, image, ...) | Download + upload tel quel | `_Inbox/Documents/` | `YYYY-MM-DD_HH-mm-ss_{nom-original}` | MIME loggé |
| **Sticker/GIF/Vidéo** | Type non supporté | — | — | Réponse explicite |

## Comportement par type de message — Workflow CR

**Démarrage** :
- Auto si **texte ≥80 caractères** sans workflow actif (habitude Thomas préservée)
- Manuel via `/cr`

**Machine d'états** : `collecting` → `pending_photos` → `pending_validation` → `validated` (FIN) OU `cancelled` (FIN)

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
└── workflows/
    ├── types.ts          # interface Workflow commune
    ├── registry.ts       # workflowRegistry: Record<WorkflowType, Workflow>
    ├── cr.ts             # workflow CR (existant)
    ├── quittance.ts      # ← à créer Phase 2
    └── bail.ts           # ← à créer Phase 2
```

**Ajouter un workflow = 3 actions :**

1. Créer `workflows/{nom}.ts` implémentant l'interface `Workflow` (`start`, `handleMessage`, `handlePhoto`, `handleVoice`, `handleCallback`, `cancel`)
2. Ajouter `'{nom}'` au type union `WorkflowType`
3. Enregistrer dans `workflowRegistry`

Le routing dans `route.ts` ne change pas, les autres workflows ne sont pas impactés, les tests existants passent toujours.

## Fichiers clés (à lire pour comprendre/modifier Anya)

```
src/app/api/telegram/webhook/route.ts      # entry point webhook (~1280 lignes)
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
# → 102/102 passent
# - 68 tests CR existants (integration + pdf-generator + counter)
# - 23 tests inbox (slugify, naming, types, edge cases)
# - 11 tests router (commandes, auto-CR, bascule mode, TTL)
```

## Roadmap

**Phase 1 — Déployée**

- Mode inbox (photos, textes, vocaux, documents, albums)
- Architecture workflows extensible
- Workflow CR (wrap léger de l'existant)

**Phase 2 — À venir**

- Workflow quittance de loyer (collecte locataire/bien/mois/montant → PDF → Drive `Quittances/{Locataire}/YYYY-MM.pdf` + email locataire optionnel)
- Workflow bail (parties + bien + conditions + clauses → PDF bail)
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
