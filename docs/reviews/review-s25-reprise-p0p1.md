# Audit critique R13 — Branche `claude/reprise-secretariat-p0` (S25)

**Date** : 2026-05-29
**Auditeur** : @reviewer (Opus 4.7)
**Périmètre** : 3 commits sur `ec672ed..HEAD` — P0 #1 (CR write-back queue+retry), P0 #2 (module cr-reunion), P1 #3 (template-loader async).
**Gate amont** : tsc + lint + build + 2293 tests = VERT (acquis). Cet audit cherche ce qui passe AU TRAVERS du gate.

---

## Verdict

**GO CONDITIONNEL** — aucun bug bloquant pré-clôture détecté sur les 3 commits livrés. Les 3 architectures (store JSONL, validators déterministes, template-loader async) sont solides. **2 findings P1** méritent fix dans le même jalon (alerte Telegram cassée, drift SOT compteur). 4 findings P2 à noter pour suivi.

Le drift SOT `reference-counter` (déjà tracké dans le code) est l'angle mort principal mais n'est PAS introduit par cette session — il est documenté en TODO orchestrateur dans `reference-generator.ts:11-19`.

---

## Top 3 corrections prioritaires (ordre d'attaque)

1. **P1-A** — `cr-writeback.ts:163-179` : alerte Telegram utilise tags HTML (`<b>`, `<code>`) sans `parse_mode`. `sendTelegramMessage` (telegram.ts:38-42) n'envoie JAMAIS `parse_mode`. Résultat live : Thomas voit `&lt;b&gt;CR write-back fiche Projet introuvable&lt;/b&gt;` en texte brut. **Fix 5 min**, déjà signalé dans le brief — confirmé visuellement dans le code.
2. **P1-B** — `reference-counter.ts:20` : compteur stocké sur `/home/runner/issa-data/` (fallback `/tmp/`) — JAMAIS dérivé du vault. Tout redéploiement VPS qui efface `/home/runner/` (ou `/tmp` au reboot) repart à 0 → doublons de référence `IC-CR-2026-0001` après archivage du vrai #1 dans le vault. Registre fiscal « sans trou » menacé. **Pas introduit cette session** (drift connu) mais cette session ajoute une 4e consommateur (cron retry) qui appelle indirectement `getNextReference` via `validateAndPrepareReference` — l'exposition augmente. Fix : dériver le compteur du vault au boot (`max(reference) par (entité, année)`).
3. **P2-A** — `template-loader.ts:144-160` : le fallback n'est PAS caché → si Drive est KO 1h, chaque création de fiche fait un round-trip Drive raté (3 appels API : resolvePath + getAccessToken + readFileById) avant de tomber en fallback. Sous charge (batch enrichment), martelage Drive. Fix : cacher le fallback avec un TTL court (5 min) pour éviter le retry agressif.

---

## P0 — Bloqueurs pré-clôture

**AUCUN.** Le gate vert tient. Les 3 commits sont mergeables en l'état.

(Décision R10 : si je trouve un bloqueur, je l'escalade en tête. Ici, aucun trouvé après audit ciblé des 7 points de vigilance.)

---

## P1 — À corriger même jalon

### P1-A — Alerte Telegram cr-writeback affiche tags HTML littéraux

**Fichier** : `src/lib/secretariat/handlers/cr-writeback.ts:163-179`
**Symptôme** : `sendTelegramMessage(chatId, "⚠️ <b>CR write-back fiche Projet introuvable</b>...")` envoie le texte tel quel. Examen de `src/lib/secretariat/telegram.ts:38-42` :
```ts
const body = JSON.stringify({
  chat_id: chatId,
  text: safeText,
});
```
Aucun `parse_mode` → tags `<b>`, `<code>` rendus littéralement par Telegram. Thomas voit « `<b>CR write-back fiche Projet introuvable</b>` » en texte brut.
**Gravité** : Sérieux — la fonction de cette alerte est de prévenir Thomas qu'une fiche manque, et le message est défiguré sur le plan UX. Pas un crash, juste une dégradation visible.
**Correctif** :
- Option A (locale, 1 ligne) : retirer tous les tags HTML du texte (passer en texte brut ou utiliser des séparateurs visuels `—`, `•`).
- Option B (globale) : ajouter `parse_mode: 'HTML'` dans `sendTelegramMessage` (et propager au cron retry `route.ts:194-203` qui utilise déjà du texte brut → cohérent).
- **Recommandé** : option A, le texte brut suffit. L'alerte abandon dans `cron-cr-writeback-retry/route.ts:194-203` est DÉJÀ en texte brut → cohérence retrouvée.

### P1-B — Drift SOT reference-counter (impact aggravé par cette session)

**Fichier** : `src/lib/secretariat/reference-counter.ts:20-21`
**Symptôme** : `COUNTER_DIR = /home/runner/issa-data` (fallback `/tmp/issa-secretariat`). Sur le VPS Anya actuel (`/home/thomas/ISSA-Capital/`), `/home/runner` n'existe PAS → bascule sur `/tmp/issa-secretariat` qui est **effacé à chaque reboot VPS**. Après reboot, `loadCounters` retourne `{}` → première référence du jour repart à `IC-CR-2026-0001` même si le vault contient déjà 50 CR.
**Confirmation** : `reference-generator.ts:11-19` documente le drift explicitement (« TODO orchestrateur »). Mais aucune mitigation runtime côté code aujourd'hui.
**Gravité** : Risque légal/fiscal (Art. 39-1 CGI exige numérotation continue sans trou ni doublon). Concrètement le risque survient SEULEMENT au prochain reboot VPS (rare, mais arrive : MAJ kernel, panne).
**Impact aggravé par cette session** : avant P0 #1, le compteur n'avait qu'1 point d'appel (webhook). Avec P0 #2, `validateAndPrepareReference` devient un 2e point d'entrée potentiel pour batch/replay futurs. La surface du drift augmente.
**Correctif** :
- Court terme (15 min) : changer `COUNTER_DIR` en `/home/thomas/issa-data` (chemin persistant VPS Anya, non `/home/runner` qui est un héritage Replit).
- Moyen terme : au boot, scanner le vault Drive `_Inbox/CRs/` (ou le dossier des CR par entité) pour dériver `max(sequence)` par `(entité, année)` et hydrater le compteur. À implémenter dans un endpoint `/api/secretariat/cron-counter-rebuild` ou directement dans `loadCounters` lazy au premier appel.
- Garde-fou test : ajouter un test qui mock `/home/runner` absent + `/tmp/issa-secretariat` vide + vérifier qu'une stratégie de fallback existe.

---

## P2 — Suivi (pas bloquant)

### P2-A — template-loader : fallback non caché → martelage Drive si Drive KO

**Fichier** : `src/lib/secretariat/templates/template-loader.ts:144-160`
**Symptôme** : commentaire explicite ligne 152-153 « pas de cache fallback ». Si Drive est down, chaque appel `renderFicheContent` fait 3 calls Drive ratés avant fallback. Sous charge batch (enrichissement contacts 10/min), c'est 30 calls/min vers une API en panne → quotas, latence.
**Gravité** : Faible en nominal, gênant en mode dégradé.
**Correctif** : cacher le fallback avec un TTL court (5 min) : `cache.set(name, { value: fb, expiresAt: Date.now() + 5*60*1000 })`. Le compromis « rester coincé en fallback » évoqué dans le commentaire est résoluble : un TTL 5 min vs 1h. Au pire 5 min de fallback après que Drive est revenu — acceptable.

### P2-B — Race cache template (2 requêtes concurrentes ratent le cache)

**Fichier** : `template-loader.ts:140-161`
**Symptôme** : 2 appels parallèles à `loadTemplate('Contact pro')` qui manquent le cache → 2 round-trips Drive en parallèle → 2 `cache.set` (le 2e gagne). Pas de promise-coalescing.
**Gravité** : Très faible — léger gaspillage I/O, pas de corruption.
**Correctif** (optionnel) : pattern singleflight — stocker `Map<TemplateName, Promise<TemplateStructure>>` pendant le fetch en cours. Pas urgent, à faire si le profile montre l'impact.

### P2-C — Mutex en-process ne protège que dans le même process Next.js

**Fichier** : `cr-writeback-pending.ts:76-91`
**Symptôme** : `currentLock = Promise.resolve()` au module level. Si Next.js spawn plusieurs workers (PM2, cluster mode), chaque worker a SON propre lock → race possible read-modify-write sur le JSONL.
**Vérification** : `deploy/crontab.anya` montre VPS mono-instance (cron + Next.js sur même VPS, un seul `next start`). Pas de pm2 cluster mode détecté → en pratique, mono-process aujourd'hui. **Risque non actif maintenant**, mais à savoir pour le futur (si on passe en cluster mode pour scaler, le mutex saute).
**Gravité** : Nulle aujourd'hui, future.
**Correctif** (à terme) : remplacer le mutex local par un lock distribué (Drive file lock via `appProperties`, ou Redis si on en ajoute un jour). En attendant, ajouter un commentaire AU TOP du fichier précisant l'hypothèse mono-process.

### P2-D — checkSection1Legal : heuristique repas un peu laxiste

**Fichier** : `validators.ts:195-197`
**Symptôme** : le pattern `REPAS_JUSTIF_PATTERN` matche `compte tenu`, `en raison de`, `justifi` (substring de « justification », « justifié »). Un CR qui mentionne « compte tenu de la pluie nous avons reporté » passerait la validation sans réelle justification du format repas. Inverse du faux positif : c'est un faux **négatif** sur la stricte conformité §3.3.
**Gravité** : Faible — la spec §3.3 demande « une justification », pas une formule canonique. Une mention vague (« compte tenu de X ») reste une justification minimale. Le LLM en amont génère normalement du contenu propre.
**Correctif** (optionnel) : durcir en exigeant que la phrase contienne le mot `repas` OU `déjeuner` OU `dîner` à proximité (fenêtre ~50 chars) du motif. Non urgent.

---

## Points de vigilance — résultat par item

| # | Sujet | Verdict | Note |
|---|---|---|---|
| 1 | Mutex pending store / race lecture+écriture | **OK en mono-process** | Mutex `withStateLock` sérialise correctement ; appendPending et removePending ne se chevauchent jamais. Risque inter-process : P2-C. JSONL parsing résilient OK (ligne corrompue → warn + skip). randomUUID collision : probabilité négligeable. PATCH in-place : fallback createPendingFile si fileId null OK (cas première écriture géré via `writePendingAll`). |
| 2 | Cron retry double-alerte | **OK** | Garde-fou `if (entry.attempts >= MAX_ATTEMPTS)` ligne 87-91 traite correctement le cas « process mort entre alerte et removePending » : entrée trouvée au prochain passage avec attempts=3 → `removePending` direct sans rejouer ni ré-alerter. Auth Bearer solide (timing-safe ? non, mais l'attaquant doit deviner le secret entier — acceptable pour endpoint cron). Erreurs 500 vs 200 cohérentes. |
| 3 | Validators CR (regex, RBAC, cohérence) | **OK** | Lookaround latin étendu `À-ÿ` couvre l'alphabet français — choix volontaire pour éviter le piège `\b` qui casse sur les accents. `globalement` dans « globalement » match → mais c'est PRÉCISÉMENT le mot banni (warning, pas blocking). `ISSA Capital` matche `/issa\s*capital/i`, `ISSA` seul ne déclenche pas (conforme spec §6.1 lue strictement). `isDuplicateCr` normalise espaces+casse (suffisant). `checkSection1Legal` heuristique repas : P2-D ci-dessus. |
| 4 | Câblage webhook (validation AVANT référence) | **OK** | `validateCrPayloadDeterministe(pendingDraft.cr)` ligne 2179 → `return Response.json(rejected_by_validator)` ligne 2188 si KO. La génération de référence `generateReferenceCR` ligne 2198 n'est atteinte QUE si validation OK. Pas d'incrément orphelin. Pas de pending résiduel côté write-back (le pending n'est créé que par `writeBackCrToFiche` quand la fiche est introuvable — pas par la validation amont). |
| 5 | template-loader async | **OK avec P2-A/B** | Tous les appelants utilisent `await renderFicheContent` (vérifié : `callback-handler.ts:539`, `callback-handler.ts:1020`, `contact-fiche-synth.ts:195`). Pas de Promise non-awaitée → pas de `[object Promise]` dans le rendu. Parsing frontmatter robuste sur top-level keys, multi-ligne YAML correctement ignoré, `<!--` cut OK pour exclure le bloc d'instructions du template. Frontmatter absent → `[]` proprement. Race cache : P2-B. Martelage Drive : P2-A. |
| 6 | Drift SOT reference-counter | **Confirmé** | Voir P1-B. Drift non introduit par cette session mais surface accrue. Probabilité d'incident à court terme dépend de la fréquence de reboot VPS. |
| 7 | Alerte Telegram tags littéraux | **Confirmé** | Voir P1-A. |

---

## Angles morts / non audités

- **Tests E2E pending store** : je n'ai pas lu les tests unitaires du store. Si pas de test sur le cas « cron retry tombe en cours, attempts incrémenté mais alerte non envoyée » → laisser à @qa de couvrir.
- **Backup du JSONL** : `_Inbox/AnyaState/cr-writeback-pending.jsonl` n'est PAS dans le backup vault VPS (le backup ne couvre que des dossiers vault, à confirmer). Une perte du fichier = perte des pendings en attente. Pas critique (l'alerte Telegram a déjà été envoyée au moment de l'append), mais à noter.
- **Concurrence avec ticktick-sync/state-store** : pattern mutex calqué dessus (ligne 14 du commentaire). Si le mutex de l'un casse, l'autre cassera de la même façon. Pas un risque actif, juste un couplage caché.

---

## Recommandation finale

**GO CONDITIONNEL pour merge** : les 3 commits sont solides et le gate est vert. Fix P1-A (5 min) et P1-B (15 min court terme via chemin `/home/thomas/`) avant la clôture de session — les deux tiennent dans le même jalon sans replanifier. P2 à backloguer.

---

**Handoff → @orchestrator**
- Fichier produit : `docs/reviews/review-s25-reprise-p0p1.md`
- Décisions : GO CONDITIONNEL ; pas de bloqueur P0 ; 2 fix P1 dans la session (alerte Telegram tags littéraux + drift compteur chemin VPS).
- Points d'attention : R10 respecté (rapport = checklist, pas cimetière). R9 partiellement respecté (j'ai lu 6 fichiers en profondeur, pas walkthrough live E2E — pas testable sans Telegram réel). Drift SOT compteur à fixer en 2 temps (chemin VPS immédiat + rebuild depuis vault à planifier).
