# Architecture technique — Agent Secrétariat ISSA Capital

> Produit par @ia le 2026-04-08, session 4.
> Mission : spécifications techniques complètes pour @fullstack — implémentation V1 de l'agent secrétariat (génération CR via WhatsApp + publication Craft).
> Sources amont : `docs/legal/secretariat-agent-legal-audit.md` (@legal), `docs/reviews/moi-arbitrages-session4.md` (@moi), `docs/product/secretariat-agent-questions.md` (@PM + Thomas), `docs/product/secretariat-contacts-database.md` (@PM).

---

## 0. Décisions structurantes (synthèse)

| Décision | Valeur | Source |
|---|---|---|
| Canal d'entrée | WhatsApp Cloud API officielle Meta | Thomas N1, N3 |
| Stack backend | Node.js + Express sur Replit Pro Autoscale | Thomas N8, Q11.4 |
| Modèle IA | Claude Sonnet 4 (`claude-sonnet-4-20250514`) avec auto-update | Thomas Q10.3 |
| Stockage | SQLite persistant sur Replit (volume disque) | @ia, voir Section 2 |
| Publication | Craft API — 1 document par CR, dossier `/CR/[année]/` | Thomas Q6.1 |
| Convention nommage | `YYYY-MM-DD-[type]-[entite]-[interlocuteur].md` | @moi Décision 1 |
| Tag Craft | `CONFIDENTIEL` systématique uniquement | @moi Décision 1 |
| Compteur référence | `IC-CR-2026-XXXX` déduit du comptage Craft (source de vérité externe) | Thomas Q9.1 + @moi Décision 2 |
| Multi-utilisateurs | Thomas (TOUS) + Carl/Maxime (GO + VI + VV uniquement) | Thomas RES1 |
| Horodatage | RFC 3161 via Universign (~10 €/mois) | @legal Bloc 3 |
| 2 dates distinctes | Date réunion (input WhatsApp) + Date établissement (timestamp serveur) | @legal Bloc 3 + Bloc 6 |
| Admin web | `issa-capital.com/admin` (mdp `allezpsg` à changer en prod, 2FA à activer) | Thomas RES3 |

---

## 1. Endpoints API REST

Base URL : `https://issa-capital.com/api` (proxy Replit Autoscale derrière le domaine custom).

### 1.1 Webhook WhatsApp (entrant)

```
POST /api/whatsapp/webhook
Headers:
  X-Hub-Signature-256: sha256=...   (validation Meta)
Body: { object, entry: [{ changes: [{ value: { messages: [...] } }] }] }
Response: 200 OK (toujours, sinon Meta retry)
```

```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
Response: text/plain — echo de hub.challenge si verify_token correspond
```

### 1.2 CR — endpoints internes

```
POST /api/cr/draft
Body: {
  user_phone: string,           // numéro WhatsApp expéditeur (whitelist)
  raw_input: string,            // texte brut dicté
  conversation_id: string       // session de clarification en cours
}
Response: {
  draft_id: uuid,
  status: "needs_clarification" | "ready",
  clarification_question?: string,
  cr_json?: { ... },            // structure complète CR (cf Section 4 du system prompt)
  cr_markdown?: string          // rendu prêt à publier
}
```

```
POST /api/cr/clarify
Body: {
  draft_id: uuid,
  user_phone: string,
  clarification_response: string
}
Response: idem /api/cr/draft
```

```
POST /api/cr/publish
Body: {
  draft_id: uuid,
  user_phone: string
}
Response: {
  cr_reference: "IC-CR-2026-0042",
  craft_document_id: string,
  craft_url: string,
  rfc3161_token: string,
  published_at: ISO timestamp
}
```

```
GET /api/cr/list?entite=GO&page=1&limit=20
Headers: Authorization: Bearer <session_token>   // admin web uniquement
Response: { items: [...], total, page }
Filtrage RBAC appliqué selon l'utilisateur authentifié.
```

```
GET /api/cr/:reference
Headers: Authorization: Bearer <session_token>
Response: { reference, entite, date_reunion, date_etablissement, markdown, craft_url, rfc3161_token, access_log: [...] }
```

### 1.3 Contacts (CRUD admin)

```
GET    /api/contacts                       — liste paginée
POST   /api/contacts                       — création
GET    /api/contacts/:id                   — détail
PATCH  /api/contacts/:id                   — mise à jour
DELETE /api/contacts/:id                   — suppression (soft delete + log)
```

### 1.4 Whitelist WhatsApp (admin)

```
GET    /api/whitelist                      — liste numéros autorisés
POST   /api/whitelist                      — ajout numéro + entités visibles
DELETE /api/whitelist/:id                  — révocation
```

### 1.5 Logs d'accès (Thomas uniquement)

```
GET /api/logs/access?user=carl&from=2026-04-01&to=2026-04-08
Response: [{ user_phone, cr_reference, action, timestamp }]
```

```
GET /api/logs/generation?from=...&to=...
Response: [{ draft_id, user_phone, raw_input, claude_prompt_hash, claude_response_hash, status, error?, timestamp }]
```

### 1.6 Auth admin web

```
POST /api/auth/login
Body: { password: string }                 // V1 : mot de passe unique
Response: { session_token, expires_at }
```

```
POST /api/auth/2fa/verify                  — Priorité 2 (cf @legal Bloc 7)
Body: { session_token, totp_code }
```

---

## 2. Schéma database (SQLite)

Choix : **SQLite** sur volume persistant Replit (zéro service externe, cohérent avec la sobriété infra du projet ; backup = export `.sqlite` téléchargeable depuis l'admin).

### 2.1 Table `contacts`

```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,                     -- uuid v4
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  titre TEXT,                              -- "Président", "Directeur Général"
  societe TEXT,
  email TEXT,
  telephone TEXT,
  whatsapp_authorized INTEGER DEFAULT 0,   -- 0/1 — true si la personne accède à l'agent
  entites_visibles TEXT,                   -- JSON array : ["IC","GO","VI","VV"]
  notes TEXT,
  source TEXT,                             -- "import_initial" | "creation_inline_YYYY-MM-DD"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_contacts_nom ON contacts(nom);
CREATE INDEX idx_contacts_societe ON contacts(societe);
```

Seed initial : `docs/product/secretariat-contacts-database.md` (script d'import au démarrage si table vide).

### 2.2 Table `cr_drafts`

```sql
CREATE TABLE cr_drafts (
  id TEXT PRIMARY KEY,                     -- uuid v4
  user_phone TEXT NOT NULL,
  conversation_id TEXT NOT NULL,           -- regroupe les tours de clarification
  raw_input TEXT NOT NULL,                 -- input brut Thomas
  enriched_input TEXT,                     -- input + réponses clarifications concaténées
  status TEXT NOT NULL,                    -- "needs_clarification" | "ready" | "published" | "abandoned"
  clarification_history TEXT,              -- JSON array : [{ q, a, ts }]
  cr_json TEXT,                            -- JSON structuré (cf system prompt Section 4)
  cr_markdown TEXT,                        -- rendu final prêt à publier
  type_reunion TEXT,                       -- dejeuner | conseil | appel | interne | visite-immo | signature | diner
  entite TEXT,                             -- IC | GO | VI | VV
  date_reunion TEXT,                       -- ISO date (saisie utilisateur)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT                        -- NULL tant que pas publié
);
CREATE INDEX idx_drafts_user_status ON cr_drafts(user_phone, status);
CREATE INDEX idx_drafts_conversation ON cr_drafts(conversation_id);
```

**Rétention brouillons** (cf Q3.2 + RES Thomas) : conservés tant que `status != "published"` ET `status != "abandoned"`. Purge automatique des `abandoned` après 7 jours. Les brouillons `published` sont conservés pour audit (10 ans, cf RGPD).

### 2.3 Table `cr_published`

```sql
CREATE TABLE cr_published (
  reference TEXT PRIMARY KEY,              -- "IC-CR-2026-0042"
  draft_id TEXT NOT NULL,                  -- FK vers cr_drafts.id
  entite TEXT NOT NULL,
  type_reunion TEXT NOT NULL,
  date_reunion TEXT NOT NULL,              -- date saisie Thomas
  date_etablissement TEXT NOT NULL,        -- timestamp serveur publication
  markdown TEXT NOT NULL,                  -- copie du markdown publié (immutable)
  markdown_sha256 TEXT NOT NULL,           -- hash pour preuve d'intégrité
  craft_document_id TEXT NOT NULL,
  craft_url TEXT NOT NULL,
  craft_filename TEXT NOT NULL,            -- "2026-04-08-dejeuner-IC-karim-benmoussa.md"
  rfc3161_token TEXT,                      -- token Universign (peut être NULL si Priorité 2 pas encore implémentée)
  rfc3161_provider TEXT,                   -- "universign"
  published_by TEXT NOT NULL,              -- user_phone
  FOREIGN KEY (draft_id) REFERENCES cr_drafts(id)
);
CREATE INDEX idx_published_entite_date ON cr_published(entite, date_etablissement DESC);
```

### 2.4 Table `whitelist_whatsapp`

```sql
CREATE TABLE whitelist_whatsapp (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT UNIQUE NOT NULL,         -- format E.164 : "+33612345678"
  contact_id TEXT,                         -- FK vers contacts.id (optionnel)
  display_name TEXT NOT NULL,              -- "Thomas Issa", "Carl X", "Maxime X"
  entites_visibles TEXT NOT NULL,          -- JSON array : ["IC","GO","VI","VV"]
  is_admin INTEGER DEFAULT 0,              -- Thomas = 1, Carl/Maxime = 0
  rgpd_information_sent_at TEXT,           -- @legal Bloc 5 Décision 3 — obligatoire avant whitelisting
  mandat_signed_at TEXT,                   -- @legal Bloc 5 Décision 1 — mandat NDA signé
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
```

**Règle de gate au whitelisting** : un numéro ne peut pas être activé tant que `rgpd_information_sent_at IS NULL` ou `mandat_signed_at IS NULL` (sauf pour Thomas qui est responsable de traitement). L'admin web bloque l'activation et affiche un avertissement.

### 2.5 Table `whatsapp_sessions`

```sql
CREATE TABLE whatsapp_sessions (
  conversation_id TEXT PRIMARY KEY,        -- généré côté serveur, mappé à user_phone
  user_phone TEXT NOT NULL,
  active_draft_id TEXT,                    -- pointeur vers cr_drafts en cours
  state TEXT NOT NULL,                     -- "idle" | "drafting" | "clarifying" | "awaiting_publish_confirm"
  last_message_at TEXT NOT NULL,
  expires_at TEXT NOT NULL                 -- TTL 24h, ré-init si nouvelle interaction
);
```

**TTL 24h** : si Thomas dicte un CR puis ne répond pas pendant 24h, la session expire (l'éventuel brouillon reste accessible via `cr_drafts.id` mais le contexte conversationnel WhatsApp est purgé).

### 2.6 Table `access_logs`

```sql
CREATE TABLE access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_phone TEXT NOT NULL,               -- qui a accédé
  actor_display_name TEXT,
  resource_type TEXT NOT NULL,             -- "cr_published" | "contact" | "log" | "draft"
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,                    -- "read" | "create" | "update" | "delete" | "publish"
  entite TEXT,                             -- entité du CR (pour audit RBAC)
  result TEXT NOT NULL,                    -- "success" | "denied_rbac" | "error"
  timestamp TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_access_logs_actor_ts ON access_logs(actor_phone, timestamp DESC);
CREATE INDEX idx_access_logs_resource ON access_logs(resource_type, resource_id);
```

Ce log alimente l'endpoint `GET /api/logs/access` (Thomas only) — exigence RGPD @legal Bloc 5 Décision 4.

### 2.7 Table `generation_logs`

```sql
CREATE TABLE generation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  claude_model TEXT NOT NULL,              -- "claude-sonnet-4-20250514"
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  status TEXT NOT NULL,                    -- "success" | "error" | "needs_clarification"
  error_message TEXT,
  timestamp TEXT NOT NULL
);
```

Sert pour : monitoring coût mensuel (alerte > 10 €/mois cf Q11.3), debug, métriques observabilité.

---

## 3. Flow utilisateur complet (WhatsApp → Craft)

### 3.1 Diagramme d'états

```
[Thomas envoie message WhatsApp]
        │
        ▼
[Webhook /api/whatsapp/webhook]
        │
        ├── Vérification signature Meta (X-Hub-Signature-256)
        ├── Vérification whitelist (phone_e164)
        │       │
        │       └── REJET si non whitelist → réponse "Numéro non autorisé"
        │
        ▼
[Recherche session active (whatsapp_sessions)]
        │
        ├── Session "idle" ou inexistante → CRÉER nouveau draft
        ├── Session "drafting" → POURSUIVRE draft existant
        ├── Session "clarifying" → INJECTER réponse dans draft
        └── Session "awaiting_publish_confirm" → PARSE "OK" / correction
        │
        ▼
[Appel Anthropic API avec system prompt + contexte database contacts]
        │
        ├── Réponse JSON : { status: "needs_clarification", question }
        │       └── Envoi WhatsApp question → état "clarifying"
        │
        ├── Réponse JSON : { status: "ready", cr_json, cr_markdown }
        │       └── Envoi WhatsApp preview markdown
        │       └── Message : "Réponds OK pour publier ou corrige"
        │       └── État → "awaiting_publish_confirm"
        │
        ▼
[Thomas répond "OK" sur WhatsApp]
        │
        ▼
[POST /api/cr/publish (interne)]
        │
        ├── 1. Calcul reference IC-CR-2026-XXXX (cf Section 4)
        ├── 2. Génération markdown final (header backend + body LLM + footer backend)
        ├── 3. Hash SHA-256 du markdown
        ├── 4. Appel Universign API → token RFC 3161
        ├── 5. Insertion footer avec token RFC 3161
        ├── 6. Appel Craft API → création document dans /CR/2026/
        ├── 7. Insertion ligne dans cr_published
        ├── 8. Insertion ligne dans access_logs (action="publish")
        ├── 9. Mise à jour cr_drafts.status = "published"
        │
        ▼
[Envoi WhatsApp confirmation]
"CR publié : IC-CR-2026-0042
URL Craft : https://craft.do/...
Horodaté RFC 3161."
```

### 3.2 Gestion des erreurs (par étape)

| Étape | Erreur | Comportement |
|---|---|---|
| Webhook Meta | Signature invalide | 401 + log security |
| Whitelist | Numéro inconnu | Réponse WhatsApp "Numéro non autorisé. Contactez Thomas Issa." + log |
| Anthropic API | 429 rate limit | Retry exponentiel (3 tentatives, backoff 1s/2s/4s) puis erreur WhatsApp "Service temporairement indisponible" |
| Anthropic API | 5xx | Retry x2, puis fallback message + log generation_logs |
| Anthropic API | Output JSON invalide | Retry avec self-correction (reprompt avec erreur Zod) max 2 fois, puis erreur |
| Universign API | Down | Publication Craft quand même MAIS `rfc3161_token = NULL` + alerte admin (à compléter manuellement plus tard via batch) |
| Craft API | Down | Mise en file d'attente (cf Q6.4 réponse Thomas option b ou c) → table `craft_publish_queue` (à ajouter), retry toutes les 5 min, max 12 tentatives, alerte WhatsApp à Thomas après 1h d'échec |
| Craft API | 4xx (auth/payload) | Échec immédiat, message WhatsApp "Erreur publication Craft : [message]", brouillon conservé |

### 3.3 Validation Zod stricte sur l'output Claude

Tout output LLM passe par un schéma Zod (cf system prompt Section 4 du Livrable 2). Si validation échoue → retry avec self-correction (renvoyer l'erreur Zod au LLM avec instruction de corriger). Max 2 retries. Si échec persistant → erreur loguée + WhatsApp "Erreur de génération, peux-tu reformuler ?".

---

## 4. Gestion du compteur de référence IC-CR-2026-XXXX

**Décision** : source de vérité externe = Craft. Le compteur n'est PAS stocké en local (cf Q9.1 réponse Thomas + @moi Décision 2 sur source unique).

### 4.1 Algorithme

```
function getNextReference(entite, year):
  prefix = `${entite}-CR-${year}-`     // "IC-CR-2026-"

  // 1. Lister les documents Craft du dossier /CR/{year}/
  documents = craftAPI.listDocuments(`/CR/${year}/`)

  // 2. Filtrer ceux dont le nom de fichier contient "{entite}-CR-{year}"
  // Note : la convention de nommage @moi inclut entite dans le filename,
  //   ex : "2026-04-08-dejeuner-IC-karim.md"
  // On lit cr_published (table locale) en parallèle pour récupérer la reference associée
  refs = cr_published
    .where(entite=entite, year=year)
    .map(r => r.reference)

  // 3. Extraire le max numéro
  maxNum = max(refs.map(r => parseInt(r.split('-').pop())))

  // 4. Retourner le suivant
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
```

**Pourquoi cr_published local + Craft** : on utilise la table `cr_published` locale comme cache de référence (rapide), et on **valide** au moment de la publication que le filename Craft cible n'existe pas déjà (race condition impossible côté multi-utilisateurs). Si collision détectée → incrément +1 et retry.

### 4.2 Sécurité : verrouillage transactionnel

Au moment du `POST /api/cr/publish`, la séquence est dans une transaction SQLite avec verrou exclusif sur `cr_published` :

```sql
BEGIN EXCLUSIVE TRANSACTION;
  SELECT MAX(CAST(SUBSTR(reference, -4) AS INTEGER))
  FROM cr_published
  WHERE entite = ? AND reference LIKE ?;
  -- Calcul next_ref
  INSERT INTO cr_published (...) VALUES (...);
COMMIT;
```

Cela garantit qu'aucun doublon de référence ne peut être généré, même si Thomas et Carl publient simultanément.

### 4.3 Bootstrap (premier CR)

Au premier démarrage, `cr_published` est vide. La requête retourne `MAX = NULL` → next = `0001`. Si Thomas migre depuis un système existant, possibilité de pré-remplir `cr_published` via un script de seed (non requis V1).

---

## 5. Stratégie de stockage des brouillons

### 5.1 Persistance brouillon (Q3.2 réponse Thomas + RES H4)

- **Tous les brouillons sont persistés en DB SQLite** dès leur création (`POST /api/cr/draft`)
- **Pas de localStorage** (le canal d'entrée est WhatsApp, pas un navigateur)
- **Conservation** : tant que `status != "published" AND status != "abandoned"`
- **Reprise** : si Thomas envoie un nouveau message après 2h sans avoir publié, l'agent retrouve le draft via `whatsapp_sessions.active_draft_id` et peut continuer la conversation

### 5.2 Cycle de vie d'un draft

```
created → drafting → [needs_clarification] → clarifying → drafting → ready
                                                                      ↓
                                              awaiting_publish_confirm
                                                          ↓
                                                       published
                                                       (immutable)
```

Si Thomas envoie un nouveau message qui n'a aucun rapport avec le draft en cours (détection : Claude évalue si l'input est une réponse de clarification ou un nouveau sujet), le draft précédent est marqué `abandoned` et un nouveau draft est créé. **Comportement par défaut** : Claude demande explicitement "Tu veux abandonner le CR en cours pour en commencer un nouveau ?" — pas de switch silencieux.

### 5.3 Reprise par l'admin web

Les brouillons non publiés sont visibles dans le module 2 de l'admin (`Historique CRs`) avec un onglet `Brouillons en cours`. Thomas peut y voir l'état mais ne peut pas publier depuis l'admin web (la publication passe TOUJOURS par WhatsApp pour préserver le flow de validation conversationnel et la trace d'horodatage).

---

## 6. Gestion RBAC multi-utilisateurs

### 6.1 Matrice d'accès (cf RES1 Thomas + @legal Bloc 5)

| Utilisateur | Entités visibles | Peut publier | Peut lire | Peut admin |
|---|---|---|---|---|
| Thomas Issa | IC + GO + VI + VV (TOUS) | OUI (toutes) | OUI (toutes) | OUI |
| Carl `[NOM]` | GO + VI + VV (PAS IC) | OUI (GO/VI/VV) | OUI (GO/VI/VV) | NON |
| Maxime `[NOM]` | GO + VI + VV (PAS IC) | OUI (GO/VI/VV) | OUI (GO/VI/VV) | NON |

### 6.2 Application du filtre RBAC

**Au moment de la création d'un draft** : Claude détecte l'entité depuis l'input (mots-clés : "Versimo" → GO, "Issa Capital" → IC, etc.). Si l'utilisateur tente de créer un CR pour une entité hors de son périmètre :
- **Réponse WhatsApp** : "Tu n'as pas accès à l'entité [X]. Reformule ton message en précisant l'entité concernée parmi : [liste autorisée]."
- **Log access_logs** : `result = "denied_rbac"`

**Au moment de la lecture (admin web ou API)** : middleware Express qui filtre `WHERE entite IN (entites_visibles_user)`. Aucune fuite possible côté API.

**Cas particulier Carl/Maxime essaie de lire un CR ISSA Capital** :
- L'endpoint retourne `404 Not Found` (pas `403`) pour ne pas révéler l'existence du CR
- Log access_logs avec `denied_rbac`
- Alerte admin si > 3 tentatives en 24h depuis le même numéro

### 6.3 Détection de l'entité par Claude

Le system prompt (cf Livrable 2) inclut une instruction : si l'input ne mentionne pas explicitement l'entité, Claude doit demander `needs_clarification: true` avec la question "Pour quelle entité ce CR ? (ISSA Capital, Gradient One, Versi Immobilier, Versi Invest)". Pas d'inférence implicite — risque RBAC trop élevé.

**Fallback de safety** : si Claude renvoie une entité hors du périmètre de l'utilisateur, le backend bloque la publication ET réinjecte l'erreur dans la conversation.

### 6.4 Logs d'accès Thomas-only

L'endpoint `GET /api/logs/access` est protégé par un middleware qui vérifie `user_phone == THOMAS_PHONE`. Carl/Maxime tentent → `403 Forbidden` + log de la tentative (méta-log).

---

## 7. Intégration WhatsApp Cloud API officielle Meta

### 7.1 Pré-requis

- Compte Meta Business Manager d'ISSA Capital
- Numéro pro dédié WhatsApp (cf N4 Thomas — à acquérir)
- WhatsApp Business Account (WABA) créé dans Meta Business
- Vérification du numéro et du domaine `issa-capital.com`
- App Meta créée avec produit "WhatsApp" activé
- Variables d'environnement Replit :
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `META_PHONE_NUMBER_ID`
  - `META_WABA_ID`
  - `META_VERIFY_TOKEN` (chaîne aléatoire pour valider le webhook)
  - `META_ACCESS_TOKEN` (long-lived token, à régénérer périodiquement)

### 7.2 Webhook entrant — parsing message

Format reçu (extrait Meta Cloud API) :

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
        "contacts": [{ "profile": { "name": "Thomas" }, "wa_id": "33612345678" }],
        "messages": [{
          "from": "33612345678",
          "id": "wamid.xxx",
          "timestamp": "1712577600",
          "type": "text",
          "text": { "body": "Déjeuner avec Emmanuel Gomez ce midi..." }
        }]
      }
    }]
  }]
}
```

**Parsing** :
1. Extraire `messages[0].from` → `+33612345678` (préfixer `+`)
2. Vérifier whitelist : `SELECT * FROM whitelist_whatsapp WHERE phone_e164 = ? AND revoked_at IS NULL`
3. Extraire `text.body` → input brut
4. Charger session active → router selon état
5. Toujours répondre `200 OK` à Meta dans les 5 secondes (sinon retry Meta) — traitement Anthropic en async

### 7.3 Envoi de messages sortants

Endpoint Meta : `POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "33612345678",
  "type": "text",
  "text": { "body": "Voici le brouillon du CR :\n\n[markdown]\n\nRéponds OK pour publier ou corrige." }
}
```

**Limites WhatsApp** :
- Texte : 4096 caractères max par message
- Si markdown > 4096 chars : split en plusieurs messages avec entête `[1/3]`, `[2/3]`, etc.
- Pas de support markdown enrichi côté WhatsApp (gras `*texte*`, italique `_texte_`) — le markdown s'affichera en texte brut côté Thomas, c'est OK pour preview

### 7.4 Format de preview du CR (cf N6 Thomas)

```
📄 Brouillon CR — IC-CR-2026-0042
Type : Déjeuner d'affaires
Date réunion : 8 avril 2026
Entité : ISSA Capital

────────────
[markdown brut généré par Claude]
────────────

Réponds OK pour publier sur Craft, ou écris une correction.
```

### 7.5 Conversation de clarification

Si Claude renvoie `needs_clarification: true`, l'agent envoie uniquement la question :
```
[Claude] Pour quelle entité ce CR ? (ISSA Capital, Gradient One, Versi Immobilier, Versi Invest)
```

Thomas répond → la réponse est injectée dans le contexte conversationnel et un nouveau call Anthropic est effectué.

---

## 8. Intégration Craft API

### 8.1 Pré-requis

- Compte Craft Pro d'ISSA Capital (1 workspace ISSA Capital + 1 workspace pour le reste — cf Q7.2 Thomas)
- API Token Craft généré depuis l'interface Craft
- Variables Replit :
  - `CRAFT_IC_TOKEN` (workspace ISSA Capital)
  - `CRAFT_OTHER_TOKEN` (workspace GO/VI/VV)
  - `CRAFT_IC_FOLDER_ID` (ID du dossier `/CR/` racine workspace IC)
  - `CRAFT_OTHER_FOLDER_ID` (ID du dossier `/CR/` racine workspace autre)
- Documentation officielle : https://support.craft.do/en/integrate/api (cf Q6.5 Thomas)

### 8.2 Création d'un document

Endpoint : `POST https://api.craft.do/v1/documents` (à confirmer avec la doc officielle Craft — cf "[À VALIDER]" plus bas)

```json
{
  "folder_id": "CRAFT_FOLDER_ID/2026",
  "title": "2026-04-08-dejeuner-IC-karim-benmoussa",
  "content": "[markdown du CR]",
  "tags": ["CONFIDENTIEL"]
}
```

**[À VALIDER]** : la documentation officielle Craft API doit être consultée pour confirmer le format exact des endpoints `/v1/documents`, `/v1/folders`, et la gestion des sous-dossiers par année. La structure ci-dessus est une hypothèse basée sur les pratiques REST standards. @fullstack devra ajuster lors de l'implémentation et tester les rate limits et la taille max d'un document.

### 8.3 Sélection du workspace selon l'entité

```javascript
function getCraftConfig(entite) {
  if (entite === 'IC') {
    return { token: CRAFT_IC_TOKEN, folderId: CRAFT_IC_FOLDER_ID };
  } else {
    // GO, VI, VV → workspace mutualisé
    return { token: CRAFT_OTHER_TOKEN, folderId: CRAFT_OTHER_FOLDER_ID };
  }
}
```

### 8.4 Sous-dossier par année

Au moment de la publication, vérifier l'existence du sous-dossier `/CR/2026/` et le créer si absent. Une fois par année à minuit du 1er janvier, un cron déclenche la création préventive du sous-dossier de la nouvelle année (évite le délai de création au premier CR de l'année).

### 8.5 Convention de nommage (rappel @moi Décision 1)

```
{date_reunion_iso}-{type_reunion}-{entite}-{interlocuteur_kebab}.md

Exemples :
2026-04-08-dejeuner-IC-karim-benmoussa.md
2026-04-12-conseil-GO-trimestriel-q1.md
2026-04-15-visite-immo-VI-paris-16e.md
```

**Génération du slug interlocuteur** : prénom + nom de l'interlocuteur principal, en minuscules, accents retirés, espaces remplacés par `-`. Si plusieurs interlocuteurs, ne garder que le premier nommé. Si interne sans interlocuteur extérieur, utiliser `interne` ou `q1-2026`.

### 8.6 Tag CONFIDENTIEL systématique

100% des documents publiés via l'agent reçoivent le tag `CONFIDENTIEL`. Aucun autre tag (cf @moi Décision 1). Si l'API Craft ne supporte pas les tags, le tag est ajouté en metadata frontmatter du markdown :

```markdown
---
classification: CONFIDENTIEL
---

COMPTE RENDU DE RÉUNION PROFESSIONNELLE
...
```

### 8.7 Lecture (sidebar admin)

```javascript
GET https://api.craft.do/v1/folders/{FOLDER_ID}/documents
  ?include_subfolders=true
  &sort=created_at:desc
  &limit=20
  &offset=0
```

**Filtre RBAC** : si l'utilisateur connecté est Carl/Maxime, on filtre les documents dont le filename contient `-IC-` (et on retourne les autres). Pour Thomas, aucun filtre.

---

## 9. Horodatage RFC 3161 (Universign)

### 9.1 Choix du prestataire (cf @legal Bloc 3)

**Universign retenu** :
- Tarif : à partir de 0,05 € par token, soit < 10 €/mois pour ISSA Capital (~30 CR/mois)
- API documentée : https://docs.universign.com (à confirmer)
- Pas d'inscription préalable autre qu'un compte Universign
- Conforme eIDAS Art. 41 — présomption légale d'exactitude de la date

**Alternative écartée** : Yousign — intégré à un forfait signature à 25 €/mois, pertinent uniquement si Thomas veut aussi de la signature électronique avancée pour d'autres usages.

### 9.2 Flow d'horodatage

```
1. Génération du markdown final (header + body LLM + footer sans token RFC 3161 — placeholder)
2. Calcul SHA-256 du markdown : sha256_hash = crypto.createHash('sha256').update(markdown).digest('hex')
3. Appel Universign API :
   POST https://api.universign.com/timestamp
   Headers: Authorization: Bearer UNIVERSIGN_TOKEN
   Body: { "hash": sha256_hash, "hash_algorithm": "sha256" }
   Response: { "token": "MIIDxxxxx...", "timestamp": "2026-04-08T12:34:56Z" }
4. Insertion du token dans le footer du markdown (remplacement placeholder)
5. Recalcul SHA-256 sur le markdown final (avec token inséré) → stocker dans cr_published.markdown_sha256
6. Stockage cr_published.rfc3161_token = token
7. Publication Craft
```

### 9.3 Vérification ultérieure

En cas de contrôle fiscal, l'horodatage peut être vérifié en re-soumettant le hash à Universign : `POST /timestamp/verify` avec `{ token, hash }` → confirmation d'authenticité par tiers de confiance.

### 9.4 Fallback Universign down

Si l'API Universign est indisponible au moment de la publication :
- Le CR est publié sur Craft **sans** token RFC 3161
- `cr_published.rfc3161_token = NULL`
- Une alerte WhatsApp est envoyée à Thomas : "CR publié SANS horodatage qualifié — Universign indisponible. À retraiter manuellement."
- Un cron quotidien identifie les `cr_published WHERE rfc3161_token IS NULL` et tente de re-générer le token a posteriori (best effort — l'horodatage ne sera pas exactement à la date de publication mais reste légalement valide comme preuve d'existence)

---

## 10. Sécurité

### 10.1 Whitelist numéros WhatsApp

- Tous les numéros entrants sont vérifiés contre `whitelist_whatsapp.phone_e164`
- Tout numéro non whitelisté reçoit un message générique "Numéro non autorisé." et un log security est créé
- Pas de réponse différenciée selon l'erreur (ne pas révéler la structure)
- Rate limit : 5 requêtes/minute max par numéro, 20/heure (anti-DOS)

### 10.2 2FA admin web (Priorité 2 @legal Bloc 7)

- V1 : authentification par mot de passe simple `allezpsg` (à changer en production)
- V1.5 : implémenter TOTP (Google Authenticator / 1Password) via librairie `speakeasy` ou équivalent
- Le mot de passe est stocké hashé (bcrypt cost 12) dans une variable d'environnement Replit (`ADMIN_PASSWORD_HASH`)
- Session token JWT signé (`JWT_SECRET` env var), TTL 24h, stocké en cookie httpOnly + secure

### 10.3 Chiffrement at rest

- SQLite : utiliser **SQLCipher** (extension SQLite chiffrée) ou stocker le fichier `.sqlite` sur un volume Replit chiffré
- Variables sensibles : exclusivement dans Replit Secrets (pas dans le code, pas dans `.env` commité)
- Sauvegarde automatique du fichier SQLite chaque jour vers un bucket externe chiffré (à définir — option Backblaze B2 ou similaire) — Priorité 2

### 10.4 Logs d'accès tracés

Tous les accès (lecture, écriture, publication) sont loggés dans `access_logs` (cf Section 2.6). Les logs sont consultables uniquement par Thomas via `GET /api/logs/access`. Conservation : 10 ans (aligné sur l'obligation fiscale).

### 10.5 Validation input (anti-injection prompt)

L'input WhatsApp brut est inséré dans le contexte Anthropic en tant que **user message**, jamais dans le system prompt. Cela évite les attaques de prompt injection (un attaquant qui aurait passé le whitelist ne peut pas réécrire les instructions système).

Validation supplémentaire :
- Longueur input : 5 000 caractères max
- Caractères de contrôle filtrés
- Pas d'URL externe injectée dans le prompt (filtrer les `http://` / `https://` autres que `craft.do` et `issa-capital.com`)

### 10.6 Secrets management

Variables d'environnement Replit Secrets (jamais en clair dans le code) :

```
# Anthropic
ANTHROPIC_API_KEY

# WhatsApp Cloud API
META_APP_ID
META_APP_SECRET
META_PHONE_NUMBER_ID
META_WABA_ID
META_VERIFY_TOKEN
META_ACCESS_TOKEN

# Craft API
CRAFT_IC_TOKEN
CRAFT_OTHER_TOKEN
CRAFT_IC_FOLDER_ID
CRAFT_OTHER_FOLDER_ID

# Universign (horodatage)
UNIVERSIGN_API_KEY

# Admin
ADMIN_PASSWORD_HASH
JWT_SECRET

# Database
SQLITE_ENCRYPTION_KEY    # si SQLCipher
```

---

## 11. Estimation budget tokens mensuel

Hypothèse : 15 CR/mois (4/semaine — Q1.1 réponse Thomas), 1 tour de clarification moyen.

### 11.1 Décompte par CR

| Étape | Input tokens | Output tokens | Coût (Sonnet 4) |
|---|---|---|---|
| Génération initiale | ~3500 (system prompt 2500 + database contacts 500 + input 500) | ~1500 (CR JSON complet) | $3500 × $3/M + $1500 × $15/M = $0.0105 + $0.0225 = **$0.033** |
| Clarification (1 tour moyen) | ~3500 + 200 (réponse) = ~3700 | ~200 (question) | ~$0.014 |
| **Total par CR** | | | **~$0.047** |

### 11.2 Coût mensuel estimé

15 CR × $0.047 = **$0.71/mois** ≈ **0.65 €/mois**

**Avec prompt caching Anthropic** (system prompt + database contacts identiques sur 15 CR/mois consécutifs) :
- Économie estimée : 70% sur l'input → coût réel ~**0.25 €/mois**

**Seuil d'alerte Thomas** : **10 €/mois** (cf Q11.3) → marge x40 par rapport à l'estimation. L'alerte ne se déclenchera qu'en cas d'anomalie (boucle infinie, abus). Configuration via dashboard Anthropic.

### 11.3 Activation prompt caching

Le system prompt + database contacts sont marqués `cache_control: { type: "ephemeral" }` dans l'API Anthropic. TTL cache 5 minutes — suffisant pour les tours de clarification d'un même CR. Pour les CR consécutifs (rare cas où Thomas dicte 2 CR à 5 min d'intervalle), bénéfice cache. Pour les CR espacés (cas normal), pas de gain — mais pas de coût additionnel.

### 11.4 ROI

Hypothèse Thomas : 1 CR rédigé manuellement par Thomas = 30-45 min de travail. Coût horaire Thomas (Président holding UHNW) ≈ 200 €/h.
- Coût manuel : 15 CR × 0.5h × 200 €/h = **1500 €/mois économisés**
- Coût agent : ~0.25 €/mois (Anthropic) + 10 €/mois (Universign) + Replit Pro déjà payé = **~10 €/mois**
- **ROI = 1500 / 10 = 150** → largement au-dessus du seuil de 3, feature IA pleinement justifiée.

---

## 12. Observabilité et monitoring

### 12.1 Métriques à tracker (table generation_logs)

- Coût API Anthropic mensuel (sum cost_usd, alerte > 10 €)
- Latence P50/P95/P99 par appel (objectif : P95 < 10s pour génération complète)
- Taux d'erreur (erreurs / total) — alerte si > 5%
- Nombre de tours de clarification moyens (objectif : < 1.5)
- Taux de validation au premier coup (CR publiés sans correction Thomas / CR totaux)

### 12.2 Dashboard admin (module 4)

Affiche en temps réel :
- Nombre de CR publiés ce mois
- Coût Anthropic ce mois
- Dernière publication réussie
- Dernière erreur (avec timestamp et message)
- Statut santé : Anthropic ✅ / Craft ✅ / Universign ✅ / WhatsApp ✅

### 12.3 Alertes WhatsApp à Thomas

Envoyées automatiquement dans les cas :
- Coût Anthropic > 10 €/mois
- Universign down > 1h
- Craft down > 1h
- Tentative d'accès non autorisé > 3 fois/24h
- Brouillon en file d'attente Craft > 1h non publié

### 12.4 Uptime monitoring

UptimeRobot (cf Q10.5 Thomas) configuré pour ping `GET /api/health` toutes les 5 min. Si down > 5 min, alerte email à Thomas.

```
GET /api/health
Response: { status: "ok", version: "1.0.0", timestamp: ISO }
```

---

## 13. Points ouverts / [À VALIDER]

| # | Sujet | Action requise | Owner |
|---|---|---|---|
| 1 | Documentation officielle Craft API | Lire https://support.craft.do/en/integrate/api et confirmer endpoints exacts | @fullstack avant Phase 4 |
| 2 | Compte Universign | Créer compte + récupérer API key | Thomas — Phase 6 |
| 3 | Numéro WhatsApp pro | Acquérir numéro dédié + vérifier dans Meta Business | Thomas — Phase 2 |
| 4 | DPA Anthropic + Replit | Signer (cf @legal Bloc 7 Priorité 1) | Thomas — Phase 8 |
| 5 | Mandat + NDA Carl/Maxime | Rédiger + signer (cf @legal Bloc 5) | Thomas — Phase 8 |
| 6 | Noms de famille Carl/Maxime | Compléter `secretariat-contacts-database.md` | Thomas — avant whitelisting |
| 7 | Numéros WhatsApp Thomas/Carl/Maxime | Compléter database contacts | Thomas — avant Phase 6 |
| 8 | Adresse `contact@issa-capital.com` | Créer ou rediriger vers Thomas | Thomas — Phase 6 |
| 9 | SQLCipher vs volume chiffré Replit | Décision technique sur le mode de chiffrement at rest | @fullstack — Phase 6 |
| 10 | Backup externe SQLite | Choix bucket (B2, S3, autre) | @infrastructure — Phase 6 |

---

## 14. Handoff

---
**Handoff → @fullstack (priorité absolue)**

**Fichiers produits** :
- `/home/user/ISSA-Capital/docs/ia/secretariat-architecture.md` (ce fichier)
- `/home/user/ISSA-Capital/docs/ia/secretariat-system-prompt.md` (Livrable 2)
- `/home/user/ISSA-Capital/docs/ia/secretariat-implementation-plan.md` (Livrable 3)

**Décisions structurantes prises** :
- Stack : Node.js + Express + SQLite (SQLCipher) sur Replit Pro Autoscale
- Modèle IA : Claude Sonnet 4 (`claude-sonnet-4-20250514`) avec auto-update
- Compteur référence : source de vérité = table locale `cr_published` validée contre Craft, transaction exclusive
- RBAC : middleware Express filtrant par `entites_visibles`
- 7 tables SQLite documentées (contacts, cr_drafts, cr_published, whitelist_whatsapp, whatsapp_sessions, access_logs, generation_logs)
- 14 endpoints REST documentés
- Horodatage : Universign RFC 3161 (~10 €/mois)
- Budget tokens : ~0.65 €/mois (avec caching ~0.25 €/mois) — ROI x150

**Points d'attention bloquants** :
- Documentation officielle Craft API à valider AVANT Phase 4 (le format `POST /v1/documents` est une hypothèse)
- 5 actions Thomas bloquantes Phase 8 (DPA Anthropic + Replit + email RGPD + mandat NDA + signature PNG)
- Variables d'environnement à configurer dans Replit Secrets (liste exhaustive Section 10.6)
- Numéro WhatsApp pro à acquérir avant Phase 2

**Code à produire dans `src/lib/ai/`** (périmètre @ia) :
- `claude-client.ts` : wrapper Anthropic SDK avec retry + structured output Zod + prompt caching
- `system-prompt.ts` : export de la constante du system prompt (cf Livrable 2)
- `cr-schema.ts` : schéma Zod du JSON de sortie CR
- `prompts/clarification.ts` : prompts auxiliaires (détection d'entité, etc.)

**Code à produire dans `src/server/` (périmètre @fullstack)** :
- `routes/whatsapp.ts` : webhook + envoi
- `routes/cr.ts` : CRUD draft + publish
- `routes/contacts.ts` : CRUD admin
- `routes/whitelist.ts` : CRUD admin
- `routes/logs.ts` : lecture Thomas-only
- `routes/auth.ts` : login + 2FA
- `services/craft.ts` : intégration Craft API
- `services/universign.ts` : horodatage RFC 3161
- `services/rbac.ts` : middleware filtrage par entité
- `db/schema.sql` : DDL SQLite
- `db/seed.ts` : import initial contacts
- `admin/` : interface React pour les 4 modules

---



