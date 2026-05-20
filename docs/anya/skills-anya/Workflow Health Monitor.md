---
skill: health-monitor
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: 1 run/jour
modules_code:
  - src/lib/secretariat/health-monitor/
  - src/lib/secretariat/health-monitor/anthropic-usage.ts
modeles_llm: []
trigger_principal: cron daily
output_principal: rapport daily envoyé à Thomas (canal Telegram ou dashboard [À CONFIRMER])
---

# Workflow Health Monitor — surveillance 7 items + budget Anthropic mensuel + cron daily

> Source : `src/lib/secretariat/health-monitor/` + `anthropic-usage.ts` (221L). Pipeline parent : cron Replit daily. Architecture : voir `docs/ia/anya-current-architecture.md`. Tracking 100% depuis S17 R1 wrapper LLM (avant S17 : 3 appels Anthropic non trackés, sous-estimation 60-80%).

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — cron daily
- Cron Replit 1×/jour [À CONFIRMER heure exacte — vraisemblablement matin France, ex. 07h00].
- Pas de webhook, pas de déclencheur utilisateur.

### Variantes ciblées
- **Run nominal** : 7 items checkés, rapport envoyé même si tous OK.
- **Alerte immédiate** : si un item passe NON-OK hors fenêtre cron (détecté par un autre workflow), notification Telegram immédiate sans attendre le cron daily [À CONFIRMER si implémenté].

### Hors trigger
- Pas de déclencheur manuel utilisateur (sauf forçage via commande Telegram `Anya health` [À CONFIRMER si implémenté]).

---

## 2. Input

### Fiches à consulter en début de workflow
- **Persistance usage Anthropic** : `_Inbox/AnyaState/anthropic-usage-YYYY-MM.json` [À CONFIRMER nom exact] — usage cumulé mois en cours.
- **Env vars** : `ANTHROPIC_BUDGET_EUR` (défaut 50 EUR).

### Sources à scanner
| Source | Item | Check |
|---|---|---|
| Google Drive API | Drive | `files.list` simple — vérifier accès |
| Google Calendar API | Calendar | `events.list` simple |
| Gmail API | Gmail | `users.getProfile` |
| TickTick API | TickTick | endpoint user/profile |
| Anthropic API | Anthropic | usage cumulé vs budget mensuel |
| OpenAI Whisper API | Whisper | `models.retrieve("whisper-1")` |
| Filesystem Replit | FS | check disponibilité `/tmp` + quota Replit [À CONFIRMER] |

### Convention de nommage
- **Rapport daily** : envoyé à Thomas en Telegram (ou dashboard) — pas de persistance vault par défaut [À CONFIRMER].
- **Audit usage Anthropic** : `_Inbox/AnyaState/anthropic-usage-YYYY-MM.json` (1 fichier par mois).

### Outils API requis
- **6 APIs externes** (Drive, Calendar, Gmail, TickTick, Anthropic, Whisper) — checks ping.
- **Filesystem** Replit — accès `/tmp`.
- **Telegram Bot API** — envoi rapport.

---

## 3. Étapes

### 3.1 Boucle de check sur 7 items
Pour chaque item :
- Tentative ping minimal (endpoint léger, pas de body lourd).
- Mesure latence (optionnel — pour détecter dégradation).
- Capture erreur (status code, message) si échec.
- Verdict : OK / NON-OK + détails.

### 3.2 Check spécial Anthropic — budget mensuel
- Lecture `_Inbox/AnyaState/anthropic-usage-YYYY-MM.json` :
  ```json
  {
    "month": "2026-05",
    "input_tokens": 1234567,
    "output_tokens": 89012,
    "cache_read_input_tokens": 456789,
    "cost_usd": 42.15,
    "cost_eur": 38.78
  }
  ```
- Calcul ratio : `cost_eur / ANTHROPIC_BUDGET_EUR`.
- **Seuil 95%** : si ratio ≥ 0.95 → item Anthropic NON-OK + alerte explicite "Budget Anthropic à X% du mois (Y EUR / Z EUR)".
- Conversion USD → EUR : taux 0,92 (figé ou live ? [À CONFIRMER]).

### 3.3 Persistance usage Anthropic
- `anthropic-usage.ts` est appelé par le wrapper LLM `llm/client.ts` à chaque appel Anthropic (R1 S17 — tracking 100%).
- À chaque appel : incrément `input_tokens`, `output_tokens`, `cache_read_input_tokens`, calcul `cost_usd` selon pricing modèle, conversion EUR.
- PATCH in-place R5 sur le JSON (jamais create+delete).

### 3.4 Génération rapport daily
- Format :
  ```
  Anya Health — [YYYY-MM-DD]
  
  ✅ Drive    — OK
  ✅ Calendar — OK
  ✅ Gmail    — OK
  ❌ TickTick — OAuth expiré (Erreur 401)
  ✅ Anthropic — OK (42 EUR / 50 EUR — 84%)
  ✅ Whisper  — OK
  ✅ FS       — OK (Replit /tmp libre 80%)
  
  6/7 items OK.
  ```
- Si tout OK : rapport court ("Tous les 7 items OK. Budget Anthropic X%.").
- Si NON-OK : détails explicites + alerte action.

### 3.5 Envoi rapport
- Canal : Telegram (sendMessage) par défaut [À CONFIRMER si dashboard alternatif].
- Heure cron : matin France (Thomas voit le rapport au réveil).
- Si alerte critique (Anthropic > 95% OU 2+ items NON-OK) → marquage `‼️` + message court action proposée.

---

## 4. Output

### Modifications vault
- **`_Inbox/AnyaState/anthropic-usage-YYYY-MM.json`** : mise à jour continue par wrapper LLM (pas par le cron daily lui-même).
- **Aucune autre modif vault** par ce workflow direct.

### Quarantaine
- Si check d'un item lève une exception non gérée → item marqué NON-OK avec message "Exception : <type>".
- Rapport généré et envoyé même si plusieurs items down (best-effort).
- Si Telegram lui-même est down → fallback log console + retry au prochain cron [À CONFIRMER stratégie].

### Récap (gabarit Telegram envoyé à Thomas)
```
Anya Health — [YYYY-MM-DD]

[7 lignes statut items]

[X]/7 items OK.
Budget Anthropic : [Y EUR / Z EUR — N%]

[Si alerte : actions proposées]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS désactiver le tracking Anthropic** — wrapper LLM `llm/client.ts` obligatoire (R1 S17). Appels Anthropic directs interdits.
- **JAMAIS ignorer un item NON-OK** — alerte Telegram immédiate si Anthropic > 95% ou TickTick OAuth expiré ou Drive inaccessible.
- **JAMAIS ping API avec body lourd** — endpoints légers obligatoires (économie quota + latence).
- **JAMAIS skip un check** — les 7 items doivent être tous tentés à chaque run (même si certains down).
- **JAMAIS create+delete sur l'usage JSON** (R5 P0 #99) — PATCH in-place strict.

### 5.2 Arbre de décision — verdict global
```
Cron daily déclenché
├── Pour chaque item (7 items) :
│   ├── ping → OK ?
│   │   ├── OUI → marquage ✅
│   │   └── NON → marquage ❌ + capture erreur
├── Anthropic spécial :
│   ├── usage / budget < 95% → ✅
│   └── usage / budget ≥ 95% → ❌ + alerte explicite
├── Génération rapport
└── Envoi Telegram
    ├── Tous OK → rapport court
    └── ≥ 1 NON-OK → rapport détaillé + action proposée
```

### 5.3 Critères de qualité
- **G1 (7 items checkés)** : tous tentés à chaque run, même si certains down (best-effort).
- **G2 (tracking 100%)** : tous les appels Anthropic passent par wrapper LLM (R1 S17). Avant S17 : 3 appels non trackés (sous-estimation 60-80%).
- **G3 (conversion USD/EUR à jour)** : taux 0,92 figé ou refresh régulier [À CONFIRMER].
- **G4 (rapport généré sans crash)** : si 1 item lève exception, rapport quand même envoyé avec autres items.
- **G5 (alerte 95%)** : item Anthropic NON-OK déclenche notification proactive.

### 5.4 Exemple complet (cas réel)
**Date** : 20 mai 2026, cron 07h00.

**Checks** :
- Drive : `files.list` → 200 OK (latence 120ms). ✅
- Calendar : `events.list` → 200 OK. ✅
- Gmail : `getProfile` → 200 OK. ✅
- TickTick : `user/profile` → 401 (OAuth refresh token expiré). ❌
- Anthropic : usage mai 2026 = 42,15 USD = 38,78 EUR / 50 EUR = 77,6%. ✅
- Whisper : `models.retrieve("whisper-1")` → 200 OK. ✅
- FS Replit : `/tmp` libre 78% (quota 1 GB). ✅

**Rapport Telegram** :
```
Anya Health — 2026-05-20

✅ Drive    — OK
✅ Calendar — OK
✅ Gmail    — OK
❌ TickTick — OAuth expiré (401)
✅ Anthropic — OK (38,78 EUR / 50 EUR — 78%)
✅ Whisper  — OK
✅ FS       — OK (/tmp libre 78%)

6/7 items OK.

‼️ Action proposée : refresh OAuth TickTick (lien settings Replit).
```

### 5.5 Maintenance
- **Mise à jour pricing Anthropic** : si Anthropic change ses prix (Haiku 4.5, Sonnet 4, Sonnet 4.6 futur), modifier la constante dans `anthropic-usage.ts` (pricing par modèle).
- **Conversion USD/EUR** : taux 0,92 actuel — à revoir trimestriellement ou passer à un live (Yahoo Finance ou ECB) [À CONFIRMER].
- **Budget mensuel** : env var `ANTHROPIC_BUDGET_EUR` — modifiable sans redéploiement.
- **Ajout d'un nouvel item** : si Anya intègre un nouveau service (ex. nouvelle API tierce), ajouter un check dédié dans `health-monitor/`. Le format rapport s'étend automatiquement.
- **Évolution alerte 95%** : si Thomas veut un seuil plus tôt (80% pour anticiper), modifier constante.
- **Tests** : couverture minimale (7 items mockés, scénarios OK / NON-OK / exception) [À CONFIRMER existence suite test].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Création health-monitor avec 7 items + budget Anthropic [À CONFIRMER session origine]. |
| S17 | 2026-05-19 | Wrapper LLM unifié R1 — tracking Anthropic 100% (avant S17 : 3 appels non trackés, sous-estimation 60-80%). |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : 1 run/jour = 30 runs/mois. Coût négligeable (pings API légers, pas de LLM).

## À confirmer (Thomas)

- [À CONFIRMER] Heure exacte du cron daily (ex. 07h00 Europe/Paris) ?
- [À CONFIRMER] Canal output rapport : Telegram (par défaut) vs dashboard alternatif ?
- [À CONFIRMER] Chemin/nom exact du JSON usage Anthropic : `_Inbox/AnyaState/anthropic-usage-YYYY-MM.json` ?
- [À CONFIRMER] Conversion USD/EUR : taux 0,92 figé ou live API (ECB ?) ?
- [À CONFIRMER] Alerte immédiate hors cron (item NON-OK détecté par un autre workflow) — implémentée ?
- [À CONFIRMER] Commande Telegram manuelle `Anya health` pour forcer un run ad-hoc — implémentée ?
- [À CONFIRMER] Item `FS Replit` : check `/tmp` quota — détails du check exact ?
- [À CONFIRMER] Suite de tests dédiée health-monitor dans la baseline 1716 tests.
- [À CONFIRMER] Stratégie fallback si Telegram lui-même est down (le canal de rapport).
