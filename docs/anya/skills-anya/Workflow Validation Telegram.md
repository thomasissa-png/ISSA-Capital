---
skill: validation-telegram
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~30-50 cartes/semaine
modules_code:
  - src/app/api/telegram/webhook/route.ts
  - src/lib/secretariat/telegram-validation/
  - src/lib/secretariat/handlers/ (multiples)
  - src/lib/secretariat/pending-store/ [À CONFIRMER chemin]
modeles_llm: []
trigger_principal: tout workflow Anya nécessitant validation Thomas (carte inline keyboard)
output_principal: action validée → workflow downstream + cleanup pending Drive
---

# Workflow Validation Telegram — pattern transverse cartes 5 boutons + pending-store TTL 7j

> Source : `src/app/api/telegram/webhook/route.ts` + `src/lib/secretariat/telegram-validation/` + handlers spécialisés. Pipeline parent : tout workflow Anya nécessitant validation Thomas. Architecture : voir `docs/ia/anya-current-architecture.md`. Pattern transverse — utilisé par no-match, draft email, candidat, hot-context, push TickTick, photos date, etc.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — workflow downstream
- Tout workflow Anya qui détecte une action sensible nécessitant validation Thomas (création fiche, draft email, push TickTick premier essai, hot-context signal, photos date inconnue, no-match contact).
- Le workflow downstream construit le payload `{ pendingId, type, data, ttl: 7d }` puis appelle l'API de génération de carte.

### Variantes ciblées
- **2 boutons** : draft email (Modifier / Approuver).
- **3 boutons** : hot-context (Valider / Modifier / Skip), photos date (Aujourd'hui / Hier / Custom).
- **5 boutons standards** : no-match contact, candidat, validation génériques (Valider / Modifier / No-match / Skip / Délai).

### Hors trigger
- Actions silencieuses (archivage email `autre`, write-back CR) — pas de carte Telegram.
- Workflows downstream qui décident en autonomie (Email Ingest catégorisation auto via heuristique ou Haiku).

---

## 2. Input

### Fiches à consulter en début de workflow
- Aucune par défaut — la carte est générée à partir du payload fourni par le workflow appelant.
- Le pending est consultable dans `_Inbox/AnyaState/` pour audit ou recovery.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Payload workflow appelant | `{ pendingId, type, data, ttl }` | workflow downstream |
| Pending-store Drive | Pendings actifs en attente Thomas | `_Inbox/AnyaState/` |

### Convention de nommage
- **Pending fichier** : `_Inbox/AnyaState/pending-[type]-[pendingId].json` [À CONFIRMER nomenclature exacte].
- **Préfixe callback Telegram** : `[type]:[action]:[pendingId]` (ex. `email_nomatch:pro:uuid123`).

### Outils API requis
- **Telegram Bot API** — `sendMessage` avec `reply_markup` inline keyboard.
- **Google Drive API** — `vault-client` createFile/updateFileContent PATCH in-place R5 pour pending-store.

---

## 3. Étapes

### 3.1 Construction du pending
- Workflow appelant fournit : `type`, `data`, `ttl` (par défaut 7d, R3 minimum).
- Génération `pendingId` (uuid v4 ou sha1 du contenu source).
- Construction JSON :
  ```json
  {
    "pendingId": "uuid123",
    "type": "email_nomatch",
    "data": { /* spécifique au type */ },
    "createdAt": "2026-05-20T08:00:00Z",
    "ttl": "2026-05-27T08:00:00Z"
  }
  ```

### 3.2 Écriture atomique pending
- **Pattern atomique obligatoire** : `.tmp + rename`.
  1. Écriture du JSON dans `pending-[type]-[pendingId].json.tmp`.
  2. Rename atomique → `pending-[type]-[pendingId].json`.
- **JAMAIS write direct sur le fichier final** — risque corruption si crash entre Write et flush.
- Utiliser `vault-client.createFile()` avec ce pattern [À CONFIRMER implémentation exacte du `.tmp + rename` côté Drive].

### 3.3 Envoi carte Telegram
- `sendMessage` Telegram Bot API avec :
  - `text` : récap human-readable.
  - `reply_markup.inline_keyboard` : array de boutons.
- Chaque bouton : `{ text: "...", callback_data: "[type]:[action]:[pendingId]" }`.
- **Limite Telegram** : `callback_data` ≤ 64 bytes — utiliser pendingId court (uuid v4 sans tirets = 32 chars, OK).

### 3.4 Attente callback (TTL 7j R3)
- Pending persiste 7 jours minimum (R3 P1 #96 verbatim — coût pending qui traîne << re-traitement).
- Pas de polling — c'est Telegram qui POST le callback sur le webhook.

### 3.5 Réception callback
- Telegram POST sur `/api/telegram/webhook/route.ts`.
- Webhook parse `callback_query.data` → split sur `:` → `[type, action, pendingId]`.
- **Dispatch par préfixe** : selon `type`, appel du handler dédié `handlers/<type>.ts`.

### 3.6 Validation R4 (handler + dispatch + test E2E)
**Règle R4 absolue (P1 #97)** : tout nouveau préfixe callback = (a) handler `handlers/<nom>.ts` + (b) dispatch dans `webhook/route.ts` + (c) test E2E. SINON cascade vers mauvais router (incident S14 verbatim).

Préfixes connus à date [À CONFIRMER liste exhaustive] :
- `email_nomatch:` → `handlers/nomatch.ts`
- `hotcontext:` → `handlers/hotcontext.ts`
- `tickticksync_projects:` → `handlers/ticktick.ts`
- `candidat:` → `handlers/candidat.ts`
- `draft_email:` → `handlers/draft-email.ts`
- `photo_date:` → `handlers/photo.ts`
- [autres à confirmer]

### 3.7 Traitement par le handler
- Lecture du pending depuis Drive (`readFileById` ou `searchByName`).
- Exécution de l'action choisie par Thomas.
- Réponse Telegram (mise à jour du message original ou nouveau message).

### 3.8 Cleanup pending
- Suppression atomique du pending Drive après traitement réussi (`deleteFile` ou flag `processed: true`).
- Audit log dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` : `{ pendingId, type, action, timestamp }`.

### 3.9 Expiration TTL
- Cron quotidien [À CONFIRMER fréquence] scan `_Inbox/AnyaState/pending-*.json` → supprime ceux dont `ttl < now`.
- Optionnel : log expiration pour Thomas peut voir les pendings non traités.

---

## 4. Output

### Modifications vault
- **Pending-store Drive** : créé puis supprimé selon flow (PATCH in-place R5 ou createFile/deleteFile).
- **Aucune autre modif** par ce workflow direct — les modifs sont faites par les handlers downstream.

### Quarantaine
- Si pending expire sans clic Thomas → expiration silencieuse + log audit.
- Si callback reçu sur pendingId inexistant (expired ou corrupt) → message Telegram "Pending expiré ou introuvable. Action annulée."
- Si pattern `.tmp + rename` échoue → erreur logguée, pas de pending créé → carte Telegram non envoyée (workflow appelant alerté).

### Récap (gabarit Telegram envoyé à Thomas)
Spécifique à chaque type. Exemple générique :
```
[Description action proposée]

[Récap data]

[N boutons]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS de nouveau préfixe callback sans (a)(b)(c)** (R4 P1 #97) : handler dédié + dispatch dans webhook + test E2E. Sinon cascade vers mauvais router (incident S14 verbatim).
- **JAMAIS write direct pending JSON** — pattern `.tmp + rename` atomique OBLIGATOIRE.
- **TTL pending ≥ 7j STRICT** (R3 P1 #96) — jamais < 72h. Coût pending qui traîne << re-traitement.
- **callback_data ≤ 64 bytes** — contrainte Telegram. Si plus long, hash ou shortener nécessaire.
- **JAMAIS de cleanup avant traitement réussi** — si handler échoue, pending doit rester pour retry/audit.
- **JAMAIS de PATCH sans verification fileId** — si pending file a été supprimé/déplacé, lever erreur explicite.

### 5.2 Arbre de décision — routage callback
```
Telegram callback_query reçu
├── Parser callback_data → [type, action, pendingId]
├── Vérifier préfixe type ∈ liste connue ?
│   ├── NON → message erreur "Préfixe inconnu" + log alerte (incident potentiel R4)
│   └── OUI → dispatch handlers/<type>.ts
│       ├── Lecture pending Drive
│       │   ├── Pending introuvable → message "Expiré/introuvable"
│       │   └── Pending OK → exécution action
│       └── Cleanup atomique pending + audit log
```

### 5.3 Critères de qualité
- **G1 (R4 strict)** : 100% des préfixes callback ont un handler dédié + dispatch + test E2E.
- **G2 (atomicité)** : 100% des écritures pending utilisent `.tmp + rename`.
- **G3 (TTL ≥ 7j)** : 100% des pendings respectent R3.
- **G4 (callback_data ≤ 64 bytes)** : 100% des boutons respectent la contrainte Telegram.
- **G5 (cleanup post-traitement)** : zéro pending orphelin après succès handler.

### 5.4 Exemple complet (cas réel)
**Contexte** : workflow No-match Contact détecte un email d'expéditeur inconnu (`marc.dupond@notaire-paris9.fr`).

**Construction pending** :
```json
{
  "pendingId": "a1b2c3d4e5f6",
  "type": "email_nomatch",
  "data": {
    "messageId": "gmail-msg-id-xyz",
    "from": "Marc Dupond <marc.dupond@notaire-paris9.fr>",
    "subject": "Compromis Lot Henri Barbusse 3",
    "bodyPreview": "Bonjour Monsieur Issa..."
  },
  "createdAt": "2026-05-20T08:00:00Z",
  "ttl": "2026-05-27T08:00:00Z"
}
```

**Écriture atomique** :
1. Write `pending-email_nomatch-a1b2c3d4e5f6.json.tmp`.
2. Rename → `pending-email_nomatch-a1b2c3d4e5f6.json`.

**Carte Telegram** :
```
Email d'un expéditeur inconnu.

De : Marc Dupond <marc.dupond@notaire-paris9.fr>
Sujet : Compromis Lot Henri Barbusse 3
Aperçu :
> Bonjour Monsieur Issa...

[5 boutons]
- Pro     → callback "email_nomatch:pro:a1b2c3d4e5f6"
- Famille → callback "email_nomatch:famille:a1b2c3d4e5f6"
- Amis    → callback "email_nomatch:amis:a1b2c3d4e5f6"
- Autres  → callback "email_nomatch:autres:a1b2c3d4e5f6"
- Skip    → callback "email_nomatch:skip:a1b2c3d4e5f6"
```

**Thomas clique `Pro` 3h plus tard** :
1. Webhook reçoit callback_query.
2. Parse : `type=email_nomatch`, `action=pro`, `pendingId=a1b2c3d4e5f6`.
3. Dispatch vers `handlers/nomatch.ts`.
4. Handler lit pending Drive → data récupérée.
5. Création fiche `01. Contacts/Pro/Marc Dupond.md` via workflow No-match Contact.
6. Cleanup pending : suppression `pending-email_nomatch-a1b2c3d4e5f6.json`.
7. Audit log : `{ pendingId, type: "email_nomatch", action: "pro", timestamp: "..." }`.
8. Message Telegram : "Contact créé. Email re-triagé en Contact-Pro."

### 5.5 Maintenance
- **Audit R4** : à chaque ajout de préfixe, vérifier (a)(b)(c) via checklist PR. Gate G33 candidate.
- **TTL R3** : non négociable, jamais < 7j.
- **Cleanup orphelins** : cron quotidien scan pendings expirés (TTL < now).
- **Monitoring** : item `Pending Drive` du `health-monitor` [À CONFIRMER si surveillance dédiée existe] — alerter si pendings > X (saturation).
- **Tests E2E** : 1 test par préfixe minimum (R4). Baseline 1716 tests verts S19 — couvre vraisemblablement les préfixes principaux [À CONFIRMER liste tests E2E].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Pattern pending-store + carte 5 boutons introduit [À CONFIRMER session origine]. |
| S14 ou S15 | — | Standardisation TTL 7j (R3 P1 #96) [À CONFIRMER session]. |
| S14 | — | Incident cascade mauvais router → règle R4 (préfixe = handler + dispatch + E2E) [À CONFIRMER session]. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~30-50 cartes/semaine (cumul tous workflows). Coût négligeable (pas de LLM, uniquement Telegram API + Drive PATCH).

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module pending-store : `src/lib/secretariat/pending-store/` ?
- [À CONFIRMER] Nomenclature exacte des pendings : `pending-[type]-[pendingId].json` ?
- [À CONFIRMER] Implémentation exacte du pattern `.tmp + rename` côté Drive API.
- [À CONFIRMER] Liste exhaustive des préfixes callback à date (email_nomatch, hotcontext, tickticksync_projects, candidat, draft_email, photo_date, autres ?).
- [À CONFIRMER] Cron de cleanup pendings expirés : fréquence ?
- [À CONFIRMER] Monitoring item dédié `health-monitor` pour saturation pending-store ?
- [À CONFIRMER] Liste des tests E2E par préfixe — couvre-t-elle bien la baseline 1716 tests ?
- [À CONFIRMER] Sessions exactes de standardisation TTL 7j et règle R4 (S14 ou S15).
