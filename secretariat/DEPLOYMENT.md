# Agent Secrétariat ISSA Capital — Guide de déploiement Replit

> Ce guide couvre le déploiement production de l'agent secrétariat sur Replit + les actions Phase 8 Thomas (juridiques, comptes externes).
>
> Pipeline code : **254/254 tests PASS** en session 8. Toutes les phases code (1, 2, 3, 4, 5, 6, 7) sont livrées. Il ne reste que la configuration externe et les actions Thomas.

---

## Vue d'ensemble

**Architecture** :
- Projet Node.js/TypeScript autonome dans `/secretariat` (séparé du site Next.js vitrine)
- Express + better-sqlite3 + Anthropic SDK + Craft API + Meta WhatsApp Cloud API + Universign
- Admin web vanilla HTML/CSS/JS sur `/admin`
- 254 tests unitaires + intégration + E2E

**Fichiers principaux** :
- `package.json` — scripts npm
- `src/server/index.ts` — serveur Express
- `src/server/utils/env.ts` — validation Zod des variables d'env
- `.env.example` — template sans secrets
- `data/secretariat.db` — base SQLite (gitignored)

---

## Phase 8 — Actions juridiques et administratives Thomas

### 8.1 — DPA Anthropic (15 min)

1. Aller sur https://privacy.anthropic.com
2. Signer le Data Processing Agreement
3. Vérifier la clause de non-utilisation des données API pour l'entraînement
4. Conserver le PDF signé dans tes archives légales

### 8.2 — DPA Replit (15 min)

1. Vérifier les conditions Replit (https://replit.com/legal)
2. Signer DPA si disponible
3. Sinon : noter l'inscription Data Privacy Framework (DPF)
4. Conserver la trace

### 8.3 — Vérification DPF Anthropic (5 min)

1. Aller sur https://www.dataprivacyframework.gov/list
2. Vérifier qu'Anthropic PBC est bien inscrit
3. Capture d'écran datée pour tes archives

### 8.4 — Email RGPD Carl + Maxime (30 min)

**Avant whitelisting**, envoyer aux personnes autorisées à utiliser WhatsApp (Carl, Maxime) le document d'information Art. 13 RGPD.

- Template fourni par `@legal` dans `docs/legal/secretariat-agent-legal-audit.md` Bloc 5
- Envoyer par email avec accusé de réception
- Conserver l'accusé

### 8.5 — Mandat + NDA Carl + Maxime (30 min)

- Rédiger le mandat d'accès + clause de confidentialité (1-2 pages)
- Signature électronique via Yousign ou DocuSign
- Conserver les PDF signés

### 8.6 — Upload signature PNG (10 min)

1. Scanner ta signature manuscrite
2. Exporter en PNG avec fond transparent (500×200 px recommandé)
3. Uploader via le module Settings de l'admin web : `/admin/dashboard.html#settings`
4. Vérifier le rendu dans un CR de test

### 8.7 — Compte Universign (15 min)

1. Créer un compte sur https://www.universign.com
2. Signer le contrat (horodatage qualifié RFC 3161)
3. Récupérer l'API key
4. Ajouter dans Replit Secrets : `UNIVERSIGN_API_KEY`

### 8.8 — Numéro WhatsApp Business pro (1-2h + 24-48h délai Meta)

1. Acquérir un numéro pro dédié (ne PAS utiliser ton numéro perso)
2. Aller sur https://business.facebook.com → Meta Business Manager
3. Créer une app WhatsApp Business (WABA)
4. Vérifier le numéro dans Meta Business Manager
5. Délai Meta : 24-48h pour la vérification
6. Une fois vérifié → générer les credentials (voir §9.2)

### 8.9 — Adresse `dpo@issa-capital.com` (15 min)

- Créer une adresse email ou rediriger vers Thomas
- Action infrastructure (Gandi / OVH / Google Workspace selon le DNS actuel)

---

## Phase 9 — Déploiement Replit

### 9.1 — Créer le Repl

1. Se connecter sur https://replit.com avec le compte ISSA Capital
2. Créer un nouveau **Node.js Repl** nommé `issa-secretariat`
3. Choisir "Import from GitHub" et pointer vers le sous-dossier `secretariat/` de `thomasissa-png/issa-capital`
4. Alternative : cloner le repo et copier manuellement le dossier `secretariat/`

### 9.2 — Configurer les Replit Secrets

Ouvrir l'onglet **Secrets** (cadenas) et renseigner ces variables :

#### Anthropic API
```
ANTHROPIC_API_KEY=sk-ant-api03-... (déjà en local .env.local)
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_MAX_TOKENS=2000
```

#### Craft API
```
CRAFT_IC_BASE_URL=https://connect.craft.do/links/EgdwyOCC09S/api/v1
CRAFT_IC_KEY=pdk_9b7bbef8-4907-d7b6-b0a2-cc509648352a
```

#### WhatsApp Cloud API (après §8.8)
```
WHATSAPP_CLOUD_API_TOKEN=EAAG... (Permanent Access Token Meta)
WHATSAPP_PHONE_ID=123456789 (Phone Number ID Meta)
WHATSAPP_VERIFY_TOKEN=<généré via: openssl rand -hex 32>
WHATSAPP_WEBHOOK_SECRET=<App Secret depuis Meta Configuration>
WHATSAPP_WHITELIST_E164=+33600000000 (ton numéro perso)
```

#### Admin web
```
JWT_SECRET=<généré via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ADMIN_PASSWORD_HASH=<généré via: npx tsx scripts/generate-admin-hash.ts allezpsg>
ADMIN_SESSION_TTL_HOURS=24
```

**IMPORTANT** : le mot de passe `allezpsg` est temporaire. Changer après première connexion prod.

#### Database
```
DB_PATH=/home/runner/data/secretariat.db
DB_ENCRYPTION_KEY=<généré via: openssl rand -hex 32>
```

**IMPORTANT** : `DB_PATH` doit pointer vers un volume persistant Replit. Les données Replit sont éphémères par défaut — configurer le volume persistant dans l'onglet **Storage**.

#### Universign (après §8.7)
```
UNIVERSIGN_API_KEY=<API key Universign>
```

#### Serveur
```
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

#### Backup (à choisir, optionnel V1)
```
BACKUP_S3_ENABLED=false  # ou true si S3 configuré
BACKUP_B2_ENABLED=false  # ou true si Backblaze B2 configuré
```

### 9.3 — Configurer le volume persistant

1. Dans Replit → **Storage** → créer un volume persistant
2. Monter sur `/home/runner/data/`
3. Vérifier que `DB_PATH` pointe bien dans ce volume
4. Les backups iront aussi dans ce volume (`data/backups/`)

### 9.4 — Installer les dépendances et builder

```bash
npm install
npm run build
```

### 9.5 — Exécuter les migrations

```bash
npm run migrate
```

Cela applique les migrations 001, 002, 003, 004, 005 dans l'ordre. Vérifier les logs :
```
[migrate] migrations appliquées: ["001_initial_schema.sql", "002_whatsapp_schema.sql", "003_admin_schema.sql", "004_2fa.sql", "005_rfc3161.sql"]
```

### 9.6 — Importer les contacts initiaux

```bash
npm run seed
```

Importe les contacts depuis `docs/product/secretariat-contacts-database.md` (10 contacts en Phase 1).

### 9.7 — Basculer SQLCipher (chiffrement at-rest)

**Procédure manuelle** (voir `scripts/migrate-to-sqlcipher.ts`) :

```bash
npx tsx scripts/migrate-to-sqlcipher.ts
```

Le script explique la procédure 10 étapes. En résumé :
1. Backup de `data/secretariat.db`
2. `sqlcipher data/secretariat.db.enc`
3. `PRAGMA key = '<DB_ENCRYPTION_KEY>';`
4. `ATTACH DATABASE 'data/secretariat.db' AS plaintext KEY '';`
5. `SELECT sqlcipher_export('main');`
6. `DETACH DATABASE plaintext;`
7. Remplacer `data/secretariat.db` par `data/secretariat.db.enc`
8. Tester avec `PRAGMA key = '<DB_ENCRYPTION_KEY>'; SELECT * FROM contacts;`
9. Redémarrer le serveur
10. Vérifier que l'app fonctionne

**NE PAS** faire cette étape en V1 — la garder pour quand Thomas est à l'aise. La DB en clair est acceptable en dev.

### 9.8 — Démarrer le serveur

```bash
npm start
```

Ou configurer le Replit Run button sur `npm start`.

Vérifier les logs :
```
[db] ouverte
[db] aucune nouvelle migration
serveur démarré port: 3001 nodeEnv: production
```

### 9.9 — Health check

```bash
curl https://<replit-domain>/api/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 5,
  "db": "ok",
  "timestamp": "2026-04-09T05:40:00.000Z"
}
```

### 9.10 — Configurer le webhook Meta WhatsApp

1. Retourner dans Meta Business Manager → App WhatsApp → **Webhooks**
2. Callback URL : `https://<replit-domain>/api/whatsapp/webhook`
3. Verify Token : la valeur de `WHATSAPP_VERIFY_TOKEN`
4. Souscrire au champ **messages**
5. Meta va faire un GET /webhook pour vérifier → doit retourner le challenge 200
6. Tester : envoyer "Hello" depuis ton numéro whitelisté
7. Vérifier dans les logs serveur qu'un draft apparaît dans `cr_drafts`

### 9.11 — Activer 2FA admin

1. Se connecter sur `https://<replit-domain>/admin/login.html` avec `allezpsg`
2. **Changer immédiatement le mot de passe** :
   - Générer un nouveau hash : `npx tsx scripts/generate-admin-hash.ts <nouveau_password>`
   - Mettre à jour `ADMIN_PASSWORD_HASH` dans Replit Secrets
   - Redémarrer le serveur
3. Activer 2FA :
   - POST `/admin/api/2fa/generate` → récupérer le QR code data URL
   - Scanner le QR avec Google Authenticator / Authy
   - POST `/admin/api/2fa/enable` avec le code TOTP courant
   - **Sauvegarder les 10 backup codes** dans un gestionnaire de mots de passe
4. Se reconnecter pour valider le flow 2FA

### 9.12 — Configurer les crons Replit

Replit ne supporte pas de cron natif intégré. 3 options :

**Option A — Cron externe via cron-job.org (recommandé V1)**
- Créer un compte sur https://cron-job.org
- Créer 2 cron jobs HTTP :
  - Backup quotidien (ex : 03:00 UTC) → `POST https://<replit-domain>/api/jobs/backup` (endpoint à créer si besoin, ou lancer via Replit Shell manuellement)
  - Backfill RFC3161 hebdomadaire → `POST https://<replit-domain>/api/jobs/rfc3161-backfill`

**Option B — Scripts manuels via Replit Shell**
```bash
npm run job:backup
npm run job:rfc3161-backfill
```
Lancer via Replit Shell manuellement ou via un cron local sur ton ordinateur qui se connecte à Replit.

**Option C — Replit Deployments (si upgrade Replit plan)**
Les Replit Deployments permettent des scheduled jobs natifs. Voir https://docs.replit.com/deployments/scheduled

### 9.13 — Configurer UptimeRobot (monitoring)

1. Créer un compte sur https://uptimerobot.com
2. Ajouter un monitor HTTP sur `https://<replit-domain>/api/health`
3. Intervalle : 5 minutes
4. Alertes : email vers Thomas

### 9.14 — Configurer l'alerte coût Anthropic

1. Se connecter sur https://console.anthropic.com
2. Billing → Usage alerts
3. Set seuil : 10 € / mois (valeur recommandée V1)
4. Email d'alerte : Thomas

---

## Phase 10 — Test bout en bout (Phase 7 du plan @ia)

### 10.1 — Premier CR de test

1. Envoyer un message WhatsApp depuis le numéro whitelisté :
   > "Test du jour, déjeuner avec <contact connu> pour discuter du dossier X. Points évoqués : budget, timing, risque. Action : relancer dans 2 semaines."

2. Vérifier dans les logs que le message est reçu
3. Envoyer "terminer" → vérifier qu'une preview WhatsApp arrive avec les boutons interactifs
4. Envoyer "valider" → vérifier que le CR est publié dans Craft
5. Aller sur Craft → vérifier le document
6. Aller sur `/admin/dashboard.html#cr` → vérifier que le CR apparaît dans l'historique
7. Aller sur `/admin/dashboard.html#logs` → vérifier que les entries `access_logs` sont présents

### 10.2 — Validation qualité du CR

- Le CR respecte-t-il le format fiscal DGFiP ?
- La signature PNG est-elle présente ?
- Le token RFC 3161 est-il présent ? (null acceptable si Universign pas encore activé)
- Le registre linguistique est-il passé composé ?
- Aucune formule bannie B1-B12 ?

### 10.3 — GO ou NO-GO production

Critères à valider avant mise en production réelle :
- [ ] Les 5 test cases du Livrable 2 Section 5 passent à 100%
- [ ] Le CR de test est validé par Thomas (rendu, contenu, conformité @legal)
- [ ] Tous les items Phase 8 sont cochés
- [ ] La 2FA admin est activée
- [ ] L'horodatage Universign fonctionne sur le CR de test (si UNIVERSIGN_API_KEY configurée)
- [ ] Les logs `access_logs` et `generation_logs` enregistrent correctement
- [ ] Le RBAC est testé (Carl ne peut PAS accéder à un CR IC si pas superadmin)
- [ ] UptimeRobot est configuré sur `/api/health`
- [ ] L'alerte coût Anthropic est configurée (> 10 €/mois)
- [ ] Le mot de passe `allezpsg` est CHANGÉ en production

---

## Annexe A — Commandes npm

```bash
# Développement
npm run dev              # serveur en mode watch (tsx)

# Build production
npm run build            # compile TypeScript → dist/
npm start                # lance dist/server/index.js

# Base de données
npm run migrate          # applique les migrations
npm run seed             # importe les contacts initiaux

# Jobs
npm run job:backup              # backup SQLite
npm run job:rfc3161-backfill    # rattrapage RFC3161

# Tests
npm test                 # lance tous les tests Vitest
npm run test:watch       # mode watch
npm run test:ui          # UI Vitest

# Scripts
npx tsx scripts/generate-admin-hash.ts <password>
npx tsx scripts/migrate-to-sqlcipher.ts
```

---

## Annexe B — Troubleshooting

### "Validation des variables d'environnement échouée"

Le schema Zod `src/server/utils/env.ts` a détecté une variable manquante ou invalide. Vérifier Replit Secrets.

### "HMAC signature invalid" sur webhook Meta

- Vérifier que `WHATSAPP_WEBHOOK_SECRET` correspond à l'App Secret Meta (pas au verify token)
- Vérifier que le `rawBody` est bien capturé (middleware `express.json({ verify })` dans `index.ts`)
- Tester avec `ngrok` en dev pour voir le payload brut

### "UniversignNotConfiguredError"

Normal si `UNIVERSIGN_API_KEY === '__TO_FILL__'` ou absent. Le publisher catch silencieusement et continue sans token. Le backfill job rattrapera quand la clé sera configurée.

### "Cannot find module @anthropic-ai/sdk"

Lancer `npm install` dans `secretariat/`.

### "Database is locked"

SQLite avec WAL mode supporte 1 seul writer. Si plusieurs process écrivent → lock. En V1 sur Replit (1 worker), pas de problème. Si upgrade vers multi-worker → migrer vers PostgreSQL.

### Admin login échoue avec "password incorrect"

- Vérifier que `ADMIN_PASSWORD_HASH` est le hash bcrypt du password courant
- Régénérer : `npx tsx scripts/generate-admin-hash.ts <password>`
- Vérifier que la variable est bien dans Replit Secrets (pas en local `.env.local`)

### "Rate limit exceeded" sur WhatsApp

Tu as dépassé 5 messages/min ou 20 messages/h sur ton numéro. Attendre la fin de la fenêtre. C'est intentionnel pour prévenir le flood.

---

## Annexe C — Architecture récap

```
[Thomas WhatsApp]
      ↓
[Meta WhatsApp Cloud API]
      ↓ webhook POST
[Replit: /api/whatsapp/webhook]
  ↓ verifyMetaSignature
  ↓ whitelistGuard
  ↓ rateLimitWhatsApp
  ↓ parseWebhookPayload
  ↓ dispatcher (content/terminer/valider/annuler)
      ↓ "terminer"              ↓ "valider"
[Anthropic API]               [cr-publisher]
  ↓ generateCR                   ↓ requestTimestamp (Universign)
  ↓ cr_drafts INSERT             ↓ publishToCraft
                                 ↓ cr_published INSERT
                                 ↓ draft.status = 'published'

[Thomas Admin Web]
      ↓
[Replit: /admin/*]
  ↓ authJwt + 2FA
  ↓ requireAdmin
  ↓ accessLogger
[Routes : contacts, logs, settings, 2FA]
```

---

## Annexe D — Fichiers critiques

| Fichier | Rôle |
|---|---|
| `src/server/index.ts` | Point d'entrée Express |
| `src/server/utils/env.ts` | Validation Zod env vars |
| `src/server/db/schema.sql` | 8 tables DB |
| `src/server/db/migrations/` | 5 migrations (001-005) |
| `src/server/services/anthropic.ts` | Wrapper Claude |
| `src/server/services/craft.ts` | Wrapper Craft |
| `src/server/services/whatsapp.ts` | Wrapper Meta |
| `src/server/services/universign.ts` | Wrapper Universign |
| `src/server/services/totp.ts` | 2FA |
| `src/server/services/auth.ts` | JWT + bcrypt |
| `src/server/routes/whatsapp.ts` | Webhook WhatsApp |
| `src/server/routes/admin/*` | Admin web (5 modules) |
| `src/server/middleware/*` | 6 middlewares |
| `src/server/jobs/*` | Backup + RFC3161 backfill |
| `public/admin/*` | UI vanilla admin |

---

**Fin du guide de déploiement.**

Pour toute question, référer à :
- `docs/ia/secretariat-architecture.md` — architecture détaillée
- `docs/ia/secretariat-system-prompt.md` — prompt Claude fiscal
- `docs/ia/secretariat-implementation-plan.md` — plan 8 phases initial
- `docs/legal/secretariat-agent-legal-audit.md` — contraintes RGPD/DGFiP
