# Audit critique PR #70 — WhatsApp bugs S26

**Date** : 2026-05-28
**Branche** : `claude/zen-mendel-2yZ9Z` (HEAD `70372e0`)
**Auditeur** : @reviewer
**Périmètre** : PR #70 fixant les 2 bugs WhatsApp reportés par Thomas (28/05 soir).
**Mode** : audit critique, R13 + #126 + #132 — chercher les trous comme PR #60 (S24, 9 bugs trouvés).

---

## 1. Verdict global

**NO-GO** pour annoncer « bugs WhatsApp 100% corrigés ».

La PR #70 corrige correctement les 4 sites de formatage téléphone touchés (fiche stub, carte no-match, confirm dialog, link audit) et ajoute une instrumentation utile pour le Bug #2. **Mais** :

- **2 trous P0 réels confirmés à la lecture du code** (récidive Bug #1 hors PR + risque de doublon `alias_telephone` casse-pieds en prod).
- **3 trous P1** dont une régression silencieuse sur les fiches polluées S24-S26 et un cas non-FR qui produira du `+33 1 23 45 67 89` faux pour un numéro US.
- **2 trous P2** (cosmétique log, edge case 0 match).

→ Une seule itération de fix (15-30 min) suffit. Voir section 3 « Recommandations actionables ».

---

## 2. Tableau des trous

### Bug #1 — Téléphone sans +33

| # | Sévérité | Description | Fichier:ligne | Fix proposé |
|---|---|---|---|---|
| H1 | **P0** | **Récidive du Bug #1 dans `/pending`** : la commande affiche `(${p.phone})` brut sans `formatPhoneForDisplay`. Si Thomas tape `/pending` ce soir, il revoit `(664850631)` au lieu de `(+33 6 64 85 06 31)` — exactement le bug qu'il a reporté. Pas touché par la PR #70. | `src/app/api/telegram/webhook/route.ts:957` | Importer `formatPhoneForDisplay` et wrapper : `(${formatPhoneForDisplay(p.phone)})`. Pas d'import existant dans ce fichier — l'ajouter. |
| H2 | **P0** | **Risque de doublon `alias_telephone`** : `addToFrontmatterList` (frontmatter.ts:306-331) déduplique par comparaison **textuelle** (`entryVal.toLowerCase() === normalizedNew.toLowerCase()`). Les fiches créées S24-S26 ont déjà `alias_telephone: 664850631` (ancien format 9 chiffres bruts). Si la même personne re-clic « Lier » avec le nouveau code, on ajoute `+33 6 64 85 06 31` SANS détecter le doublon → 2 entrées équivalentes pour le même numéro. | `src/lib/secretariat/vault-client/frontmatter.ts:306-331` + `src/lib/secretariat/telegram-validation/callback-handler.ts:1220-1226` | Option A (court terme) : avant `addToFrontmatterList`, parser le frontmatter et boucler sur les entrées existantes avec `normalizePhone` pour détecter un doublon par hash 9-chiffres → si présent, no-op. Option B (long terme) : ajouter un paramètre `normalize?: (v: string) => string` à `addToFrontmatterList` et l'utiliser pour la dédup. |
| H3 | **P1** | **Numéro non-FR mal formaté** : `chatPhone()` extrait les 9 derniers chiffres de TOUT chatId DM (`@s.whatsapp.net`). Pour un numéro US (`+1 415 555 1234` → `15554154151234` → 9 derniers = `541551234`), `formatPhoneForDisplay` colle `+33 5 41 55 12 34` — **téléphone faux et pollution vault**. La carte affiche le mauvais pays, la fiche aussi. | `whatsapp-ingest-runner.ts:80-84` (normalize) + `:99-104` (format) | Détecter le préfixe pays dans `chatPhone` : si les digits commencent par autre chose que `33` ou si total > 11, garder le `+` original ou marquer comme `non-FR`. Au minimum : si total digits != 11 (préfixe `33` + 9), renvoyer la chaîne brute préfixée d'un `+`. |
| H4 | **P1** | **Régression silencieuse sur fiches S24-S26** : les fiches WhatsApp créées entre S24 et S26 ont `telephone: 664850631` (9 chiffres bruts) dans le frontmatter et `## Historique` peut référencer le même. Aucun job de migration n'est prévu dans la PR #70. Tant qu'elles ne sont pas re-touchées (et même là, `appendToHistorique` ne touche pas le frontmatter), le champ reste mal formaté → Obsidian/wikilinks intacts mais affichage `tel:` cassé sur mobile. | Vault (pas dans le code) | Script one-shot : lire tous les `.md` des dossiers contacts, si `telephone:` matche `/^\d{9}$/`, remplacer par `+33 X XX XX XX XX`. Audit avant écriture (compter combien de fiches affectées). |
| H5 | **P2** | **Double formatage possible** : `formatPhoneForDisplay('+33 6 64 85 06 31')` → digits = `33664850631` (11), `length !== 9` → renvoie l'entrée tel quelle. OK. Mais `formatPhoneForDisplay('33664850631')` (sans `+`) → 11 chiffres → renvoyé brut, pas formaté. Pas critique vu les call sites actuels (tous passent du `phone` 9-chiffres normalisé), mais piège pour le futur. | `whatsapp-ingest-runner.ts:99-104` | Ajouter une normalisation interne : si `d.length === 11 && d.startsWith('33')`, prendre les 9 derniers et re-formater. |

### Bug #2 — Instrumentation logging

| # | Sévérité | Description | Fichier:ligne | Fix proposé |
|---|---|---|---|---|
| I1 | **P1** | **Compteur `chatsSkippedAlreadyMatched` faussé sur match email-only** : ligne 459, le compteur s'incrémente quand `enrichedContact === true`, qu'il vienne du match téléphone OU email. Mais le bloc `} else if (!group.chatId.endsWith('@s.whatsapp.net')) {` ligne 461 ne se déclenche jamais si `enrichedContact` est déjà true. Un chat **groupe** (`@g.us`) enrichi via email LLM compte donc en `skip:matched` au lieu de `skip:group`. Mineur mais brouille le diag du Bug #2. | `whatsapp-ingest-runner.ts:458-469` | Inverser l'ordre : tester d'abord `!isDM` (skip:group), puis `enrichedContact` (skip:matched), puis empty summary. Ou enrichir les compteurs (un chat groupe enrichi par email = `skip:group` + flag). |
| I2 | **P1** | **Log par chat manqué en cas d'erreur précoce dans `extractChat`** : le `try` (ligne 408) englobe tout sauf la ligne 410 `chatPhone()`. Si `chatPhone()` throw (peu probable), aucun log par chat. **Plus grave** : le `console.warn` dans `extractChat` (ligne 267) sur LLM échec renvoie `empty` qui passe par `!ex.relevant → continue` ligne 422 → le compteur skip:not-relevant est gonflé par les chats où le LLM a échoué (pas vraiment "non pertinents"). Thomas ne voit pas la différence dans la ventilation. | `whatsapp-ingest-runner.ts:267-272` (extractChat) + `:419-423` (continue) | Ajouter un compteur `chatsSkippedLlmError` ou taguer dans le log par chat `card=skip:llm-error` quand `extractChat` a renvoyé l'objet vide à cause d'une exception (le helper devrait propager un flag `extractFailed: true`). |
| I3 | **P1** | **Chat DM avec 4+ homonymes** : ligne 470 `if (!enrichedContact && DM && summary)`, on envoie la carte avec `existingMatchHints` capé à 3 (`.slice(0, 3)` ligne 476). Si 4+ matches, `existingMatchHints.length` reste ≤ 3 mais le warning de la carte (whatsapp-no-match-card.ts:115) dit `${hints.length} homonymes existent` qui est faux (en réalité on en a au moins 4). Et **aucun bouton Lier n'est affiché** (`hints.length <= 3` ligne 137 est trivialement vrai sur `slice(0,3)`). Conséquence : Thomas voit 3 noms, doit skipper. Le compteur `chatsSkippedAlreadyMatched` n'incrémente PAS (correct). Bug est cosmétique. | `whatsapp-ingest-runner.ts:476` + `whatsapp-no-match-card.ts:113-117` | Stocker le `total` réel avant slice et l'afficher dans le warning : "X homonymes (top 3 affichés)". |
| I4 | **P2** | **`chatsSkippedAlreadyMatched++` pour les chats matchés par EMAIL sur DM** : si `enrichedContact = true` via email (ligne 442) et que le chat est un DM, on l'incrémente en `skip:matched`. Sémantique OK mais le log par chat ligne 572 dit `matched=email` alors que le compteur dit `matched`. Le `matchedStr` dépend uniquement de `byPhone.get(phoneStr)` qui ne sait pas que le match a été fait par email. Source de confusion dans le diag. | `whatsapp-ingest-runner.ts:570-577` | Tracker `matchedBy: 'phone' \| 'email' \| 'none'` et l'afficher dans le log. |

### Trous génériques (style PR #60 S24)

| # | Sévérité | Description | Fichier:ligne | Fix proposé |
|---|---|---|---|---|
| G1 | **P2** | **Race save → send → re-save** : confirmé corrigé S24 (`whatsapp-ingest-runner.ts:505-510`, ordre `send` puis `save` une fois). PASS, mention pour traçabilité. | n/a | RAS. |
| G2 | **P2** | **Cron 4×/jour à 7h20, 12h20, 17h20, 21h20** (`deploy/crontab.anya:26`) : Thomas doit attendre 3-6h entre tests. Pour la session « 2-3 crons puis analyser », l'analyse ne peut commencer qu'après 12h20 ou 17h20 demain. **Important pour le timing utilisateur**. | `deploy/crontab.anya:26` | Optionnel : ajouter un cron temporaire toutes les heures pendant 24h pour valider — ou plus simple, Thomas peut hit manuellement `/api/secretariat/cron-whatsapp-ingest` quand il veut. |
| G3 | **P2** | **Logs verbose console.warn** : les 2 nouveaux logs (par chat + ventilation cartes) écrivent à chaque run dans `/home/thomas/anya-cron.log`. Avec 50-100 chats/run × 4 runs/jour = 200-400 lignes/jour supplémentaires. Pas de rotation visible côté repo. À surveiller à 2-3 jours. | `whatsapp-ingest-runner.ts:573-577, 588-593` | Si trop verbose, gater derrière `process.env.WHATSAPP_VERBOSE` à `false` après stabilisation. Ou laisser tel quel le temps de l'enquête puis nettoyer. |

---

## 3. Recommandations actionables — AVANT de marquer « bugs WhatsApp 100% corrigés »

Par ordre de priorité décroissante :

1. **[H1, P0]** Patcher `src/app/api/telegram/webhook/route.ts:957` pour utiliser `formatPhoneForDisplay(p.phone)`. ~5 min. Sans ça, `/pending` réaffichera des numéros bruts → Thomas reverra le Bug #1 dès qu'il tape la commande.

2. **[H2, P0]** Patcher `addToFrontmatterList` ou `handleWhatsappNoMatchLink` pour déduper `alias_telephone` par hash normalisé (9 chiffres) au lieu de chaîne textuelle. Sinon, dès qu'un re-clic « Lier » arrive sur une fiche S24-S26 polluée, on double l'entrée. Bonus : tester en unit. ~15-20 min.

3. **[H4, P1]** Préparer un script one-shot de migration des fiches WhatsApp créées S24-S26 (telephone brut → format `+33 X XX XX XX XX`). Pas dans la PR #70 elle-même, mais un fichier `scripts/migrate-whatsapp-phones.ts` ou doc dans `REPLIT_ACTIONS.md`. Sinon les fiches restent dégueulasses tant que personne ne les ré-édite. ~20-30 min (incluant audit lecture des fiches existantes via MCP Drive).

4. **[H3, P1]** Garder `+` au lieu de forcer `+33` quand les digits ne matchent pas un mobile/fixe FR à 11 chiffres préfixés `33`. ~10 min, gardé safe.

5. **[I1, I2, P1]** Inverser l'ordre des conditions ventilation (`!isDM` AVANT `enrichedContact`) ET ajouter un compteur `chatsSkippedLlmError` (taguer quand `extractChat` retourne empty par exception). Sinon le diag du Bug #2 sera lui-même biaisé. ~10 min.

6. **[I3, I4, P1-P2]** Cosmétique log + warning « 4 homonymes » plutôt que « 3 ». ~5 min.

7. **Test E2E manuel** : avec Thomas, après merge des fixes ci-dessus :
   - Envoyer un msg WA depuis un numéro inconnu (perso ou bot) → attendre cron → vérifier carte (`+33 …`).
   - Cliquer Pro → vérifier fiche Drive (`telephone: +33 …` dans frontmatter).
   - Re-cliquer « Lier » sur une vieille fiche polluée 9 chiffres → vérifier qu'aucun doublon n'est créé.
   - Taper `/pending` → vérifier l'affichage formaté.

Si ces 7 actions sont OK → alors la PR #70 peut être annoncée « bugs WhatsApp corrigés ».

**Au minimum H1 + H2 doivent passer avant tout commit final** — ce sont des récidives ou des régressions silencieuses, les pires types selon les leçons #126 + #132.

---

## 4. Hors scope WhatsApp — autres trous repérés en chemin

Aucun trou critique repéré hors WhatsApp. Le scan rapide a montré :
- Le helper `addToFrontmatterList` (Bug H2) impacte aussi `alias_email` côté no-match email. Même classe de bug : si une fiche email a `alias_email: foo@bar.com` (lowercase, pas de quote) et que la PR ajoute `Foo@Bar.com` (maj différente), la dédup `.toLowerCase()` joue déjà (déjà géré ligne 306+330). OK pour email. Pour téléphone, la racine du problème est la normalisation insuffisante (texte vs digits) — voir H2 fix.
- Le guard transverse voice/photo en reply à carte no-match est en place et couvre les deux types (email + WhatsApp), Q12 PASS.
- `/pending` exécute deux Drive reads en parallèle (`Promise.all`) — pas de race, le store Drive est protégé par mutex implicite (lecture R/O, écritures sérialisées via savePending).

---

## 5. Méthodologie d'audit

Outils utilisés : Read ciblé (8 fichiers) + Grep ciblé (6 patterns) + lecture transverse webhook + crontab. Aucun test exécuté côté audit — Thomas devra lancer `npm test src/lib/secretariat/whatsapp-ingest` + `npm test src/lib/secretariat/telegram-validation` après les fixes pour confirmer.

Périmètre couvert :
- ✅ Code modifié par la PR #70 (5 fichiers + 2 tests)
- ✅ Helper `addToFrontmatterList` (red line YAML flow-style + dédup)
- ✅ Détection homonyme `existingMatchHints`
- ✅ Pending store WhatsApp (TTL, race save→send, listActive)
- ✅ Commande `/pending` (T13 → trouve H1)
- ✅ Guard transverse voice/photo (Q12 PASS)
- ✅ Cron WhatsApp fréquence (Q14 PASS, doc)
- ⚠️ Walkthrough utilisateur réel non exécuté (pas de prod accessible depuis l'audit) — recommandé après fixes.

---

**Handoff → @orchestrator (Thomas)**

- **Fichiers produits** : `docs/audit-whatsapp-s26.md`
- **Décisions prises** : NO-GO pour « 100% corrigé », 2 P0 réels (H1 récidive `/pending`, H2 doublon alias_telephone) + 5 trous P1-P2.
- **Points d'attention** :
  - H1 (`/pending` bug exact identique à celui de Thomas) — 5 min à patcher, à FAIRE en premier.
  - H2 (race doublon `alias_telephone` sur fiches polluées S24-S26) — corruption silencieuse possible si Thomas re-clic « Lier » sur un vieux contact.
  - H4 (fiches S24-S26 polluées en vault) — pas dans le code, mais à scripter pour nettoyage.
- **Agents à réinvoquer** : @fullstack pour les fix H1 + H2 + I1/I2 (~30 min), @qa pour ajouter 2-3 tests régression (`addToFrontmatterList` dédup phone normalisée + `/pending` formate phone).
