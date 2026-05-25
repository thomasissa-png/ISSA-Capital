# Cadrage — Refonte calendar-ingest (S23)

> Statut : **PROPOSITION à valider par Thomas**. Une seule architecture proposée (pas d'options A/B/C). Les rares décisions ouvertes sont isolées en fin de doc (§7).
> Source diagnostic : journal VPS S23 (21/21 erreurs toutes les 15 min) + lecture code `src/lib/secretariat/calendar-ingest/`.

---

## 1. Décision Thomas (verbatim brief S23)

> `06. Réunions` **ABANDONNÉ**. Les réunions ne créent **plus de fiches réunion** → elles **mettent à jour les historiques projets/contacts + créent des todos**. NE PAS auto-créer le dossier.

---

## 2. Cause racine de l'hémorragie actuelle (à corriger)

Chaîne de l'échec, par event :

1. `runner.processOneEvent` → `mapEventToReunion` → `writeReunion(entry)`
2. `writeReunion` tente `createVaultFile('06. Réunions/2026/05', …)` (reunion-writer.ts:212)
3. Le dossier `06. Réunions` **n'existe pas** dans le vault + `createVaultFile` **ne crée pas les dossiers parents** → `false`
4. `writeReunion` retourne `{ success:false, op:'error', error:'createVaultFile échoué' }`
5. `processOneEvent` retourne `op:'error'` **sans logger `result.errors`** (runner.ts:268-278) → erreur avalée
6. **`state.processedEvents[event.id]` n'est JAMAIS mis à jour** (runner.ts:293, atteint seulement après write réussi)

➡️ Conséquence : les 21 events ne sont jamais marqués traités → **re-tentés intégralement à chaque run** (toutes les 15 min, ~133 s, 21 erreurs), **sans jamais converger**. C'est le double défaut à corriger : (a) plus de fiche réunion, (b) marquer l'event traité même sans fiche + logger les erreurs.

---

## 3. Architecture cible

Pour chaque event Google Calendar (confirmé, fenêtre ±14j), **au lieu d'écrire une fiche réunion** :

### A. Historiques CONTACTS (réutilise l'existant — déjà fonctionnel)
- `contact-enricher.enrichContactsFromEvent` fait déjà : pour chaque participant non-self/non-système → `findContactByEmail` → `appendToHistorique` (section `## Historique`, `date_dernière_interaction` MAJ).
- Pas de fiche contact créée si absente (red line S18.5 conservée) — log `no-contact`.
- **À garder tel quel.**

### B. Historiques PROJETS (NOUVEAU)
- Détecter le projet concerné par **match du titre/description de l'event** contre les noms canoniques + alias (`ISSA Capital`, `Gradient One`, `Versi Immobilier`, `Versi Invest`, `Versimo`, `Immocrew`).
- **1 match** → `findProjetFicheByEntite(code)` (vault-reader, déjà R7-compliant, cache 1h) → `appendToHistorique` sur la fiche `02. Projets/02. Pro/<Projet>.md`.
- **2+ matchs (ambigu)** → carte Telegram de désambiguïsation (préfixe callback `calproj:`, TTL 7j). Cf §7.
- **0 match** → pas d'historique projet (seulement contacts). Jamais de création de fiche projet.
- Extension mapping projet : `ENTITE_TO_FICHE_NAME` (vault-reader.ts:56) — ajouter Versimo/Immocrew si fiches existent.

### C. TODOS (NOUVEAU) → **TickTick (hub unique, S20)**
- Création via l'API TickTick (PAS d'écriture dans `03. Tâches/Todo.md` qui est un **miroir read-only régénéré**).
- Todo proposé par défaut : **« CR à faire — <sujet> (<date>) »**, échéance = jour de la réunion, projet TickTick = le projet détecté en §B sinon Inbox.
- **Auto-création silencieuse** (PAS de carte Telegram par event → 21 events = 21 cartes = spam). Thomas supprime dans TickTick si non voulu.
- Idempotence todo : voir §4 (stocker l'id du todo créé dans le state).

### D. Logging #2 (folder dans cette refonte)
- `runner.ts` : logger explicitement `result.errors` par event (`console.warn('[calendar-ingest] event <id> "<summary>" : <errors>')`) au lieu d'incrémenter `errors` en silence.
- Le récap Telegram de fin de run (`sendCalendarRecapCard`) liste le compte contacts/projets/todos + erreurs détaillées.

---

## 4. Idempotence (CRITIQUE — sinon pollution massive)

Le cron repasse sur la fenêtre ±14j **toutes les 15 min**. Sans garde, chaque historique recevrait une ligne dupliquée toutes les 15 min.

- **Garde event-level conservée** : skip si `state.processedEvents[event.id].lastSeenUpdated === event.updated` (runner.ts:226). Le travail (A/B/C) ne s'exécute qu'au **premier passage** ou si `event.updated` change.
- **Fix racine** : `state.processedEvents[event.id]` doit être mis à jour **dès que le traitement réussit** (même sans fiche). Nouveau payload :
  ```
  { lastSeenUpdated, processedAt, contactsEnriched: string[], projectsEnriched: string[], todoId?: string }
  ```
- Si `event.updated` change (heure déplacée) → re-traitement : **ne pas dupliquer le todo** (réutiliser `todoId` stocké → update plutôt que create) ni les lignes d'historique (l'`appendToHistorique` est append-only ; sur un changement d'event on ajoute UNE nouvelle ligne « réunion replanifiée » — acceptable et traçable).

---

## 5. Modules : garder / refondre / supprimer

| Module | Sort |
|---|---|
| `calendar-source.ts` | **Garder** (fetch Google Calendar) |
| `event-mapper.ts` | **Refondre** : garder extraction date/heure/durée/participants + détection système ; **retirer** `serializeReunionMarkdown` + `mapEventToReunion`→fiche. Ajouter `detectProjectFromEvent(event)`. |
| `contact-enricher.ts` | **Garder** (cœur réutilisable historiques contacts) |
| `reunion-writer.ts` | **Supprimer** (plus de fiche réunion) |
| `runner.ts` | **Refondre** : remplacer `writeReunion` par enrich contacts + enrich projet + create todo ; fix state ; logging #2 |
| `state-store.ts` / `types.ts` | **Adapter** : nouveau payload `processedEvents` (§4) |
| `telegram-recap.ts` | **Adapter** : récap = contacts/projets/todos + erreurs détaillées |
| `audit-log.ts` | **Garder/adapter** ops (`contact-enriched`, `projet-enriched`, `todo-created`) |
| `ical-feed-reunions.ts` + `api/.../ical-reunions/` (S18.3a) | **Devient code mort** : le feed iCal lisait les fiches `06. Réunions/*.md`. Plus de fiches → feed vide. **À supprimer dans cette refonte** (TickTick peut s'abonner directement à Google Calendar). |

---

## 6. Plan d'exécution (post-validation Thomas)

1. **fullstack** : refonte `event-mapper` (detectProject) + `contact-enricher` (inchangé, vérifier) + nouveau `projet-enricher` + `todo-creator` (TickTick API) + refonte `runner` (orchestration + state + logging #2) + adapter types/state/recap + suppression `reunion-writer` + suppression iCal feed réunions + tests.
2. **orchestrator** : revue, run subset tests, walkthrough 3-5 scénarios (R9), validation visuelle Obsidian sur 1 event réel (R6) avant batch.
3. **PR → merge `main`** → auto-deploy VPS <5 min → vérifier journal (`journal_anya`) : `errors=0`, contacts/projets/todos > 0, convergence (events marqués traités → runs suivants `skipped`).

NB : la fenêtre ±14j fait que les 21 events existants seront traités **une fois** au premier run post-deploy puis `skipped` — convergence immédiate attendue.

---

## 7. Décisions VERROUILLÉES (Thomas, S23)

- **TODO** (reco orchestrator validée) : **un seul todo « CR à faire — <sujet> (<date>) »** par réunion éligible, échéance = jour J, projet TickTick = projet détecté §B sinon Inbox, **création silencieuse** (pas de carte Telegram). **Exclusions** : events récurrents, all-day, et perso (sans participant externe). Pas de prép pré-réunion en V1 (porte ouverte V2).
- **DÉTECTION PROJET** : **match auto sur le titre/description**, avec règle « demande si besoin » :
  - **1 projet matché** → historique projet appliqué silencieusement.
  - **2+ projets matchés (ambigu)** → **carte Telegram de désambiguïsation** (boutons = projets candidats + « Aucun », TTL 7j R3, nouveau préfixe callback `calproj:` → handler + dispatch webhook + test E2E, R4).
  - **0 match** → pas d'historique projet (silencieux). Le flow CR write-back rattachera la réunion au projet quand Thomas dictera le compte-rendu.
  - Le seuil exact de « besoin » (ambiguïté = 2+ matchs) est ajustable si Thomas constate des trous.
