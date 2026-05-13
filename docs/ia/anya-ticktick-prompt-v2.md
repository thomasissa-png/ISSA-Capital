---
type: outil
nom: Anya - Prompt Claude Code (sync bidirectionnel TickTick) — v2
date_mise_a_jour: 2026-05-13
statut: à valider avant lancement
revision: v2 (amendée Session 14 — 7 points + propositions à arbitrer)
source_v1: second-cerveau/Anya - Prompt Claude Code TickTick sync.md
---

> Sources amont : `second-cerveau/Anya - Plan email-ingest.md`, `docs/ia/anya-spec.md`, `src/lib/secretariat/vault-client/` (S14 Jalon 1), prompt v1 ci-dessus.

# Anya — Prompt Claude Code : sync bidirectionnel vault ↔ TickTick (v2)

> Version amendée du prompt v1 (`second-cerveau/Anya - Prompt Claude Code TickTick sync.md`) suite à la revue Session 14. Ce fichier liste **les 7 amendements** + **3 décisions à valider Thomas** avant de copier-coller le prompt dans Claude Code.

---

## ⚠️ Amendements v1 → v2

| # | Point v1 | Problème | Amendement v2 |
|---|---|---|---|
| 1 | "Phase 4 après email-ingest, calendar-ingest, task-ingest" (intro) | Les plans `calendar-ingest` + `task-ingest` n'existent pas dans `docs/ia/anya-spec.md`. Pré-requis fictifs. | Remplacé par pré-requis réels : vault-client S14 Jalon 1 livré, email-ingest Jalons 2-3 livrés et stables ≥ 7 jours prod, 5 scopes OAuth acquis. |
| 2 | Clé de mapping `Todo.md:L42` (state JSON) | Position de ligne fragile : réordonnancement → mapping cassé sans recours. | ID stable injecté dans la ligne markdown via HTML comment invisible : `- [ ] description 📅 2026-05-15 #versi <!-- tt:abc123 -->`. Lecture-écriture bit-perfect via vault-client. Fallback hash + fuzzy match pour bootstrap. |
| 3 | "Total estimé : 7 jours dev" | Viole règle 5 CLAUDE.md (mindset IA, raisonner en heures Claude Code). | Recalibré ~8-12h Claude Code sur 2-3 sessions @fullstack. Détail par jalon en heures. |
| 4 | State JSON dans `secretariat/state/` (Replit local FS) | Perte au redeploy Replit. Audit JSONL split entre Replit et Drive — incohérent. | **Tout dans Drive** : state dans `_Inbox/AnyaState/ticktick-sync-state.json`, audit dans `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl`. Cohérent vault-client S14. Zéro dépendance FS Replit. |
| 5 | Sous-tâches TickTick : non spécifiées | Trou fonctionnel : si Thomas crée sous-tâche dans l'app, comment ça remonte ? | **Décision à valider** (voir section "Décisions à arbitrer"). Proposition A : sous-tâches = lignes Todo.md avec indentation 2 espaces sous parent. |
| 6 | Récurrences `repeatFlag` RRULE : "depuis 🔁 si présent" | Cible floue. Quels patterns Thomas utilise vraiment ? Si zéro usage → complexité inutile. | **Décision à valider**. Si Thomas confirme zéro récurrence dans son usage actuel → hors scope (à reporter en jalon 7 ultérieur). |
| 7 | API TickTick beta `developer.ticktick.com` | API beta, risque de rupture. Pas de plan B documenté. | Section "Risque technique" ajoutée : **Jalon 0 = spike API TickTick (1h)** avant tout dev — valider stabilité + rate limits + auth flow réel. Plan B Todoist documenté en annexe. |

## 🤔 Décisions à arbitrer Thomas (avant lancement)

### Décision A — Sous-tâches TickTick

**Cas d'usage** : Thomas crée dans l'app iPhone TickTick une tâche `Voir Versi v2 demo` avec une sous-tâche `Préparer slides`. Comment ça arrive dans le vault ?

- **Option A1 (recommandée)** — Indentation Todo.md :
  ```
  - [ ] Voir Versi v2 demo 📅 2026-05-15 #versi <!-- tt:abc123 -->
    - [ ] Préparer slides <!-- tt:def456 -->
  ```
  Cohérent avec Markdown standard. Lisible. Sync bidirectionnel symétrique.

- **Option A2** — Aplatir : sous-tâche devient tâche indépendante avec tag `#voir-versi-v2-demo`. Simple côté code, casse hiérarchie côté Thomas.

- **Option A3** — Ignorer : push tâche parent seulement, ignore sous-tâches. Risque : Thomas crée des sous-tâches qui se perdent.

**Question** : laquelle veux-tu ?

### Décision B — Récurrences

**Cas réels** : Tu utilises actuellement des tâches récurrentes dans Todo.md ? Si oui, lesquelles (daily, hebdo, mensuel, custom) ?

- Si **zéro récurrence** dans ton usage actuel → on retire le `repeatFlag` du scope v2, on ajoute un Jalon 7 ultérieur si besoin
- Si **récurrences simples** (daily/weekly/monthly) → on garde le scope mais on simplifie le mapping
- Si **récurrences custom** (RRULE complexes) → on garde tel quel, ~+1h dev

**Question** : combien de tâches récurrentes dans ton Todo.md actuel + de quel type ?

### Décision C — Plan B si TickTick API breaking change

Le spike Jalon 0 (1h) validera la stabilité. Si l'API beta TickTick a un problème critique :

- **Option C1** — Pivot Todoist : API plus stable, premium 36€/an au lieu de 28€/an
- **Option C2** — Attendre stabilisation TickTick API : risque de blocage indéterminé
- **Option C3** — Plan B alternatif : Reminders iOS via CalDAV (mais pas de tags = limitation forte)

**Question** : si pivot nécessaire, tu valides Todoist d'avance ou tu veux décider au moment ?

---

## 📋 Prompt amendé à copier-coller dans Claude Code

> ⚠️ Ne pas copier-coller tant que **Décisions A, B, C ci-dessus** ne sont pas arbitrées. Les placeholders `[A?]`, `[B?]`, `[C?]` dans le prompt doivent être remplacés par les choix Thomas.

```
Tu vas implémenter la sync bidirectionnelle entre le vault Obsidian de Thomas et TickTick, dans Anya (service Replit existant). Cette phase complète l'architecture Anya après email-ingest livré S14 (Jalons 0-3).

## Contexte

Thomas utilise Obsidian sur desktop (puissance : Agenda DataviewJS, recherche, liens). Sur iPhone, il veut UNE seule app native pour consulter et toucher rapidement à ses tâches et événements. TickTick a été retenu : multi-plateforme, filtrage robuste, vue unifiée tâches + calendrier, API ouverte.

Source de vérité : **le vault Obsidian** (`Todo.md` + `06. Réunions/`). TickTick est un MIROIR + interface mobile. Les modifications faites côté TickTick (cocher, replanifier, éditer, créer rapide) remontent dans le vault. Les modifications côté vault descendent vers TickTick.

## Pré-requis vérifiés (S14)

- ✅ `src/lib/secretariat/vault-client/` livré (Jalon 1 S14) : lecture/écriture Markdown bit-perfect via Drive, frontmatter natif, write-lock, audit JSONL, cache TTL 1h
- ✅ `src/lib/secretariat/gmail-source/` + `src/lib/secretariat/triage/` livrés (Jalons 2-3 S14) : 5 scopes OAuth Google acquis (drive + calendar.events + gmail.readonly + gmail.labels + gmail.compose)
- ✅ Router Telegram `inbox-message-router.ts` livré S13 (à mutualiser pour validations TickTick)
- ✅ Email-ingest en production depuis ≥ 7 jours sans régression (pré-requis avant ce jalon)

## Mission

Construire un sync engine bidirectionnel :

- Vault → TickTick : à chaque modification de `Todo.md` ou d'un fichier `06. Réunions/`, propager dans TickTick (create / update / complete / delete)
- TickTick → Vault : à chaque polling de l'API TickTick, détecter les modifs et propager dans le vault
- Résolution de conflits : last-write-wins par timestamp, vault gagne en cas d'égalité (source canonique)

## 0. JALON 0 OBLIGATOIRE — Spike API TickTick (1h)

**À FAIRE EN PREMIER, AVANT TOUT CODE PRODUCTION** :

1. Créer compte TickTick + générer OAuth credentials
2. Tester en local (script throwaway) :
   - OAuth flow complet (init + callback + refresh)
   - Créer une tâche via `POST /open/v1/task`
   - Lire les tâches via `GET /open/v1/task` (pagination ?)
   - PATCH une tâche
   - DELETE une tâche
   - Vérifier les rate limits (60 req/min annoncés, à confirmer)
   - Tester etag/changed_since pour le polling
3. Si breaking change ou bug critique → STOP, alerter Thomas, basculer Plan B [C?]

**Critère :** rapport de spike documenté dans `docs/ia/ticktick-api-spike-report.md`. GO/NO-GO Thomas.

## 1. Modèle de données

### Mapping tâche Obsidian → TickTick

Une ligne `- [ ] description 📅 YYYY-MM-DD #tag <!-- tt:abc123 -->` dans `Todo.md` correspond à un objet TickTick :

```typescript
interface TickTickTask {
  id: string                  // généré par TickTick à la création, **injecté dans le HTML comment de la ligne**
  title: string               // description nettoyée (sans 📅, #tags, ni HTML comment)
  content: string             // optionnel, mis vide
  dueDate: string             // ISO 8601, depuis 📅
  isAllDay: true              // toujours, sauf si 🕐 présent
  priority: 0 | 1 | 3 | 5     // mapping depuis 🔼🔽 (0 par défaut)
  status: 0 | 2               // 0 = todo, 2 = done (synced from `[ ]` / `[x]`)
  tags: string[]              // depuis #famille, #issa, etc. (sans le #)
  projectId: string           // mapping par projet inféré (cf. plus bas)
  reminder: string?           // optionnel, depuis ⏰
  // repeatFlag NON IMPLÉMENTÉ — voir décision B
}
```

### Identification stable des tâches (amendement v2)

**Clé de mapping : ID TickTick injecté dans la ligne markdown via HTML comment invisible.**

Format ligne vault avec ID :
```
- [ ] description 📅 2026-05-15 #versi <!-- tt:abc123 -->
```

- Avant premier push TickTick : ligne sans `<!-- tt:... -->`
- Après création TickTick : Anya patch la ligne pour injecter l'ID retourné
- HTML comments sont invisibles dans Obsidian rendu, mais préservés en source
- Lecture-écriture bit-perfect via vault-client (vérifier que le comment passe le frontmatter parser et l'append chrono-inverse — tests Vitest obligatoires)

**Fallback bootstrap** (state perdu / corrompu) :
1. Recalcul hash de chaque ligne sans `<!-- tt:... -->`
2. Match TickTick tasks par titre + due date + tags (fuzzy match Levenshtein)
3. Re-injection des `<!-- tt:... -->` dans le vault après reconciliation
4. Log JSONL chaque match avec confidence score (alerte Telegram si < 90% sur ≥ 1 tâche)

### Mapping réunion → TickTick

Les réunions de `06. Réunions/` sont **publiées via iCal feed** (pas via l'API tâches). Le feed est généré par Anya à un endpoint Replit `https://anya.{user}.replit.app/feed/reunions.ics?token=...`. TickTick s'y abonne via Settings → Calendar → Add Subscription.

iCal généré (RFC 5545) :

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Anya//Thomas Issa//FR
BEGIN:VEVENT
UID:{gcal_event_id ou hash du fichier}@anya.thomas
DTSTAMP:20260512T140000Z
DTSTART;VALUE=DATE:20260512
DTEND;VALUE=DATE:20260513
SUMMARY:Thomas Maxime - Point Versi
DESCRIPTION:Lien vault: obsidian://open?vault=00.%20Me&file=06.%20R%C3%A9unions%2F2026%2F05%2F2026-05-12...
CATEGORIES:reunion
END:VEVENT
...
END:VCALENDAR
```

### State + audit dans Drive (amendement v2)

**Tout dans Drive, zéro dépendance Replit local FS** :

State :
- Chemin : `_Inbox/AnyaState/ticktick-sync-state.json` (Drive)
- Lecture/écriture via vault-client S14 (mais fichier JSON, pas Markdown)
- Format :
  ```json
  {
    "version": "2026-05-13",
    "tasks": {
      "abc123": {
        "ticktick_id": "abc123",
        "ticktick_etag": "xyz",
        "vault_path": "Todo.md",
        "vault_section": "Cette semaine",
        "title_hash": "sha1(...)",
        "last_synced_at": "2026-05-12T14:32:00Z"
      }
    },
    "lastPollTickTick": "2026-05-12T14:30:00Z",
    "lastSyncStatus": "ok"
  }
  ```

Audit JSONL :
- Chemin : `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl` (Drive)
- 1 ligne JSON par opération : `{op, direction, taskId, vault_path, status, error?, ts}`
- Réutilise le module `audit-log.ts` du vault-client S14

## 2. Flux de données

### Vault → TickTick (push)

Trigger :
- **Webhook Drive API** sur modification de `Todo.md` ou `06. Réunions/**.md`
- Fallback : polling toutes les 5 min si webhook indisponible

Logique :
1. Diff le contenu actuel de `Todo.md` vs state (hash des lignes)
2. Pour chaque ligne **ajoutée sans `<!-- tt:... -->`** → POST `/open/v1/task` TickTick → patch ligne pour injecter ID retourné
3. Pour chaque ligne **modifiée avec `<!-- tt:abc123 -->`** → PATCH `/open/v1/task/abc123` (description, date, tags, status)
4. Pour chaque ligne **supprimée** (présente dans state, absente dans vault) → DELETE `/open/v1/task/{id}` + suppression state entry
5. Pour les réunions : regénérer le feed iCal complet, TickTick refresh automatiquement

### TickTick → Vault (pull)

Trigger : polling TickTick API toutes les 2-5 min.

Logique :
1. GET `/open/v1/task?status=changed_since={lastPollTickTick}` (ou équivalent endpoint disponible — à confirmer Jalon 0 spike)
2. Pour chaque tâche changée :
   - Match par `ticktick_id` dans le state
   - Si tâche existe dans le vault (recherche par `<!-- tt:abc123 -->`) :
     - Compare timestamps : si TickTick plus récent → patch ligne vault
     - Si même timestamp → vault gagne, push correctif vers TickTick (no-op)
   - Si tâche TickTick n'a pas de mapping vault → tâche créée depuis TickTick → ajouter dans `Todo.md > ## Inbox` avec format standard incluant `<!-- tt:abc123 -->`
3. Pour les tâches DELETE TickTick : **confirmation Telegram** obligatoire avant suppression vault (red line)
4. **Sous-tâches TickTick** : traitement [A?]

## 3. Détection de changements

Côté vault : 
- Hash SHA-1 de chaque ligne (sans le `<!-- tt:... -->`) stocké en state
- Comparaison hash à chaque sync : si différent → modif détectée
- Détection des suppressions : `<!-- tt:abc123 -->` présent en state, absent en vault

Côté TickTick :
- `etag` retourné par l'API à chaque GET task
- Mémorisation des etags en state
- Si etag changé entre deux polls → tâche modifiée

## 4. Résolution de conflits

Règle : **last write wins par timestamp + vault canonique en cas d'égalité**.

Cas :
- Modif vault à 14:32, modif TickTick à 14:35 → TickTick gagne, patch vault
- Modif vault à 14:32, modif TickTick à 14:32 → vault gagne, push vers TickTick
- Modif vault à 14:35, modif TickTick à 14:32 → vault gagne, push vers TickTick
- **Suppression TickTick + tâche existe vault** → Telegram validation ("Tâche X supprimée dans TickTick. Supprimer aussi du vault ?" [Oui][Garder][Voir])
- **Suppression vault + tâche existe TickTick** → push DELETE TickTick (auto, pas de validation — vault canonique)

## 5. Mapping projets

Anya maintient un mapping local entre les **projets TickTick** et les tags vault :

```json
{
  "projects": {
    "ticktick_project_id_personnel": { "tags": ["#famille", "#maison", "#sante", "#perso", "#admin", "#finance"] },
    "ticktick_project_id_versi": { "tags": ["#versi"] },
    "ticktick_project_id_issa": { "tags": ["#issa"] },
    "ticktick_project_id_gradient": { "tags": ["#gradient-one"] },
    "ticktick_project_id_immobilier": { "tags": ["#immobilier-direct"] },
    "ticktick_project_id_sarani": { "tags": ["#sarani"] },
    "ticktick_project_id_inbox": { "tags": [] }
  }
}
```

Au premier setup, Anya crée 7 projets TickTick (Personnel, Versi, ISSA, Gradient One, Immobilier, Sarani, Inbox) après **confirmation Telegram** et stocke leurs IDs en state Drive.

## 6. Architecture des fichiers

```
src/lib/secretariat/ticktick/
├── api-client.ts              # OAuth + REST endpoints TickTick (mutualise getAccessToken patterns S13/S14)
├── project-manager.ts         # création initiale + mapping projets
├── task-sync-engine.ts        # diff + push/pull bidirectionnel
├── line-id-injector.ts        # injecte/extrait <!-- tt:... --> dans Todo.md (utilise vault-client)
├── ical-feed-generator.ts     # génère .ics depuis 06. Réunions/
├── ical-server.ts             # endpoint Replit pour servir le feed
├── conflict-resolver.ts       # logique last-write-wins
├── state-store.ts             # lecture/écriture state JSON dans Drive (via vault-client)
├── webhook-handler.ts         # Drive webhook handler
├── polling-worker.ts          # cron polling TickTick
├── telegram-confirm.ts        # validation Telegram (mutualise inbox-message-router S13)
└── __tests__/                 # ≥ 60 tests Vitest
```

## 7. Variables d'environnement

```
# TickTick OAuth
TICKTICK_CLIENT_ID=...
TICKTICK_CLIENT_SECRET=...
TICKTICK_REDIRECT_URI=https://anya.{user}.replit.app/oauth/ticktick/callback
TICKTICK_REFRESH_TOKEN=...      # stocké en state Drive après premier OAuth

# Sync config
TICKTICK_SYNC_ENABLED=true
TICKTICK_POLL_INTERVAL_MIN=3
TICKTICK_ICAL_FEED_TOKEN=...    # token random pour sécuriser le feed iCal
DRIVE_WEBHOOK_CHANNEL_ID=...    # créé via watch.files()

# Comportement
TICKTICK_DELETE_FROM_VAULT_NEEDS_CONFIRM=true
TICKTICK_DEFAULT_PROJECT=inbox  # si tag absent
```

## 8. Setup utilisateur (à documenter pour Thomas)

1. Créer compte TickTick (App Store iPhone)
2. Settings TickTick → Developer → Generate API credentials → obtenir Client ID + Secret
3. Lancer Anya OAuth flow : `https://anya.{user}.replit.app/oauth/ticktick/init` → autoriser → stocke refresh token dans state Drive
4. Au premier run, Anya crée les 7 projets TickTick — **confirmation Telegram** avant création
5. Sur iPhone, ouvrir TickTick → Settings → Calendar → Subscribe → coller l'URL `https://anya.{user}.replit.app/feed/reunions.ics?token=...`
6. Premier sync : Anya pousse les tâches actives de Todo.md vers TickTick, injecte les `<!-- tt:... -->` dans le vault. Visibles en ~10 secondes dans l'app iPhone.

## 9. Red lines (NON-NÉGOCIABLES)

1. **Vault est canonique** : en cas de doute ou d'égalité timestamp, le vault gagne.
2. **Pas de delete silencieux du vault** : suppression depuis TickTick → Telegram validation OBLIGATOIRE.
3. **Pas de delete silencieux des réunions** : les réunions ne sont jamais supprimées depuis TickTick (feed read-only depuis l'app).
4. **Audit JSONL dans Drive** : chaque sync logge dans `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl`. Op, direction, taskId, vault path, status, timestamp.
5. **Backoff sur rate limit** : si TickTick API renvoie 429, exponential backoff. Pas plus de 60 req/min.
6. **Tags `#hide-tcw` jamais synchronisés** : tâches taguées `#hide-tcw` restent locales vault.
7. **Idempotence** : push deux fois la même modif = même résultat. Pas de doublons TickTick.
8. **Préservation Todo.md** : tout patch préserve la structure des sections (Inbox, Cette semaine, etc.), l'ordre des lignes, le frontmatter, les HTML comments existants.
9. **UTF-8 réel** (règle 13 CLAUDE.md) : caractères accentués bit-parfaits.
10. **State recovery** : si state JSON corrompu/perdu, Anya recommence par fuzzy match (cf. section 1) sans doublons. Alerte Telegram si score < 90%.
11. **Logs `console.warn` minimum** (règle 22 CLAUDE.md) — pas de `console.log` filtré par Replit.
12. **Pas de scope OAuth `mail.google.com` ou `write` non nécessaires** côté TickTick. Minimal scopes only.

## 10. Tests obligatoires (≥ 60 tests Vitest, cohérent S14)

### Tests unitaires

- Parser ligne markdown avec/sans `<!-- tt:... -->` → TickTickTask object correct (≥ 15 fixtures)
- Sérializer TickTickTask → ligne markdown réversible
- Injecteur HTML comment : ligne sans → ligne avec, idempotent, préserve UTF-8
- Mapping projet inféré : `#versi` → projet Versi
- Hash ligne stable (mêmes input = même output)
- Conflict resolver : 8 cas (vault récent / TickTick récent / égalité / suppressions / sous-tâches [A?])
- Fuzzy match bootstrap : 10 fixtures avec score confidence

### Tests d'intégration

- Premier sync : 15 tâches Todo.md → 15 tâches TickTick visibles via API GET
- Cocher tâche dans TickTick app → vault `[x]` après poll
- Replanifier date dans TickTick → 📅 vault mis à jour
- Créer tâche dans TickTick → ligne dans Todo.md > Inbox avec `<!-- tt:... -->` injecté
- Modifier ligne Todo.md → TickTick patché après webhook/poll
- Supprimer ligne Todo.md → TickTick task DELETE
- Supprimer tâche TickTick → Telegram validation → si confirm, ligne supprimée vault
- Race condition : modif simultanée vault + TickTick → résolution timestamp cohérente
- Réseau coupé pendant 1h → reprise correcte (pas de doublons)
- State Drive corrompu → bootstrap fuzzy match → reconciliation propre

### Tests end-to-end manuels (Thomas, 48h prod)

- Thomas modifie quelques tâches dans TickTick app iPhone et dans Obsidian desktop. Tous les changements se réconcilient sans perte ni doublon.

## 11. Critères de réussite

- [ ] Jalon 0 spike : rapport API TickTick documenté + GO Thomas
- [ ] 7 projets TickTick créés au setup, mapping correct vers tags vault
- [ ] iCal feed accessible et reconnu par TickTick (5+ réunions visibles dans l'app)
- [ ] Push vault → TickTick fonctionnel sur 20 tâches diverses (dates, tags, priorités)
- [ ] Pull TickTick → vault fonctionnel : cocher dans app iPhone → vault `[x]` en moins de 5 min
- [ ] `<!-- tt:... -->` correctement injectés/préservés dans Todo.md (zéro corruption)
- [ ] Modifications bidirectionnelles testées sur 5 cas réels, zéro perte de donnée
- [ ] Audit JSONL contient chaque opération avec direction + status
- [ ] 7 jours en prod sans intervention manuelle, taux de réussite > 99% des syncs
- [ ] Telegram validation déclenchée correctement sur tentatives de delete vault

## 12. Coûts estimés

- TickTick Premium (optionnel) : ~28€/an
- API TickTick : gratuit (à confirmer Jalon 0 spike)
- Replit hosting iCal feed : déjà payé pour Anya
- LLM : ZÉRO (sync = logique déterministe pure, pas d'appel Haiku/Sonnet)
- **Total additionnel : 0€ si gratuit TickTick, ~28€/an si premium**

## 13. Implémentation par jalons (recalibré mindset IA)

### Jalon 0 — Spike API TickTick (~1h)

OBLIGATOIRE. Voir section 0. GO/NO-GO Thomas avant Jalon 1.

### Jalon 1 — OAuth TickTick + projets (~1.5h)

- `api-client.ts` avec OAuth flow complet (init, callback, refresh)
- `project-manager.ts` : crée 7 projets au premier run
- État sauvegardé en state Drive (via vault-client)
- Validation Telegram avant création projets

**Critère :** Thomas authentifie TickTick, 7 projets créés et visibles dans l'app.

### Jalon 2 — Push vault → TickTick (~3h, le plus gros)

- `line-id-injector.ts` : injection/extraction `<!-- tt:... -->`
- `task-sync-engine.ts` côté push uniquement
- Hash + diff sur `Todo.md`
- POST/PATCH/DELETE TickTick selon diff
- Tests unitaires + intégration sur 20 fixtures

**Critère :** 15 tâches Todo.md poussées vers TickTick, IDs injectés dans le vault, visibles dans l'app iPhone.

### Jalon 3 — iCal feed réunions (~1h)

- `ical-feed-generator.ts` génère .ics depuis `06. Réunions/`
- `ical-server.ts` expose endpoint Replit `/feed/reunions.ics?token=...`
- Token sécurisé (random 32 chars), refresh manuel possible

**Critère :** TickTick s'abonne au feed, 5 réunions visibles dans la vue calendrier app.

### Jalon 4 — Pull TickTick → vault (~2.5h)

- `polling-worker.ts` poll TickTick API toutes les 3 min
- Détection changements via etag
- Patch `Todo.md` aux bonnes positions (réutilise vault-client)
- `conflict-resolver.ts` last-write-wins
- Sous-tâches : implémenter selon [A?]

**Critère :** cocher dans TickTick → vault `[x]` en < 5 min. Modif date idem.

### Jalon 5 — Webhook Drive + delete confirmations (~1.5h)

- Watch Drive API pour `Todo.md` et `06. Réunions/`
- Trigger push immédiat (latence < 30 s au lieu de 5 min poll)
- `telegram-confirm.ts` pour les deletes pull (mutualise inbox-message-router)

**Critère :** modif Todo.md desktop → TickTick mis à jour en < 30 s. Test delete pull validé.

### Jalon 6 — Robustesse + monitoring + fuzzy bootstrap (~1.5h)

- Backoff rate limit + retry
- Logger structuré (réutilise audit-log.ts S14)
- Endpoint `/api/secretariat/ticktick-sync/status` avec dernières runs
- Alerte Telegram si > 3 erreurs consécutives
- Fuzzy match bootstrap si state perdu

**Critère :** 24h en prod sans intervention, dashboard monitoring opérationnel, state recovery testé manuellement.

### Jalon 7 — Récurrences (HORS SCOPE v2 si [B?] = zéro)

À reporter en jalon ultérieur si Thomas confirme zéro usage récurrence actuel.

**Total estimé : ~12h Claude Code** sur 2-3 sessions @fullstack (Jalons 0-1 / Jalons 2-3 / Jalons 4-6). Vélocité IA, pas "jours dev".

## 14. Référence

- Plan email-ingest (architecture commune) : `second-cerveau/Anya - Plan email-ingest.md`
- Vault-client S14 : `src/lib/secretariat/vault-client/` (frontmatter, markdown-append, drive-resolver, write-lock, audit-log)
- Router Telegram S13 : `src/lib/secretariat/inbox-message-router.ts` (à mutualiser)
- API TickTick : https://developer.ticktick.com (beta — Jalon 0 spike valide)
- Format iCal RFC 5545 : https://datatracker.ietf.org/doc/html/rfc5545
- Red lines globales : `01. Profil/red-lines.md` (vault Thomas)

---

Commence par **Jalon 0 (spike API TickTick, 1h)**. Pose-moi 3-5 questions de clarification avant le code production (notamment confirmation décisions A/B/C). Procède jalon par jalon, **un commit par jalon**, tests verts à chaque palier, handoff structuré vers @qa en fin.
```

---

## Annexe — Plan B Todoist (si Jalon 0 spike NO-GO)

Si l'API TickTick montre des breaking changes ou bugs critiques au Jalon 0 :

| Aspect | TickTick | Todoist |
|---|---|---|
| API stabilité | Beta (`developer.ticktick.com`) | Production stable (REST v2) |
| Coût premium | 28€/an | 36€/an (Pro) |
| Native iOS | Excellent | Excellent |
| Multi-plateforme | Oui | Oui |
| Tags + projets | Oui | Oui |
| Sous-tâches | Oui (à valider Jalon 0) | Oui (depuis v2) |
| Calendrier intégré | Oui (vue native) | Via Google Calendar sync |
| iCal subscribe | Oui | Oui |
| Filtrage robuste | Oui | Excellent (Quick Add syntax) |

**Migration TickTick → Todoist** : le code Jalons 1-6 est architecturé pour être agnostic source (interface `TaskProvider` dans `api-client.ts`). Plan B = remplacer impl TickTick par impl Todoist, le reste reste intact. ~2h adaptation.

## Annexe — Notes finales

Le prompt v1 mentionnait dans ses "Notes pour Thomas" une ligne `- [x] test 📅 2026-05-12 ✅ 2026-05-12` collée AVANT le frontmatter `---` de `Todo.md`. **Action côté Thomas dans son vault perso (hors périmètre repo)** : supprimer cette ligne avant Jalon 2 pour ne pas casser le parsing YAML.

---

## Handoff -> @moi (Thomas — décisions à arbitrer)

- **Fichier produit** : `docs/ia/anya-ticktick-prompt-v2.md` (cette spec amendée)
- **Source v1** : `second-cerveau/Anya - Prompt Claude Code TickTick sync.md` (intact)
- **Décisions à arbitrer Thomas** : A (sous-tâches), B (récurrences), C (plan B TickTick KO)
- **Points d'attention** :
  - Le prompt n'est **pas prêt à copier-coller** tant que A/B/C non décidés (placeholders `[A?]`, `[B?]`, `[C?]`)
  - Pré-requis Jalon 0 spike obligatoire avant tout code production (de-risquer API beta)
  - Estimation totale recalibrée ~12h Claude Code (vs "7 jours dev" v1) — règle 5 mindset IA
  - Mutualisation vault-client S14 explicite (state + audit dans Drive)
- **Prochaine étape** : revue conjointe Thomas + Claude pour arbitrer A/B/C, puis lancement @fullstack

## Historique des interventions agents

| Session | Agent | Livrable | Justification |
|---|---|---|---|
| S14 | claude (rôle orchestrator) | Prompt TickTick v2 amendé | Revue 7 points + 3 décisions à arbitrer, alignement règles CLAUDE.md (mindset IA, vault-client S14, anti-timeout, audit Drive) |
