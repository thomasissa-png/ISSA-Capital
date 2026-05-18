# Audit @ia — Anya (système secrétariat IA) — Session 16

> Audit produit le 2026-05-18 par @ia. Branche `claude/issa-capital-s14-ttl-audit-ZQcQS` HEAD `582c85c`. Tests baseline 1255 verts.
> Périmètre : `src/lib/secretariat/` (~7704 LOC) + `src/app/api/telegram/webhook/route.ts` + prompts (`triage-v1.md`, `secretariat-system-prompt.md`) + docs IA + flow Telegram → vault Obsidian + Drive + Calendar + email.

---

## Note finale : **7,1/10 — SOLIDE**

Anya tient la route en production : split modèles raisonné (Haiku 4.5 triage/router, Sonnet 4 CR/draft), pré-filtre heuristique, validation humaine systématique sur cartes Telegram, idempotence write-back, 1255 tests verts dont une matrice confusion 100% sur 20 fixtures triage. Le code a déjà cache_control (3 sites sur 6) et tracking coût mensuel + budget alerte (`health-monitor/anthropic-usage.ts`). Trois choses coûtent les points : (1) **trois appels Anthropic dans `webhook/route.ts` sans cache_control ni tracking** — trou prod réel ; (2) modèle Sonnet 4 figé alors que les agents Gradient internes utilisent Sonnet 4.6 — migration jamais faite ; (3) dette R7 active hardcodée 24h après l'écriture de la règle, et docs/ia/ pollué par 2 fichiers S4 obsolètes (WhatsApp/Craft) jamais archivés.

---

## Tableau récapitulatif

| # | Critère | Poids | Note | Justification 1 ligne |
|---|---|---|---|---|
| 1 | Architecture LLM | 15% | 7/10 | Split Haiku/Sonnet propre dans 3 modules, mais 3 appels Anthropic supplémentaires dans `webhook/route.ts` hors abstraction = 6 sites au total, aucun wrapper unifié. |
| 2 | Économie tokens | 10% | 6/10 | `cache_control` actif dans 3/6 call sites. Pré-filtre heuristique présent. Les 3 appels webhook (les plus coûteux, Sonnet 4 + system prompt long) **n'ont ni cache ni tracking**. |
| 3 | Robustesse pipeline | 15% | 8/10 | Validation humaine systématique, pending-store TTL 7j (R3), idempotence write-back par `includes(webViewLink)`, retry self-correction Zod, dispatch MIME. |
| 4 | Qualité prompts | 15% | 7/10 | `triage-v1.md` exemplaire (few-shot, anti-patterns, JSON strict, 100% matrice). Mais `secretariat-system-prompt.md` (~700L) décrit l'architecture S4 obsolète, et le prompt CR est concaténé inline dans webhook (string + timeInstruction). |
| 5 | Source de vérité | 10% | 6/10 | R5/R6 respectées dans `updateFileContent`. R7 violée : `PROJET_FICHE_FILE_IDS` hardcodé dans `cr-writeback.ts:38-43` ajouté en S16 avec TODO S17 (R7 écrite **dans la même session**). |
| 6 | Tests | 10% | 9/10 | 1255 tests, matrice confusion 100%/100% sur 20 fixtures triage, E2E webhook couvert, scénarios edge mode solo (S16), `__tests__/cr-mode-solo.test.ts` + 27 tests write-back. |
| 7 | Coût mensuel projeté | 10% | 7/10 | Tracking actif (`anthropic-usage.ts` + budget mensuel + alerte 95%). Mais 3 appels webhook non instrumentés = sous-estimation. Évaluations S15 (Kimi, Mistral 8 alternatives) avec ROI < 3 = statu quo confirmé. |
| 8 | UX Telegram | 5% | 8/10 | 5 boutons no-match, TTL 7j, dispatch MIME par signature bytes (S13 #92), ack <5s. R4 checklist callback récente (S14 fix `email_nomatch:` oublié). |
| 9 | Conformité | 5% | 5/10 | Anthropic USA = transfert hors UE de données patrimoniales/locataires. Aucun PII detection / guardrail / jailbreak detection dans le code (grep = 0 hit). Mention RGPD présente uniquement dans le footer PDF (`cr-renderer.ts:308`). |
| 10 | Évolutivité | 5% | 7/10 | Nouveau handler = ~3h (template clair via `handlers/types.ts`). Nouveau modèle = changer 4 constantes + 2 fichiers PRICING + tests = ~2h. Nouveau callback préfixe = 3 endroits (R4). |

**Moyenne pondérée** = (7×15 + 6×10 + 8×15 + 7×15 + 6×10 + 9×10 + 7×10 + 8×5 + 5×5 + 7×5) / 100 = **7,1/10**

---

## Top 3 forces

### F1 — Prompt triage exemplaire (`triage/prompts/triage-v1.md`)

Le prompt triage (119 lignes) est le meilleur asset prompt du repo : 6 catégories nettement définies, **5 anti-patterns explicites** (lignes 17-22), 3 exemples few-shot complets avec input/output JSON (lignes 70-117), injection dynamique des listes contacts (ligne 30-37), override automatique côté code si confidence < 0.7. Résultat : **matrice confusion 100%/100% sur 20 fixtures** (`triage/__tests__/eval.test.ts`). C'est la référence à dupliquer pour les futurs prompts. Fichier versionné `triage-v1.md` = bonne discipline.

### F2 — Health-monitor avec tracking coût + budget mensuel (`health-monitor/anthropic-usage.ts`)

221 lignes, persistance JSON atomique (.tmp + rename), reset auto en début de mois, pricing officiel Haiku/Sonnet hardcodé avec conversion USD→EUR (0.92), exposé via `getMonthlyUsageEur()` et `getMonthlyBudgetEur()` (defaut 50 EUR via env). Le `monitored-items.ts:67-94` câble une alerte santé à 95% du budget. C'est un standard production que beaucoup de projets négligent. Bémol : seuls les 3 appels qui passent par `recordAnthropicUsage()` sont comptés — les 3 appels `webhook/route.ts` n'y passent pas (cf W1).

### F3 — Pipeline validation humaine + idempotence (`cr-writeback.ts` + `pending-store.ts` + `drive-upload.ts:374-415`)

`handlers/cr-writeback.ts:108-145` implémente `upsertCrSection()` : lookup heading "## Comptes Rendus" → si absent crée la section, si présent vérifie `existingSection.includes(webViewLink)` avant d'ajouter. Idempotence garantie — re-jouer le write-back = no-op, pas de doublons. Combiné au pending-store Drive (TTL 7j R3) et au PATCH in-place R5 (`updateFileContent` via `/upload/drive/v3/files/{fileId}?uploadType=media`), Anya n'a JAMAIS écrit deux fois la même donnée en S16, ni cassé un wikilink Obsidian.

---

## Top 3 faiblesses

### W1 — Trois appels Anthropic dans `webhook/route.ts` sans cache_control ni tracking

`src/app/api/telegram/webhook/route.ts:375, 481, 706` font des `client.messages.create()` directs **hors** des modules `secretariat/`. Constat factuel :
- **Pas de `cache_control`** : `system: systemPrompt + timeInstruction + searchInstruction` (ligne 379). Le system change à chaque appel (timeInstruction contient l'heure courante) → 0% cache hit possible même si Anthropic le supportait. Coût input ~3500 tokens × 100% non-cached pour CHAQUE CR.
- **Pas de `recordAnthropicUsage()`** : grep confirme. Le tracking coût mensuel sous-estime la facture réelle de ~60-80% (les CR sont les appels les plus chers : Sonnet 4 + system long + outils `web_search_20250305`).
- **Modèle hardcodé `claude-sonnet-4-20250514`** (S4 avril 2026, ligne 230) avec fallback env. La famille Sonnet 4.6 (utilisée par les agents internes `.claude/agents/*.md`) n'a jamais été testée pour Anya. Régression potentielle sur les CR si on migre sans tests.

**Impact** : à 15 CR/mois Anthropic coûte peut-être ~3 EUR/mois (pas 1,35 EUR comme estimé S15). À 100 CR/mois la dérive devient ~20 EUR vs ~5 EUR projetés. Budget alerte 50 EUR/mois ne se déclenchera jamais à temps.

### W2 — Dette R7 active : `PROJET_FICHE_FILE_IDS` hardcodé dans cr-writeback.ts (24h après l'ajout de R7)

`src/lib/secretariat/handlers/cr-writeback.ts:38-43` contient un mapping en dur de 4 fileIds (IC/GO/VI/VV) avec TODO explicite ligne 33-36 : "TODO S17 (R7 P1 #101) — Résoudre dynamiquement via vault-reader/search au lieu d'un hardcoded". Le code a été commité S16 (commit `582c85c`) **dans la même session** où R7 a été ajoutée à CLAUDE.md. Violation au moment du commit (R7 dit : "retirer le hardcoded dans le MÊME jalon ou immédiatement après validation source live").

**Impact concret** : si Thomas renomme une fiche Projet dans Obsidian, le write-back tombe silencieusement (le code log un warn mais ne casse pas le flux CR). Si une nouvelle entité est créée (5ème projet), le code ne suit pas — il faut un commit pour ajouter un fileId. `vault-reader.ts:1-267` sait déjà chercher par nom, la migration = ~30 lignes + cache.

### W3 — Pollution docs/ia/ par 2 fichiers S4 obsolètes (`secretariat-architecture.md` 920L, `secretariat-system-prompt.md` 700L+)

Les deux fichiers, produits S4 (2026-04-08), décrivent une stack **jamais implémentée** : WhatsApp Cloud API Meta, Craft.do, SQLite + SQLCipher, RFC 3161 Universign, RBAC multi-utilisateurs Carl/Maxime. La stack live est **complètement différente** : Telegram, Drive Obsidian, FS Replit, Whisper, mono-utilisateur Thomas. Aucun de ces 1620+ lignes ne reflète la réalité du code.

**Impact** : (a) un futur agent (ou Claude lui-même) qui lit `secretariat-architecture.md` pour comprendre Anya part dans une mauvaise direction ; (b) `cache_control` est mentionné comme spec dans `secretariat-system-prompt.md` ligne 17 mais le webhook n'en a pas — incohérence doc/code ; (c) coût tokens à chaque session : ~7500 tokens lus pour zéro valeur. `anya-spec.md` n'a pas été lu pour cet audit mais est probablement dans le même état.

---

## 3 recommandations actionnables S17 (< 1 jour chacune)

### R1 — Wrapper Anthropic unifié `src/lib/secretariat/llm/client.ts` (4h)

Créer un module qui :
1. Expose `callAnthropic(opts)` avec `cache_control` automatique sur le system prompt (sauf si `opts.dynamicSystem = true`).
2. Logue toujours via `recordAnthropicUsage()` (extraire `cache_read_input_tokens` de `response.usage`).
3. Centralise les constantes modèles dans un sous-fichier `models.ts` (HAIKU_4_5 = 'claude-haiku-4-5-20251001', SONNET_4 = 'claude-sonnet-4-20250514', et préparer SONNET_4_6 commenté).
4. Migrer les 6 call sites (3 dans `secretariat/`, 3 dans `webhook/route.ts`). Pour le webhook, extraire le `systemPrompt` "stable" en cache_control et garder `timeInstruction` en `messages[]` côté user pour préserver la variabilité sans casser le cache.

Closes W1 entier. Pré-requis pour évals CI futures.

### R2 — Migrer `PROJET_FICHE_FILE_IDS` hardcodé → vault-reader live (2h)

Fichier : `src/lib/secretariat/handlers/cr-writeback.ts:38-43`.
Action : créer `findProjetFicheByEntite(entiteCode)` dans `vault-reader.ts` qui mappe entité → nom de fiche (`IC → "ISSA Capital"`, etc.) puis `searchByName()`. Cache mémoire TTL 1h cohérent avec `contacts-cache.ts`. Fallback gracieux : si non trouvé, warn console + write-back skip non-bloquant (déjà le pattern actuel). Tests : ajouter fixture pour entité inconnue + entité renommée. **Closes W2** + dette R7.

### R3 — Archiver `secretariat-architecture.md` + `secretariat-system-prompt.md` + `anya-spec.md` (1h)

Déplacer vers `docs/archive/secretariat-s4-whatsapp-craft/` (avec README expliquant le décalage stack imaginaire vs stack live). Créer un nouveau `docs/ia/anya-current-architecture.md` court (~150 lignes) qui décrit la stack réelle S16 :
- Telegram webhook → dispatch MIME → workflows (`rent/`, `email-ingest/`, CR via `cr-renderer`)
- 3 modèles : Haiku 4.5 (triage, router), Sonnet 4 (CR, draft email), Whisper (STT)
- Sources de vérité : vault Drive (R1), pending-store (TTL 7j R3), PATCH in-place (R5)
- Tracking : `health-monitor/anthropic-usage.ts` + budget alerte

Inventaire trivial depuis `ls src/lib/secretariat/` + lecture handlers index. Closes W3.

---

## Recommandation stratégique long-terme

### S1 — Migration progressive vers Sonnet 4.6 (minor-family upgrade) avec A/B testing

Anya utilise `claude-sonnet-4-20250514` figé depuis S4 (avril 2026). Les agents Gradient internes (`.claude/agents/legal.md`, `creative-strategy.md`, etc.) sont sur Sonnet 4.6. Anthropic ne déprécie pas brutalement mais : (a) Sonnet 4.6 est meilleur sur les outputs structurés (Zod-friendly), (b) le pricing est probablement aligné voire mieux, (c) les nouveaux modèles tendent à mieux respecter `cache_control` avec moins de cache misses.

**Plan** :
1. Dans le wrapper R1, ajouter un routing 80/20 (env `ANTHROPIC_MODEL_VARIANT=v4_6_ratio=20`).
2. Capturer pour chaque CR : modèle, latence, tokens, validation Zod réussie au premier coup ou retry.
3. Après 30 CR sur les deux variantes, comparer les métriques. Si Sonnet 4.6 ≥ Sonnet 4 sur qualité ET coût → switch complet.
4. Documenter dans `model-selection.md` (à créer).

Coût : ~1 jour. Bénéfice : pattern réutilisable pour toute future migration (S20+ quand Sonnet 4.7 sortira). Aligne Anya sur le standard de la mémoire organisationnelle Gradient (règle alias `-latest` interdite cross-family — déjà documentée dans `ia.md`).

---

## What Thomas should ask himself

### Q1 — "Le tracking coût mensuel sous-estime-t-il ma vraie facture Anthropic ?"

Réponse factuelle : oui, probablement de 60-80%. Les 3 appels CR du webhook (les plus chers) ne passent pas par `recordAnthropicUsage()`. Action immédiate possible : exporter le dashboard de coût brut depuis console.anthropic.com sur les 30 derniers jours et comparer avec `getMonthlyUsageEur()`. Si écart > 2x → R1 devient prioritaire.

### Q2 — "Suis-je à l'aise avec mes données patrimoniales et celles de mes locataires hébergées chez Anthropic USA ?"

L'éval S15 Kimi/Mistral a écarté la migration sur ROI (< 3) en supposant que Thomas est OK avec Anthropic USA. C'est une hypothèse de confort. Mistral La Plateforme (EU, RGPD-natif) ferait passer le critère #9 de 5/10 à 8/10 pour un surcoût ~0,15 EUR/mois. Décision purement personnelle — l'éval IA ne peut pas la prendre pour Thomas. Si la réponse est "pas vraiment", relancer une éval Mistral avec poids RGPD ×3.

### Q3 — "À partir de combien de workflows Anya doit-elle devenir un orchestrateur de sous-agents plutôt qu'une fonction monolithique ?"

Anya aujourd'hui = 43 modules dans `secretariat/`, ~7700 LOC, 1255 tests. Pattern = `webhook/route.ts` dispatch → handler dédié → LLM call → action. C'est un agent mono-orchestrateur. À 100 modules (estimé S20+ si rythme actuel maintenu), `webhook/route.ts` deviendra ingérable. Critère candidat à fixer dès maintenant : "à partir de X workflows distincts ou Y lignes dans webhook/route.ts, basculer vers pattern orchestrator-workers". Pas urgent S17 mais ne pas découvrir la dette à 200 modules.

---

## Comparaison avec alternatives S15

Conforme aux conclusions S15 (`llm-provider-evaluation-kimi-vs-anthropic.md`, `llm-provider-evaluation-opensource-alternatives.md`) :
- **Kimi écarté** : RGPD bloquant (CN) + qualité FR non démontrée + pas d'équivalent Haiku. Audit confirme.
- **Mistral écarté sur ROI** (0,36-2,16 < 3). Audit nuance : seul le critère #9 conformité (5/10) pourrait basculer la décision si Thomas pondère RGPD au-dessus du ROI brut (cf Q2).
- **Statu quo Anthropic** confirmé sous réserve que R1 (wrapper unifié) soit fait. Sans R1, le statu quo masque une dérive coût invisible.

---

## Handoff

---
**Handoff → @orchestrator**

- **Fichier produit** : `/home/user/ISSA-Capital/docs/ia/anya-audit-s16.md`
- **Note finale** : **7,1/10 — SOLIDE**
- **Top 3 reco S17** : (R1) wrapper Anthropic unifié `src/lib/secretariat/llm/client.ts` migration des 6 call sites avec cache_control + tracking universel — 4h, débloque W1 entier ; (R2) migrer `PROJET_FICHE_FILE_IDS` hardcodé vers vault-reader — 2h, ferme dette R7 ; (R3) archiver les 2-3 fichiers S4 obsolètes de `docs/ia/` et créer un `anya-current-architecture.md` court — 1h.
- **Reco long-terme** : migration progressive Sonnet 4 → Sonnet 4.6 avec A/B testing via le wrapper R1 (~1 jour, aligne Anya sur le standard Gradient interne).
- **Points d'attention bloquants** :
  - W1 = trou prod réel : 3 appels CR du webhook ne sont ni cachés ni trackés. Facture Anthropic réelle probablement 60-80% sous-estimée. Le budget alerte 50 EUR ne se déclenchera jamais à temps.
  - W2 = R7 violée dans le commit `582c85c` (S16) 24h après l'ajout de R7 dans CLAUDE.md. À régulariser rapidement pour ne pas créer le précédent.
  - W3 = ~1620 lignes de docs IA obsolètes dans `docs/ia/` = pollution contexte agents futurs + coût tokens à chaque session.
- **Décision modèle** : statu quo Anthropic Sonnet 4 + Haiku 4.5 confirmé. Migration Mistral conditionnée à arbitrage Thomas sur poids RGPD (Q2).
- **Lessons-learned candidates S17** :
  - **#105 P1** — Quand une règle CLAUDE.md (R7) est ajoutée mid-session, auditer les commits récents de la même session pour rétro-applications nécessaires (cr-writeback.ts mergé après R7 = violation à T+0).
  - **#106 P1** — Tout appel `client.messages.create()` doit passer par un wrapper centralisé qui applique cache_control + recordAnthropicUsage par défaut. Sinon les sites d'appel direct dérivent silencieusement (cf W1 webhook).
---
