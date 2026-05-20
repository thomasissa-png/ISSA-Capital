---
skill: hot-context-updater
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~10-20 updates/semaine
modules_code:
  - src/lib/secretariat/hot-context/updater.ts [À CONFIRMER chemin]
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/vault-client/
  - src/lib/secretariat/llm/client.ts
modeles_llm:
  - haiku-4-5 (claude-haiku-4-5-20251001) — détection signaux
trigger_principal: cron 5min (décalé 90s vs TickTick pull)
output_principal: `00. Me/hot-context.md` mis à jour via PATCH in-place R5
---

# Workflow Hot Context Updater — maintenir le briefing live de Thomas (4 sections, cible 500 tokens)

> Source : `src/lib/secretariat/hot-context/updater.ts` [À CONFIRMER chemin]. Pipeline parent : cron Replit (5min). Architecture : voir `docs/ia/anya-current-architecture.md`. `00. Me/hot-context.md` est lu en TTL 1h par tous les autres workflows (CR Réunion, Draft Email, etc.) pour injection system prompt.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — cron 5min
- Cron Replit toutes les 5 minutes, **décalé 90s par rapport au cron TickTick pull** (pour éviter conflits PATCH simultanés sur le vault).
- Décalage 90s = aucun chevauchement avec le verrou anti-concurrence TickTick (TTL 30s).

### Variantes ciblées
- **4 sources scannées** à chaque run :
  1. Emails JSONL ingérés depuis dernier run (`_Inbox/AnyaLogs/`).
  2. CR vault récents (`06. Réunions/YYYY/MM/*.md`).
  3. Telegram explicite (Thomas tape `#hotcontext` ou commence message par `Anya note`).
  4. Notes vault récentes 24h (filtre Drive `modifiedTime`).

### Hors trigger
- Pas de déclencheur manuel utilisateur (sauf forçage via commande Telegram explicite `#hotcontext refresh` [À CONFIRMER si implémenté]).
- Pas de déclenchement sur écriture vault arbitraire — seulement le cron.

---

## 2. Input

### Fiches à consulter en début de workflow
- **`00. Me/hot-context.md`** — fichier cible, lu en début pour connaître l'état actuel.
- **Vault sources** : `_Inbox/AnyaLogs/`, `06. Réunions/YYYY/MM/`, fichiers récents (filtre `modifiedTime`).

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Emails JSONL | Ingestions depuis dernier run | `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` |
| CR vault récents | `06. Réunions/YYYY/MM/*.md` modifiés récemment | vault-reader filtre `modifiedTime` |
| Telegram explicite | Messages Thomas avec `#hotcontext` ou prefix `Anya note` | webhook log |
| Notes vault 24h | Fichiers vault avec `modifiedTime > now - 24h` | Drive API list |

### Convention de nommage
- **Fichier cible** : `00. Me/hot-context.md` (unique, fixe).
- **4 sections cible** [À CONFIRMER noms exacts — vraisemblablement] :
  - `## Cette semaine` (général)
  - `## Cette semaine — pro`
  - `## Cette semaine — perso`
  - `## Notes flottantes`
- **Section immuable** : `## Maintenance` (zone réservée Thomas, NE JAMAIS toucher).
- Cible compactée : **500 tokens** (pour injection efficace dans les system prompts downstream).

### Outils API requis
- **vault-reader** — `readFileById()` sur hot-context.md + filtre Drive list `modifiedTime > now - 24h`.
- **Anthropic SDK** — Haiku 4.5 via wrapper `llm/client.ts` (R1 S17 — cache_control + tracking).
- **vault-client** — `updateFileContent()` PATCH in-place R5.
- **Telegram Bot API** — carte 3 boutons via pending-store Drive TTL 7j R3.

---

## 3. Étapes

### 3.1 Lecture hot-context actuel
- `readFileById(hotContextFileId)` → contenu live.
- Parsing des 4 sections + section Maintenance (à préserver intacte).

### 3.2 Pré-filtre heuristique (économie tokens)
- Pour chaque source, filtrage regex/keywords avant LLM :
  - Emails JSONL : ne retenir que ceux avec catégorie `apporteur`, `contact-pro`, ou flag "réponse attendue" [À CONFIRMER critère].
  - CR vault : retenir seulement ceux modifiés depuis dernier run (timestamp checkpoint).
  - Telegram explicite : déjà filtré côté webhook (présence `#hotcontext` ou `Anya note`).
  - Notes vault 24h : filtrer par dossiers pertinents (exclure `_Inbox/Photos/`, `_Inbox/AnyaLogs/`).
- Économie ~70% des tokens (proportion observée S14 sur le workflow Email Ingest, hypothèse extrapolée — [À CONFIRMER mesure réelle hot-context]).

### 3.3 Détection signaux par Haiku 4.5
- Wrapper `llm/client.ts` → Haiku 4.5 (`claude-haiku-4-5-20251001`).
- System prompt scindé : partie stable cachée (instructions + structure 4 sections + cible 500 tokens), partie dynamique (sources filtrées concaténées).
- Output JSON validé Zod : array de signaux `{ section: "...", text: "...", source: "...", signalId: "..." }`.
- `signalId` = sha1(source + texte canonique) — base de l'idempotence.

### 3.4 Idempotence sha1
- Pour chaque signal détecté : check si `signalId` déjà présent dans un cache local OU dans le contenu actuel de hot-context.md [À CONFIRMER stratégie : cache Drive ou détection inline].
- Si signalId déjà traité → skip (pas de re-proposition).

### 3.5 Carte Telegram validation
- Pour chaque nouveau signal : carte inline keyboard avec **3 boutons** :
  - `Valider` (intègre dans hot-context.md)
  - `Modifier` (Thomas tape sa version corrigée)
  - `Skip` (signal rejeté, signalId logué pour ne pas re-proposer)
- Préfixe callback `hotcontext:` (R4 — handler + dispatch + test E2E).
- Pending-store Drive TTL 7j R3.

### 3.6 Application après validation
- Sur callback `Valider` :
  1. Lecture live hot-context.md.
  2. Insertion du signal dans la section cible (déterminée par Haiku 4.5 ou par Thomas).
  3. **Vérification red line** : le payload final DOIT contenir un wikilink `[[...]]` Obsidian (sinon rejet — sanity check format vault).
  4. **Vérification red line** : section `## Maintenance` doit rester intacte byte-pour-byte.
  5. `updateFileContent()` PATCH in-place R5.

### 3.7 Audit JSONL (6 events)
Append dans `_Inbox/AnyaLogs/hot-context-audit.jsonl` [À CONFIRMER chemin/nom exact] avec un des 6 events :
- `detected` — signal détecté par Haiku 4.5.
- `proposed` — carte Telegram envoyée à Thomas.
- `validated` — Thomas a cliqué Valider.
- `rejected` — Thomas a cliqué Skip.
- `written` — hot-context.md mis à jour (PATCH appliqué).
- `skipped` — signal écarté par sha1 idempotence avant proposition.

[À CONFIRMER libellés exacts des 6 events].

### 3.8 Compactage 500 tokens
- Si après ajout le hot-context.md dépasse ~500 tokens (mesure via tokenizer Anthropic ou estimation chars/4), proposer un compactage des entrées les plus anciennes.
- [À CONFIRMER si compactage auto ou propose une carte Telegram à Thomas].

---

## 4. Output

### Modifications vault
- **`00. Me/hot-context.md`** : PATCH in-place R5 après chaque validation.
- **Section Maintenance** : INTACTE (red line).

### Quarantaine
- Si Haiku 4.5 retourne JSON invalide → retry x1 puis warn Telegram à Thomas.
- Si PATCH échoue → warn console, signal re-proposé au prochain cron (sha1 toujours valide).

### Récap (gabarit Telegram envoyé à Thomas)
Pour chaque signal détecté :
```
Nouveau signal détecté pour ton hot-context.

Section proposée : [section]
Texte :
> [texte signal]

Source : [origine]

[3 boutons : Valider / Modifier / Skip]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **Payload PATCH DOIT contenir un wikilink `[[...]]` Obsidian** — sinon rejet (sanity check format vault). Garantit qu'on n'écrit pas un texte brut sans contexte navigable.
- **Section `## Maintenance` IMMUABLE** — zone réservée Thomas. Anya ne touche JAMAIS à son contenu, même par accident. Vérification byte-à-byte avant PATCH.
- **JAMAIS create+delete sur hot-context.md** (R5 P0 #99) — uniquement PATCH in-place.
- **JAMAIS skip le pré-filtre heuristique** — sinon coût Anthropic explose (4 sources × 5min × 24h × 30j = beaucoup d'appels LLM).
- **JAMAIS dépasser durablement ~500 tokens** dans hot-context.md — compactage obligatoire si dépassement.
- **JAMAIS modifier sans validation Thomas** — chaque signal passe par la carte 3 boutons (sauf compactage automatique si configuré).

### 5.2 Arbre de décision — détection à intégration
```
Cron 5min (décalé 90s vs TickTick pull)
└── Pour chaque source (4 sources) :
    ├── Pré-filtre heuristique
    ├── Détection Haiku 4.5
    └── Pour chaque signal :
        ├── signalId déjà traité (sha1 idempotence) ?
        │   ├── OUI → skip silencieux (audit `skipped`)
        │   └── NON → carte Telegram 3 boutons (audit `detected` + `proposed`)
        └── Sur callback Thomas :
            ├── Valider → vérif wikilink + Maintenance intacte → PATCH (audit `validated` + `written`)
            ├── Modifier → re-prompt Thomas → re-cycle
            └── Skip → audit `rejected`, signalId logué
```

### 5.3 Critères de qualité
- **G1 (cible 500 tokens)** : hot-context.md compact pour injection efficace dans les system prompts downstream.
- **G2 (idempotence sha1)** : un même signal détecté 2× ne génère qu'UNE carte Telegram.
- **G3 (red line wikilink)** : 100% des payloads PATCH contiennent au moins un `[[...]]`.
- **G4 (red line Maintenance)** : section `## Maintenance` invariante byte-pour-byte sur tous les runs.
- **G5 (cache hit Anthropic)** : `cache_read_input_tokens` > 0 (system prompt stable caché).
- **G6 (décalage 90s vs TickTick)** : pas de PATCH simultané hot-context vs TickTick state.

### 5.4 Exemple complet (cas réel)
**Contexte cron** : 09h05, dernier run cron à 09h00.

**Sources scannées** :
- Emails JSONL : 3 nouveaux emails dont 1 d'un notaire programmant un RDV "Compromis Henri Barbusse 3 — mercredi 22 mai 14h".
- CR vault récents : aucun nouveau depuis 09h00.
- Telegram explicite : aucun message `#hotcontext`.
- Notes vault 24h : 1 fichier modifié `02. Projets/02. Pro/Immobilier Direct.md` (write-back CR matinal).

**Pré-filtre** : email notaire passe (catégorie `contact-pro` + RDV détecté), 2 autres écartés (newsletter + facture). Note vault détectée comme déjà couverte par autre source.

**Haiku 4.5 détection** :
```json
{
  "signals": [
    {
      "section": "Cette semaine — pro",
      "text": "RDV notaire mercredi 22 mai 14h — signature compromis [[Lot Henri Barbusse 3]]",
      "source": "email-notaire-marc-dupond",
      "signalId": "sha1:abc123..."
    }
  ]
}
```

**Idempotence check** : `abc123...` pas en cache → poursuite.

**Audit JSONL** : event `detected` + event `proposed`.

**Telegram** : carte 3 boutons → Thomas clique `Valider`.

**Vérifications** :
- Wikilink `[[Lot Henri Barbusse 3]]` présent → OK.
- Section `## Maintenance` intacte → OK.

**PATCH appliqué** sur `00. Me/hot-context.md` section `## Cette semaine — pro` :
```markdown
## Cette semaine — pro

- RDV notaire mercredi 22 mai 14h — signature compromis [[Lot Henri Barbusse 3]]
- [autres entrées existantes...]

## Maintenance
[contenu Thomas, immuable]
```

**Audit JSONL** : event `validated` + event `written`. SignalId `abc123...` ajouté en cache.

### 5.5 Maintenance
- **Décalage cron** : 90s vs TickTick pull — critique pour éviter conflits PATCH simultanés.
- **Cache TTL** : hot-context.md lu en TTL 1h par les workflows downstream → après PATCH, le nouveau contenu est disponible dans max 1h (acceptable, latence non bloquante).
- **Compactage** : si hot-context dépasse 500 tokens durablement, proposer un compactage manuel à Thomas (carte Telegram dédiée [À CONFIRMER si implémenté]).
- **Persistance sha1 idempotence** : cache Drive ou inline détection dans le fichier [À CONFIRMER stratégie].
- **Tests** : couverture minimale (4 sources, 6 events JSONL, red lines wikilink + Maintenance) [À CONFIRMER existence suite test].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Création workflow hot-context updater [À CONFIRMER session origine]. |
| S17 | 2026-05-19 | Migration wrapper LLM unifié (R1) — cache_control auto + tracking 100%. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~10-20 signaux validés/semaine. Coût Anthropic optimisé (Haiku 4.5 + pré-filtre heuristique + cache_control). Estimation < 2 EUR/mois.

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/hot-context/updater.ts` ?
- [À CONFIRMER] Noms exacts des 4 sections cible (`## Cette semaine`, `## Cette semaine — pro`, `## Cette semaine — perso`, `## Notes flottantes` — à valider).
- [À CONFIRMER] Libellés exacts des 6 events JSONL audit (detected / proposed / validated / rejected / written / skipped — à valider).
- [À CONFIRMER] Chemin/nom exact du fichier audit JSONL : `_Inbox/AnyaLogs/hot-context-audit.jsonl` ?
- [À CONFIRMER] Persistance sha1 idempotence : cache Drive séparé ou détection inline dans hot-context.md ?
- [À CONFIRMER] Compactage 500 tokens : auto ou via carte Telegram à Thomas ?
- [À CONFIRMER] Préfixe callback `hotcontext:` — handler + dispatch + test E2E (R4) existants ?
- [À CONFIRMER] Filtre emails JSONL pour pré-filtre (critère exact : catégorie + flag réponse attendue ?).
- [À CONFIRMER] Mesure réelle économie tokens pré-filtre heuristique (extrapolation 70% à valider).
