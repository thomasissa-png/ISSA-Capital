---
skill: ticktick-sync
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~50-100 tâches synchronisées/mois
modules_code:
  - src/lib/secretariat/ticktick/push.ts [À CONFIRMER chemin]
  - src/lib/secretariat/ticktick/pull.ts [À CONFIRMER chemin]
  - src/lib/secretariat/ticktick/ical-feed.ts [À CONFIRMER chemin]
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/vault-client/
modeles_llm: []
trigger_principal: cron push 5min + cron pull 5min décalé 30s + endpoint HTTP iCal feed
output_principal: vault Todo.md ↔ TickTick + feed iCal réunions abonnable
---

# Workflow TickTick Sync — sync bidirectionnel vault ↔ TickTick + iCal réunions

> Source : `src/lib/secretariat/ticktick/` (push.ts + pull.ts + ical-feed.ts). Pipeline parent : cron Replit (push + pull) + endpoint HTTP autonome (iCal feed). Architecture : voir `docs/ia/anya-current-architecture.md`. Plan futur sync bidirectionnel : `docs/ia/anya-ticktick-prompt-v2.md`.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — 3 sous-pipelines indépendants
1. **Push** vault → TickTick : cron 5min.
2. **Pull** TickTick → vault : cron 5min **décalé 30s** par rapport au push (verrou anti-concurrence TTL 30s).
3. **iCal feed** réunions : endpoint HTTP, déclenché par requête abonnement calendrier.

### Variantes ciblées
- **Push** : seulement les tâches markdown `- [ ]` non cochées dans le vault, avec tag de projet reconnu (PROJECT_TAG_MAPPING). Tag `#hide-tcw` filtré (exclu du push).
- **Pull** : last-write-wins canonique vault. Tâches créées hors vault → ajoutées sous `## Inbox` de `Todo.md`. Deletes TickTick → silencieux côté vault (S19 décision Thomas).
- **iCal** : scan fenêtre `[year-1 ; year+1]` × 12 mois de `06. Réunions/YYYY/MM/*.md`.

### Hors trigger
- Pas de webhook TickTick push réel (polling 5min suffisant) [À CONFIRMER].
- Pas de sync en temps réel (latence acceptable 5-10min selon décalage cron).

---

## 2. Input

### Fiches à consulter en début de workflow
- **`Todo.md`** vault [À CONFIRMER chemin exact — vraisemblablement à la racine ou dans `00. Me/`] — source de vérité pour push.
- **`06. Réunions/YYYY/MM/*.md`** — frontmatter scanné par iCal feed.
- **State JSON Drive** — `_Inbox/AnyaState/ticktick-state.json` [À CONFIRMER nom exact] — checkpoint last sync + SHA-1 hashes des tâches push.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Todo.md | Tâches markdown `- [ ]` avec tags | vault-reader |
| TickTick API | Tâches projets mappés | OAuth direct TickTick |
| CR vault | Frontmatter (date, heure, duree, participants, lieu) | vault-reader filtre dossier |
| State Drive | SHA-1 hashes + last sync timestamps | `_Inbox/AnyaState/` |

### Convention de nommage
- **State JSON** : `_Inbox/AnyaState/ticktick-state.json` [À CONFIRMER].
- **Section pull inbox** : `## Inbox` dans `Todo.md` (tâches créées TickTick hors vault).
- **Tag filtré push** : `#hide-tcw` → exclu du push (Thomas peut masquer une tâche du sync).

### Outils API requis
- **TickTick API** — OAuth direct (cf `anya-current-architecture.md` module `ticktick/`).
- **vault-reader / vault-client** — Drive PATCH in-place R5 sur Todo.md + state JSON.
- **Telegram Bot API** — carte de confirmation TTL 7j R3 (premier push d'un projet).
- **env vars** : `TICKTICK_ICAL_SECRET` (auth iCal feed), `OBSIDIAN_VAULT_NAME` (deep-link Obsidian).

---

## 3. Étapes

### 3.A — Push vault → TickTick (S18.1)

#### 3.A.1 Verrou anti-concurrence
- Acquisition verrou Drive TTL 30s `_Inbox/AnyaState/ticktick-lock.json` [À CONFIRMER chemin exact].
- Si verrou déjà pris (pull en cours) → skip ce cron, retry au prochain cycle 5min.

#### 3.A.2 Parsing Todo.md
- `readFileById(todoFileId)` → contenu live.
- Parser markdown : extraire toutes les lignes `- [ ]` (non cochées) et `- [x]` (cochées, pour completion répercutée).
- Pour chaque ligne : extraire texte + tags (`#projet1`, `#projet2`, etc.).
- Filtrer tags `#hide-tcw` → exclus du push (Thomas peut masquer).

#### 3.A.3 PROJECT_TAG_MAPPING (7 projets)
[À CONFIRMER mapping exact des 7 projets vault → 7 tags TickTick] :
```
#immo → TickTick projet "Immobilier"
#issa-capital → TickTick projet "ISSA Capital"
#perso → TickTick projet "Perso"
#admin → TickTick projet "Administratif"
#famille → TickTick projet "Famille"
[autres à confirmer]
```

#### 3.A.4 SHA-1 hash idempotence
- Pour chaque VaultTask : `hash = sha1(vaultPath + ligne + tags)`.
- Comparaison avec state JSON Drive : si hash déjà push → skip.
- Si hash inconnu → push vers TickTick API + update state JSON.

#### 3.A.5 Backoff 429 rate-limit
- TickTick API rate-limit ≈ X req/min [À CONFIRMER chiffre].
- Sur 429 : backoff exponentiel (1s → 2s → 4s → 8s, max 5 retries).
- Si toujours 429 après 5 retries → push partiel, reprise au prochain cron.

#### 3.A.6 Carte Telegram confirmation
- **Premier push d'un projet** (premier match d'un tag jamais vu) → carte Telegram à Thomas TTL 7j R3 (red line §8 step 4 [À CONFIRMER doc archi]).
- Pour pushes ultérieurs du même projet → silencieux (pas de spam).

#### 3.A.7 PATCH state JSON
- `vault-client.updateFileContent()` PATCH in-place R5 sur state JSON.
- Atomique (jamais corruption).

#### 3.A.8 Libération verrou
- Suppression verrou Drive 30s.

### 3.B — Pull TickTick → vault (S18.2)

#### 3.B.1 Acquisition verrou
- Décalage 30s vs push → en pratique, push terminé avant pull.
- Verrou Drive TTL 30s (idem 3.A.1).

#### 3.B.2 Fetch TickTick API
- Récupérer toutes les tâches des 7 projets mappés.
- Comparaison avec state JSON Drive : nouvelles tâches, completions, deletes.

#### 3.B.3 Last-write-wins canonique vault (§4 archi)
- **Le vault est la source de vérité** (R1 vault-as-SOT).
- Si tâche existe vault + TickTick → vault prime.
- Si tâche existe TickTick seule → création dans vault.
- Si tâche existe vault seule → push vers TickTick (gérée par sous-pipeline 3.A).

#### 3.B.4 Création tâches sous `## Inbox` Todo.md
- Tâches créées sur TickTick (hors vault) → ajoutées sous section `## Inbox` de `Todo.md`.
- PATCH in-place R5.

#### 3.B.5 Completion répercutée
- Tâche cochée TickTick → ligne vault transformée `- [ ]` → `- [x]`.
- Tâche cochée vault → push completion vers TickTick (sous-pipeline 3.A).

#### 3.B.6 Deletes silencieux (S19)
- Tâche supprimée TickTick → ligne vault supprimée **silencieusement** (pas de carte Telegram).
- **Décision Thomas verbatim S19** : "Si je supprime des tâches dans TickTick, Anya pas besoin de me le dire" [À CONFIRMER verbatim exact].
- Audit logué dans JSONL (pour Thomas peut retrouver historique si besoin), mais pas de notif Telegram.

#### 3.B.7 PATCH Todo.md + state JSON
- `updateFileContent()` PATCH in-place R5 sur Todo.md.
- Mise à jour state JSON Drive.

### 3.C — iCal feed réunions (S18.3a)

#### 3.C.1 Endpoint HTTP autonome
- Route Next.js : `/api/ticktick/ical?token=TICKTICK_ICAL_SECRET` [À CONFIRMER chemin exact].
- Auth via env var `TICKTICK_ICAL_SECRET` (token statique partagé).
- Réponse : `text/calendar` RFC 5545.

#### 3.C.2 Scan vault `06. Réunions/`
- Fenêtre temporelle : `[year-1 ; year+1]` × 12 mois = 24 mois glissants.
- Pour chaque sous-dossier `06. Réunions/YYYY/MM/` : lister `*.md`.
- Lire frontmatter de chaque CR : `date`, `heure`, `duree`, `participants`, `lieu`.

#### 3.C.3 Génération VEVENT RFC 5545
- Pour chaque CR avec frontmatter complet :
  ```
  BEGIN:VEVENT
  UID:<fileId>@anya.issa-capital
  DTSTART:<date+heure formaté UTC>
  DURATION:PT<duree>M
  SUMMARY:<titre CR>
  DESCRIPTION:Participants: <participants>. Lieu: <lieu>.
  URL:obsidian://open?vault=<OBSIDIAN_VAULT_NAME>&file=<path encoded>
  END:VEVENT
  ```
- Deep-link Obsidian via env var `OBSIDIAN_VAULT_NAME` (Thomas clique l'event dans son calendar app → ouvre Obsidian sur la fiche CR).

#### 3.C.4 Cache iCal (optionnel)
- Réponse iCal peut être cachée 5min côté serveur pour éviter de re-scanner 24 mois × 12 dossiers à chaque requête abonnement [À CONFIRMER si implémenté].

---

## 4. Output

### Modifications vault
- **`Todo.md`** : PATCH in-place R5 sur completion + création tâches TickTick hors vault sous `## Inbox`.
- **State JSON** : `_Inbox/AnyaState/ticktick-state.json` PATCH in-place R5.
- **Aucune modif** des CR vault par iCal feed (lecture seule).

### Modifications TickTick
- Tâches créées / cochées / mises à jour selon push.
- Aucune suppression TickTick depuis Anya (Thomas garde la main).

### Quarantaine
- Si 429 persistant TickTick → push partiel, reprise au prochain cron.
- Si OAuth TickTick expiré → erreur, item `TickTick` du `health-monitor` passe NON-OK.
- Si état JSON corrompu → recovery manuelle (Thomas peut re-initialiser depuis backup).

### Récap (gabarit Telegram envoyé à Thomas)
- **Premier push projet** uniquement : "X tâche(s) pushée(s) vers TickTick projet [Nom] — premier sync de ce projet."
- **Sync routinier** : silencieux (Thomas ne veut pas de spam, S19).
- **Deletes TickTick** : silencieux (S19 décision verbatim).

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **Verrou TTL 30s OBLIGATOIRE** entre push et pull — sinon race condition PATCH simultané state JSON.
- **PATCH in-place R5 STRICT** sur state JSON et Todo.md — JAMAIS create+delete.
- **Tag `#hide-tcw` toujours respecté** — Thomas peut exclure une tâche du sync, on ne contourne jamais.
- **Deletes TickTick silencieux côté vault** (S19) — zéro notif Telegram, zéro confirmation.
- **iCal endpoint require `TICKTICK_ICAL_SECRET`** — sans token valide, 401.
- **Last-write-wins canonique vault** — en cas de conflit, le vault prime toujours (R1 vault-as-SOT).

### 5.2 Arbre de décision — sync tâche
```
Cron push (5min)
├── Acquire verrou TTL 30s
├── Parse Todo.md → VaultTasks
├── Filtrer #hide-tcw
├── Pour chaque tâche :
│   ├── hash sha1 déjà en state JSON ? → skip
│   └── nouveau hash → push TickTick (backoff 429) + update state
└── Premier push d'un projet ? → carte Telegram TTL 7j R3

Cron pull (5min, décalé 30s)
├── Acquire verrou
├── Fetch TickTick → diff state JSON
├── Pour chaque diff :
│   ├── Nouvelle tâche TickTick → ajout sous `## Inbox` Todo.md
│   ├── Tâche cochée TickTick → `- [x]` dans Todo.md
│   └── Tâche supprimée TickTick → suppression ligne Todo.md (SILENCIEUX, S19)
└── PATCH Todo.md + state JSON
```

### 5.3 Critères de qualité
- **G1 (idempotence push)** : sha1 hash garantit zéro doublon TickTick.
- **G2 (verrou strict)** : aucun PATCH simultané push/pull sur state JSON (TTL 30s).
- **G3 (last-write-wins vault)** : vault prime sur TickTick en cas de conflit.
- **G4 (red line `#hide-tcw`)** : tag toujours respecté, exclu du push.
- **G5 (deletes silencieux)** : zéro notif Telegram sur suppression TickTick (S19).
- **G6 (iCal RFC 5545)** : feed iCal parsable par n'importe quel client calendar standard.

### 5.4 Exemple complet (cas réel — push)
**Contexte** : Thomas écrit dans Todo.md vault :
```markdown
## En cours
- [ ] Appeler notaire pour signature compromis #immo
- [ ] Faire devis peintre Lot 2 #immo #hide-tcw
```

**Cron push 09h05** :
1. Acquire verrou.
2. Parse → 2 VaultTasks détectées.
3. Filtrer `#hide-tcw` → tâche "devis peintre" exclue.
4. Tâche restante : "Appeler notaire pour signature compromis" tag `#immo`.
5. hash sha1 → nouveau (pas en state JSON).
6. Push TickTick API → création tâche dans projet "Immobilier".
7. Premier push projet "Immobilier" ? Si oui → carte Telegram TTL 7j R3 :
   ```
   1 tâche pushée vers TickTick projet "Immobilier" — premier sync de ce projet.
   ```
8. Update state JSON avec nouveau hash.
9. Libération verrou.

**Cron pull 09h05:30** (décalé 30s) :
1. Acquire verrou.
2. Fetch TickTick → tâche "Appeler notaire" confirmée (vient d'être push).
3. Aucun diff → no-op.
4. Libération verrou.

### 5.5 Maintenance
- **Verrou TTL 30s** : non négociable. Si latence push/pull augmente, augmenter le décalage cron (ex. 60s) plutôt que réduire le TTL.
- **Mapping PROJECT_TAG_MAPPING** : à mettre à jour si nouveau projet vault (ex. "ImmoCrew" si Thomas ajoute ce projet). Modifier la constante dans `push.ts` [À CONFIRMER chemin].
- **iCal scan fenêtre** : 24 mois glissants. Si Thomas veut scan plus large (archives), augmenter la fenêtre (impact perf scan Drive — cache iCal recommandé).
- **OAuth TickTick refresh token** : surveillance via `health-monitor` item `TickTick`.
- **Tests** : couverture push (idempotence, filtrage `#hide-tcw`), pull (deletes silencieux), iCal (parsabilité RFC 5545) [À CONFIRMER existence].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S18 | — | Création sous-pipeline 3.A push (S18.1) [À CONFIRMER date]. |
| S18 | — | Création sous-pipeline 3.B pull (S18.2) [À CONFIRMER date]. |
| S18 | — | Création sous-pipeline 3.C iCal feed (S18.3a) [À CONFIRMER date]. |
| S19 | 2026-05-20 | Décision Thomas verbatim : deletes TickTick silencieux côté vault. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~50-100 tâches synchronisées/mois (selon densité Todo.md Thomas). Coût négligeable (pas de LLM, uniquement TickTick API + Drive PATCH).

## À confirmer (Thomas)

- [À CONFIRMER] Chemins exacts : `src/lib/secretariat/ticktick/push.ts`, `pull.ts`, `ical-feed.ts` ?
- [À CONFIRMER] Chemin `Todo.md` vault : racine ou `00. Me/` ?
- [À CONFIRMER] Mapping exact PROJECT_TAG_MAPPING (7 projets vault → 7 tags TickTick).
- [À CONFIRMER] Chemin/nom exact du state JSON Drive : `_Inbox/AnyaState/ticktick-state.json` ?
- [À CONFIRMER] Chemin/nom exact du verrou Drive : `_Inbox/AnyaState/ticktick-lock.json` ?
- [À CONFIRMER] Rate-limit exact TickTick API (X req/min).
- [À CONFIRMER] Verbatim exact décision Thomas S19 sur deletes TickTick silencieux.
- [À CONFIRMER] Endpoint Next.js iCal exact : `/api/ticktick/ical` ?
- [À CONFIRMER] Format exact VEVENT (timezone, format DTSTART, DURATION, UID).
- [À CONFIRMER] Cache iCal côté serveur (5min) implémenté ?
- [À CONFIRMER] Sessions exactes de création push/pull/iCal (S18 mais date précise ?).
- [À CONFIRMER] Suite de tests dédiée (push/pull/iCal) dans la baseline.
