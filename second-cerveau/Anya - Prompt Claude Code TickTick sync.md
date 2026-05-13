---
type: outil
nom: Anya - Prompt Claude Code (sync bidirectionnel TickTick)
date_mise_a_jour: 2026-05-12
statut: à implémenter
tags:
  - outils
  - ia
  - bot
  - automatisation
  - ticktick
  - sync
  - prompt
---

# Anya - Prompt Claude Code : sync bidirectionnel vault ↔ TickTick

> Ce fichier est destiné à être copié-collé tel quel comme prompt dans Claude Code pour implémenter la sync bidirectionnelle entre le vault Obsidian (Todo.md + 06. Réunions/) et TickTick (app iPhone). À considérer comme une **Phase 4** d'Anya après email-ingest, calendar-ingest et task-ingest.

---

## Prompt à coller dans Claude Code

```
Tu vas implémenter la sync bidirectionnelle entre le vault Obsidian de Thomas et TickTick, dans Anya (service Replit existant). Cette phase complète l'architecture déjà planifiée pour Anya (cf. plans dans `08. Outils/Anya - Plan email-ingest.md` et `08. Outils/Anya - Prompt Claude Code calendar+task ingest.md`).

## Contexte

Thomas utilise Obsidian sur desktop pour la puissance (Agenda DataviewJS, recherche, liens), mais sur iPhone il veut UNE seule app native pour consulter et toucher rapidement à ses tâches et événements. TickTick a été retenu : multi-plateforme (future-proof), filtrage robuste, vue unifiée tâches + calendrier, API ouverte.

Source de vérité : **le vault Obsidian** (`Todo.md` + `06. Réunions/`). TickTick est un MIROIR + interface mobile. Les modifications faites côté TickTick (cocher, replanifier, éditer une description, créer une tâche rapide) doivent remonter dans le vault. Les modifications côté vault (Anya ou Thomas) descendent vers TickTick.

## Mission

Construire un sync engine bidirectionnel :

- Vault → TickTick : à chaque modification de `Todo.md` ou d'un fichier `06. Réunions/`, propager dans TickTick (create / update / complete / delete)
- TickTick → Vault : à chaque polling de l'API TickTick, détecter les modifs et propager dans le vault
- Résolution de conflits : last-write-wins par timestamp, vault gagne en cas d'égalité (source canonique)

## 1. Modèle de données

### Mapping tâche Obsidian → TickTick

Une ligne `- [ ] description 📅 YYYY-MM-DD #tag` dans `Todo.md` correspond à un objet TickTick :

```typescript
interface TickTickTask {
  id: string                  // généré par TickTick à la création
  title: string               // description nettoyée (sans 📅 ni #tags)
  content: string             // optionnel, mis vide
  dueDate: string             // ISO 8601, depuis 📅
  isAllDay: true              // toujours, sauf si 🕐 présent
  priority: 0 | 1 | 3 | 5     // mapping depuis 🔼🔽 (0 par défaut)
  status: 0 | 2               // 0 = todo, 2 = done (synced from `[ ]` / `[x]`)
  tags: string[]              // depuis #famille, #issa, etc. (sans le #)
  projectId: string           // mapping par projet inféré (cf. plus bas)
  reminder: string?           // optionnel, depuis ⏰
  repeatFlag: string?         // depuis 🔁 (RRULE iCal-like si présent)
}
```

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

### Index de mapping (state local Anya)

Anya maintient un fichier d'état `secretariat/state/ticktick-sync.json` qui mappe :

```json
{
  "tasks": {
    "/Users/.../Todo.md:L42": {
      "ticktick_id": "abc123",
      "ticktick_etag": "xyz",
      "vault_hash": "sha1 de la ligne",
      "last_synced_at": "2026-05-12T14:32:00Z"
    },
    ...
  },
  "lastPollTickTick": "2026-05-12T14:30:00Z"
}
```

Ce state permet :
- Détecter quelles tâches sont nouvelles dans le vault depuis la dernière sync
- Détecter quelles tâches TickTick ont changé (compare etag)
- Réconcilier conflicts par timestamp

## 2. Flux de données

### Vault → TickTick (push)

Trigger :
- Webhook Drive API sur modification de `Todo.md` ou `06. Réunions/**.md` (Google Drive supporte ça via watch)
- Fallback : polling toutes les 5 min si webhook indisponible

Logique :
1. Diff le contenu actuel de `Todo.md` vs dernière version connue (depuis state)
2. Pour chaque ligne ajoutée → POST `/open/v1/task` TickTick → stocker ID retourné dans state
3. Pour chaque ligne modifiée → PATCH `/open/v1/task/{id}` (description, date, tags, status)
4. Pour chaque ligne supprimée → DELETE `/open/v1/task/{id}`
5. Pour les réunions : regénérer le feed iCal complet, TickTick refresh automatiquement

### TickTick → Vault (pull)

Trigger : polling TickTick API toutes les 2-5 min.

Logique :
1. GET `/open/v1/task?status=changed_since={lastPollTickTick}` (ou équivalent endpoint disponible)
2. Pour chaque tâche changée :
   - Match par `ticktick_id` dans le state
   - Si tâche existe dans le vault à la position mappée :
     - Compare timestamps : si TickTick plus récent → patch ligne vault (description, date, status)
     - Si même timestamp → vault gagne, push correctif vers TickTick (no-op)
   - Si tâche TickTick n'a pas de mapping vault → tâche créée depuis TickTick → ajouter dans `Todo.md > ## Inbox` avec format standard
3. Pour les tâches DELETE TickTick : si Thomas supprime depuis TickTick → confirmer Telegram avant de supprimer du vault (red line : pas de delete silencieux)

## 3. Détection de changements

Côté vault : 
- Hash SHA-1 de chaque ligne tâche stocké en state
- Comparaison hash à chaque sync : si différent → modif détectée
- Détection des renommages/suppressions par position de ligne + heuristique de match texte

Côté TickTick :
- `etag` retourné par l'API à chaque GET task
- Mémorisation des etags en state
- Si etag changé entre deux polls → tâche modifiée
- TickTick API doc : https://developer.ticktick.com

## 4. Résolution de conflits

Règle : **last write wins par timestamp + vault est canonique en cas d'égalité**.

Cas :
- Modif vault à 14:32, modif TickTick à 14:35 → TickTick gagne, patch vault
- Modif vault à 14:32, modif TickTick à 14:32 → vault gagne, push vers TickTick (overwrite)
- Modif vault à 14:35, modif TickTick à 14:32 → vault gagne, push vers TickTick
- Tâche supprimée TickTick mais existe vault → Telegram validation ("Tâche X supprimée dans TickTick. Supprimer aussi du vault ?" [Oui][Garder][Voir])
- Tâche supprimée vault mais existe TickTick → push DELETE TickTick (auto, pas de validation)

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

Au premier setup, Anya crée 7 projets TickTick (Personnel, Versi, ISSA, Gradient One, Immobilier, Sarani, Inbox) et stocke leurs IDs en state. Les tags vault dictent dans quel projet TickTick la tâche atterrit.

## 6. Architecture des fichiers

```
src/lib/secretariat/sync/ticktick/
├── api-client.ts              # OAuth + REST endpoints TickTick
├── project-manager.ts         # création initiale + mapping projets
├── task-sync-engine.ts        # diff + push/pull bidirectionnel
├── ical-feed-generator.ts     # génère .ics depuis 06. Réunions/
├── ical-server.ts             # endpoint Replit pour servir le feed
├── conflict-resolver.ts       # logique last-write-wins
├── state-store.ts             # lecture/écriture state JSON
├── webhook-handler.ts         # Drive webhook handler
├── polling-worker.ts          # cron polling TickTick
├── telegram-confirm.ts        # validation Telegram pour suppressions
└── tests/
```

## 7. Variables d'environnement

```
# TickTick OAuth
TICKTICK_CLIENT_ID=...
TICKTICK_CLIENT_SECRET=...
TICKTICK_REDIRECT_URI=https://anya.{user}.replit.app/oauth/ticktick/callback
TICKTICK_REFRESH_TOKEN=...      # stocké après premier OAuth

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
3. Lancer Anya OAuth flow : `https://anya.{user}.replit.app/oauth/ticktick/init` → autoriser → stocke refresh token
4. Au premier run, Anya crée les 7 projets TickTick (Personnel, Versi, ISSA, Gradient One, Immobilier, Sarani, Inbox) — confirmation Telegram avant création
5. Sur iPhone, ouvrir TickTick → Settings → Calendar → Subscribe → coller l'URL `https://anya.{user}.replit.app/feed/reunions.ics?token=...`
6. Premier sync : Anya pousse les ~15 tâches actives de Todo.md vers TickTick. Visibles en ~10 secondes dans l'app iPhone.

## 9. Red lines (NON-NÉGOCIABLES)

1. **Vault est canonique** : en cas de doute, le vault gagne. Pas de modif vault silencieuse depuis TickTick si conflit non-trivial.
2. **Pas de delete silencieux du vault** : suppression depuis TickTick → Telegram validation OBLIGATOIRE.
3. **Pas de delete silencieux des réunions** : les réunions ne sont jamais supprimées depuis TickTick (feed read-only depuis l'app).
4. **Audit JSONL** : chaque sync logge dans `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl`. Op, direction, taskId, vault path, status, timestamp.
5. **Backoff sur rate limit** : si TickTick API renvoie 429, attendre puis retry. Pas plus de 60 req/min.
6. **Tags `#hide-tcw` jamais synchronisés** : les tâches taguées `#hide-tcw` dans le vault restent locales. Anya skip lors du push TickTick.
7. **Idempotence** : push deux fois la même modif = même résultat. Pas de doublons TickTick.
8. **Préservation frontmatter** : tout patch sur `Todo.md` préserve la structure des sections (Inbox, Cette semaine, etc.) et l'ordre des lignes au sein d'une section.
9. **UTF-8 réel** : caractères accentués préservés bit-parfait.
10. **State recovery** : si state JSON corrompu ou perdu, Anya recommence le mapping depuis zéro (full re-sync) sans dupliquer (matching par contenu en fallback).

## 10. Tests obligatoires (avant prod)

### Tests unitaires (Vitest)

- Parser `- [ ] description 📅 YYYY-MM-DD #tag` → TickTickTask object correct
- Sérializer TickTickTask → ligne markdown correct (réversible)
- Mapping projet inféré : `#versi` → projet Versi
- Hash ligne stable (mêmes input = même output)
- Conflict resolver : 8 cas (vault récent / TickTick récent / égalité / suppressions)

### Tests d'intégration

- Premier sync : 15 tâches Todo.md → 15 tâches TickTick visibles via API GET
- Cocher tâche dans TickTick app → vault `[x]` après poll
- Replanifier date dans TickTick → 📅 vault mis à jour
- Créer tâche dans TickTick → ligne dans Todo.md > Inbox
- Modifier ligne Todo.md → TickTick patché après webhook/poll
- Supprimer ligne Todo.md → TickTick task DELETE
- Supprimer tâche TickTick → Telegram validation → si confirm, ligne supprimée vault
- Race condition : modif simultanée vault + TickTick → résolution timestamp cohérente
- Réseau coupé pendant 1h → reprise correcte (pas de doublons)

### Tests end-to-end manuels (Thomas)

- Sur 48h en condition réelle : Thomas modifie quelques tâches dans TickTick app iPhone et dans Obsidian desktop. Tous les changements se réconcilient sans perte ni doublon.

## 11. Critères de réussite

- [ ] 7 projets TickTick créés au setup, mapping correct vers tags vault
- [ ] iCal feed accessible et reconnu par TickTick (5+ réunions visibles dans l'app)
- [ ] Push vault → TickTick fonctionnel sur 20 tâches diverses (avec dates, tags, priorités, récurrences)
- [ ] Pull TickTick → vault fonctionnel : cocher dans app iPhone → vault `[x]` en moins de 5 min
- [ ] Modifications bidirectionnelles testées sur 5 cas réels, zéro perte de donnée
- [ ] Audit JSONL contient chaque opération avec direction + status
- [ ] 7 jours en prod sans intervention manuelle, taux de réussite > 99% des syncs
- [ ] Telegram validation déclenchée correctement sur tentatives de delete vault

## 12. Coûts estimés

- TickTick Premium (optionnel) : ~28€/an
- API TickTick : gratuit
- Replit hosting iCal feed : déjà payé pour Anya
- LLM : ZÉRO (sync n'utilise pas Haiku/Sonnet, juste de la logique déterministe)
- Total additionnel : 0€ si gratuit TickTick, ~28€/an si premium

## 13. Implémentation par jalons

### Jalon 1 — OAuth TickTick + projets (1 jour)

- `api-client.ts` avec OAuth flow complet (init, callback, refresh)
- `project-manager.ts` : crée 7 projets au premier run
- État sauvegardé en state JSON
- Validation Telegram avant création projets

**Critère :** Thomas authentifie TickTick, 7 projets créés et visibles dans l'app.

### Jalon 2 — Push vault → TickTick (2 jours, le plus gros)

- `task-sync-engine.ts` côté push uniquement
- Hash + diff sur `Todo.md` 
- POST/PATCH/DELETE TickTick selon diff
- Tests unitaires + intégration sur 20 fixtures

**Critère :** 15 tâches Todo.md poussées vers TickTick, visibles dans l'app iPhone.

### Jalon 3 — iCal feed réunions (0,5 jour)

- `ical-feed-generator.ts` génère .ics depuis `06. Réunions/`
- `ical-server.ts` expose endpoint Replit `/feed/reunions.ics?token=...`
- Token sécurisé (random 32 chars), refresh manuel possible

**Critère :** TickTick s'abonne au feed, 5 réunions visibles dans la vue calendrier app.

### Jalon 4 — Pull TickTick → vault (2 jours)

- `polling-worker.ts` poll TickTick API toutes les 3 min
- Détection changements via etag
- Patch `Todo.md` aux bonnes positions (réutilise vault-client de email-ingest)
- `conflict-resolver.ts` last-write-wins

**Critère :** cocher dans TickTick → vault `[x]` en < 5 min. Modif date idem.

### Jalon 5 — Webhook Drive + delete confirmations (1 jour)

- Watch Drive API pour `Todo.md` et `06. Réunions/`
- Trigger push immédiat (latence < 30 s au lieu de 5 min poll)
- `telegram-confirm.ts` pour les deletes pull

**Critère :** modif Todo.md desktop → TickTick mis à jour en < 30 s. Test delete pull validé.

### Jalon 6 — Robustesse + monitoring (0,5 jour)

- Backoff rate limit + retry
- Logger structuré
- Endpoint `/api/secretariat/ticktick-sync/status` avec dernières runs
- Alerte Telegram si > 3 erreurs consécutives

**Critère :** 24h en prod sans intervention, dashboard monitoring opérationnel.

**Total estimé : 7 jours dev** pour un dev qui connaît Anya.

## 14. Référence

- Plan email-ingest (architecture commune) : `08. Outils/Anya - Plan email-ingest.md`
- Prompt calendar-ingest + task-ingest : `08. Outils/Anya - Prompt Claude Code calendar+task ingest.md`
- API TickTick : https://developer.ticktick.com
- Format iCal RFC 5545 : https://datatracker.ietf.org/doc/html/rfc5545
- Templates touchés : `Templates/Tâche.md` (format ligne canonique vault)
- Red lines : `01. Profil/red-lines.md`

---

Commence par lire les 2 plans précédents (email-ingest et calendar+task ingest) puis pose-moi 3-5 questions sur les zones de doute (par exemple : politique exacte de delete bidirectionnel, gestion des sous-tâches TickTick, mapping priorité). Ensuite procède par jalons, un commit par jalon, tests verts à chaque palier.
```

---

## Notes pour Thomas

Une fois ce prompt collé dans Claude Code :

1. Il va relire les 2 plans Anya précédents puis te poser quelques questions de clarification (notamment sur la politique des deletes bidirectionnels et le mapping des priorités/récurrences entre TickTick et vault).
2. Tu auras un sync engine bidirectionnel en ~7 jours dev.
3. Setup utilisateur : ~10 minutes (OAuth + abonnement iCal).
4. Résultat : tu ouvres TickTick sur iPhone, tu vois tout (tâches + réunions) en vue unifiée. Tu coches, tu replanifies, tu crées — tout remonte au vault.

Avant de coder : tester TickTick gratuit pendant 2 semaines pour confirmer que l'UX te convient (et que tu ne préfères pas tester Todoist en parallèle).

## Pour la ligne de test au top de Todo.md

J'ai vu deux fois maintenant `- [x] test 📅 2026-05-12 ✅ 2026-05-12` collée AVANT le frontmatter `---` de `Todo.md`. Ça casse le parsing YAML donc Dataview et Tasks plugin peuvent avoir des comportements inattendus sur ce fichier. Je peux la supprimer sans risque si tu le souhaites.
