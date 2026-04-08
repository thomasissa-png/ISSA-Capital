# Agent Secrétariat ISSA Capital

Génération de comptes rendus de réunions professionnelles via WhatsApp, publication automatique dans Craft, conformité DGFiP (art. 39-1 CGI).

**Projet séparé** du site vitrine Next.js `issa-capital.com` (qui vit à la racine du repo). Les deux projets n'ont aucune dépendance partagée.

**Architecture de référence** : `docs/ia/secretariat-architecture.md`
**Plan d'implémentation** : `docs/ia/secretariat-implementation-plan.md`

---

## État d'avancement

- [x] **Phase 1** — Setup Express + DB SQLite + endpoints fondation (ce livrable)
- [ ] Phase 2 — Intégration WhatsApp Cloud API (Meta)
- [ ] Phase 3 — Intégration Anthropic (Claude Sonnet 4) + system prompt
- [ ] Phase 4 — Intégration Craft API + publication
- [ ] Phase 5 — Admin web `issa-capital.com/admin`
- [ ] Phase 6 — Sécurité (2FA, SQLCipher, horodatage RFC 3161 Universign)
- [ ] Phase 7 — Tests bout en bout + validation Thomas
- [ ] Phase 8 — Actions juridiques préalables (Thomas)

---

## Stack

- **Runtime** : Node.js 20+
- **Framework** : Express 4
- **Langage** : TypeScript 5 (mode strict, `exactOptionalPropertyTypes`)
- **Base** : SQLite (`better-sqlite3`) — SQLCipher en Phase 6
- **Logger** : Pino (pretty en dev, JSON en prod, redaction automatique des secrets)
- **Validation** : Zod
- **Tests** : Vitest + Supertest

---

## Prérequis

- Node.js >= 20.0.0
- npm >= 10

---

## Installation

```bash
cd secretariat
npm install
```

---

## Variables d'environnement

Copier `.env.example` en `.env.local` et remplir les valeurs :

```bash
cp .env.example .env.local
```

**Variables requises en Phase 1** :

| Variable | Description | Exemple |
|---|---|---|
| `NODE_ENV` | `development` / `test` / `production` | `development` |
| `PORT` | Port du serveur Express | `3001` |
| `LOG_LEVEL` | Niveau Pino (`fatal`/`error`/`warn`/`info`/`debug`) | `info` |
| `ANTHROPIC_API_KEY` | Clé Anthropic (prefix `sk-ant-`) | `sk-ant-api03-...` |
| `ANTHROPIC_MODEL` | Modèle Claude | `claude-sonnet-4-5` |
| `ANTHROPIC_MAX_TOKENS` | Max tokens par appel | `2000` |
| `CRAFT_IC_BASE_URL` | URL de base API Craft workspace IC | `https://connect.craft.do/links/.../api/v1` |
| `CRAFT_IC_KEY` | Clé API Craft workspace IC (prefix `pdk_`) | `pdk_...` |
| `DB_PATH` | Chemin du fichier SQLite | `./data/secretariat.db` |
| `DB_ENCRYPTION_KEY` | Réservé Phase 6 (SQLCipher) | `-` |
| `SESSION_TTL_HOURS` | TTL sessions WhatsApp | `24` |

**Variables optionnelles en Phase 1** (deviendront requises en Phase 2) :

| Variable | Description |
|---|---|
| `WHATSAPP_CLOUD_API_TOKEN` | Token long-lived Meta Cloud API |
| `WHATSAPP_PHONE_ID` | ID du numéro WhatsApp Business |
| `WHATSAPP_VERIFY_TOKEN` | Token de vérification webhook Meta |
| `WHATSAPP_WEBHOOK_SECRET` | Secret de signature `X-Hub-Signature-256` |
| `WHATSAPP_WHITELIST_E164` | Liste de numéros whitelistés (séparés par `,`) |

**Sécurité** : ne jamais committer `.env.local`. Le `.gitignore` local et racine l'excluent. En production, utiliser Replit Secrets (jamais d'env en clair).

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Démarre en mode watch (`tsx watch`) |
| `npm run build` | Compile TypeScript vers `dist/` |
| `npm run start` | Démarre le serveur compilé (`node dist/server/index.js`) |
| `npm run typecheck` | Vérifie les types sans compiler (`tsc --noEmit`) |
| `npm run migrate` | Applique les migrations SQL en attente |
| `npm run seed` | Importe les contacts initiaux depuis `docs/product/secretariat-contacts-database.md` |
| `npm test` | Lance les tests Vitest (run unique) |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:ui` | Interface Vitest UI |

---

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# Remplir .env.local avec les clés (Anthropic, Craft, ...)

# 3. Initialiser la base + importer les contacts
npm run migrate
npm run seed

# 4. Lancer en dev
npm run dev

# 5. Vérifier que le serveur répond
curl http://localhost:3001/api/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3,
  "db": "ok",
  "timestamp": "2026-04-08T12:34:56.789Z"
}
```

---

## Structure

```
secretariat/
├── .env.example                      # Template variables (versionné)
├── .env.local                        # Secrets (NON versionné, ignoré par git)
├── package.json
├── tsconfig.json
├── README.md                         # Ce fichier
├── data/                             # Fichiers SQLite (ignorés par git)
├── logs/                             # Logs (ignorés par git)
└── src/
    ├── server/
    │   ├── index.ts                  # Entrypoint Express + graceful shutdown
    │   ├── db/
    │   │   ├── connection.ts         # Singleton better-sqlite3 + init
    │   │   ├── schema.sql            # DDL de référence (doc + review)
    │   │   ├── seed.ts               # Import contacts depuis docs/product
    │   │   └── migrations/
    │   │       ├── 001_initial_schema.sql
    │   │       └── runner.ts         # Exécute les migrations en attente
    │   ├── routes/
    │   │   └── health.ts             # GET /api/health
    │   ├── middleware/
    │   │   └── errorHandler.ts       # AppError + 404 + 500 handler
    │   └── utils/
    │       ├── env.ts                # Validation Zod des variables
    │       └── logger.ts             # Pino avec redaction des secrets
    └── shared/                       # (réservé Phase 2+)
```

---

## Endpoints Phase 1

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Santé du service (uptime + DB) |

Endpoints prévus en phases ultérieures : voir `docs/ia/secretariat-architecture.md` Section 1.

---

## Schéma de base

7 tables définies dans `src/server/db/schema.sql` :

| Table | Rôle |
|---|---|
| `contacts` | Répertoire enrichi (seed depuis docs) |
| `cr_drafts` | Brouillons CR en cours de rédaction |
| `cr_published` | CR publiés (immutables, audit DGFiP 10 ans) |
| `whitelist_whatsapp` | Numéros autorisés + matrice RBAC |
| `whatsapp_sessions` | État conversationnel (TTL 24h) |
| `access_logs` | Traçabilité des accès (RGPD + DGFiP) |
| `generation_logs` | Métriques LLM (coût, latence, erreurs) |

Plus une table `schema_version` pour le versioning des migrations.

---

## Déploiement Replit

Le projet est conçu pour Replit Pro Autoscale :

1. Créer un Repl Node.js pointant vers `secretariat/`
2. Configurer les variables d'environnement via **Replit Secrets** (pas `.env.local` en prod)
3. `DB_PATH` DOIT pointer vers un volume persistant Replit (ex : `/home/runner/data/secretariat.db`) — sinon la base est effacée à chaque redéploiement
4. Run command : `npm run build && npm run migrate && npm run start`
5. Configurer UptimeRobot sur `GET /api/health` (ping toutes les 5 min)

**Attention Replit autoscale** : jamais de `fire-and-forget` après la réponse HTTP — le worker est tué après envoi. Tout `await` critique AVANT `res.json()`.

---

## Sécurité Phase 1

- [x] Headers Helmet (CSP defaults)
- [x] CORS restreint à `issa-capital.com` en prod
- [x] Body limit 1 MB
- [x] Rate limit global 100 req / 15 min / IP
- [x] Validation fail-fast des variables d'env
- [x] Redaction automatique des secrets dans les logs Pino
- [x] Error handler qui ne fuite pas les stack traces
- [x] 404 handler dédié
- [x] Graceful shutdown avec fermeture DB propre
- [ ] SQLCipher / chiffrement at rest → Phase 6
- [ ] 2FA admin → Phase 6
- [ ] Rate limit fin par numéro WhatsApp → Phase 6
- [ ] Horodatage RFC 3161 → Phase 6

---

## Tests

```bash
npm test            # run unique
npm run test:watch  # mode watch
npm run test:ui     # UI Vitest
```

Phase 1 couvre :
- Validation du schéma d'env (Zod)
- Ouverture DB + application des migrations + idempotence
- Endpoint `/api/health` (200 + structure du payload + 404 handler)

---

## Licence

UNLICENSED — usage interne ISSA Capital uniquement.
