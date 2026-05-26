# Plan S23 — Ingestion multi-boîtes (Outlook 365 : Sarani + Versi)

> Décisions verrouillées (Thomas, S23). Source pour le build email-ingest multi-compte.

## Décision

- **Path B — multi-compte natif**, boîtes branchées en direct (pas de redirection).
- 3 comptes : **Gmail** `thomas.issa@gmail.com` (existant) + **Outlook 365 Sarani** + **Outlook 365 Versi**.
- **Routage** : la boîte est le signal **PRIORITAIRE** (Sarani→contexte Sarani, Versi→Versi) mais **PAS une cloison**. Thomas mélange les usages → Anya regarde au-delà : triage → match projet/contact dans le vault, carte Telegram si ambigu. Même logique que Gmail aujourd'hui.
- **Enrichissement** : parité totale avec Gmail — contacts, projets, documents (PJ), hot-context, historiques tenus à jour, sur les 3 boîtes.
- **Sécurité** : invariant no-send étendu à Outlook (`Mail.ReadWrite` SANS `Mail.Send`) + test verrou miroir.

## Architecture

### Abstraction `EmailSource`
Découple le runner du fournisseur. Interface commune :
- `listUnprocessed(account)` → `{ id, threadId }[]`
- `fetchDetail(account, id)` → `EmailMessage` (`source: 'gmail'|'outlook'`, `+ accountId`)
- `markProcessed(account, id)` / `markToReview(account, id)`
- `hasReplyFromMe(account, threadId)`
- `createDraft(account, { to, subject, body, threadId, inReplyTo })`

Gmail = adaptateur issu de l'existant (refactor léger, zéro changement de comportement). Outlook = nouveau.

### Registre de comptes
```
ACCOUNTS = [
  { id:'gmail-thomas',   provider:'gmail',   email, business:'issa' },
  { id:'outlook-sarani', provider:'outlook', email, business:'sarani', tokenRef },
  { id:'outlook-versi',  provider:'outlook', email, business:'versi',  tokenRef },
]
```
Le runner boucle sur `ACCOUNTS` et applique le pipeline complet par compte.

### Module `outlook-source` (Microsoft Graph)
- **Auth** : OAuth2 authorization code + refresh token **par compte**. Endpoint `/api/outlook-auth` (init + callback). Stockage refresh tokens per-account (comme Google).
- **listUnprocessed** : `GET /me/mailFolders/inbox/messages` filtré sur catégorie ≠ `Anya/traité` + récence.
- **fetchDetail** : `GET` message → normalise `EmailMessage`. `conversationId` → threadId. `internetMessageId` → inReplyTo.
- **markProcessed** : `PATCH` `categories += "Anya/traité"` (catégorie créée au 1er run).
- **createDraft (réponse threadée)** : `POST /me/messages/{id}/createReply` → renvoie un **brouillon dans la conversation** ; `PATCH` du body. **JAMAIS `/sendMail`.**
- **hasReplyFromMe** : un message de la conversation envoyé par le owner (`from == owner`).

### Routage contexte (réutilise l'existant)
- triage (DeepSeek Flash) classe + extrait. `business` du compte passé en **hint prioritaire mais non bloquant**.
- match projet/contact via vault (logique existante). Match hors-business toléré (Thomas mélange). Ambigu → carte Telegram.
- enrichissement : append historique contact/projet, copie PJ si pertinent, hot-context, fiche contact (scan de la boîte concernée).

## Sécurité — no-send Outlook
- Scopes Graph (délégués) : `Mail.Read`, `Mail.ReadWrite`, `offline_access`, `User.Read`. **PAS `Mail.Send`.**
- `outlook-client` n'expose **aucune** fonction d'envoi (pas de `/sendMail`, pas de `/send`).
- Test verrou : `__tests__/no-send-invariant-outlook.test.ts` (miroir Gmail).

## Prérequis bloquant (Thomas — moi : zéro accès)
App **Microsoft Entra** (tenant 365) :
1. Entra → App registrations → New registration.
2. API permissions → Microsoft Graph → **déléguées** : `Mail.Read`, `Mail.ReadWrite`, `offline_access`, `User.Read`. **Surtout PAS `Mail.Send`.**
3. Certificates & secrets → New client secret.
4. Redirect URI (Web) : `https://issa-capital.com/api/outlook-auth/callback`.
5. Fournir `client_id`, `tenant_id`, `client_secret` (secrets VPS).
6. Consentement OAuth **par boîte** (Sarani, Versi) via le lien fourni.
> Tenant administré par un tiers → admin consent possiblement requis.

## Séquence de build
1. Interface `EmailSource` + refactor Gmail en adaptateur (comportement inchangé, tests verts).
2. `outlook-client` (Graph) : read + createReply-draft + test no-send.
3. `/api/outlook-auth` (init + callback) + stockage token per-account.
4. `outlook-source` (normalisation + markProcessed catégorie).
5. Registre comptes + boucle multi-compte dans `email-ingest-runner`.
6. Routage `business` hint + parité enrichissement.
7. Cron : 1 run boucle tous les comptes (timeout déjà 900s ; ajuster si besoin).
8. Tests E2E + gates. Branchement live dès l'app Entra créée.
