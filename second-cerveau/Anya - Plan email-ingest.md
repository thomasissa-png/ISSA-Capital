---
type: outil
nom: Anya — Plan d'implémentation email-ingest
date_mise_a_jour: 2026-05-12
statut: à implémenter
tags:
  - outils
  - ia
  - bot
  - automatisation
  - email
  - plan
---

# Anya — Plan d'implémentation email-ingest

> Document destiné au dev (humain ou agent) qui code l'extension. Source de vérité juridique/métier : voir [[Anya]] et la spec GitHub `docs/ia/anya-spec.md`. À transformer en spec officielle (`docs/ia/email-ingest-spec.md`) une fois validé.

## 0. Contexte et objectif

Anya tourne aujourd'hui en mode pull (Thomas écrit à Anya). On ajoute un mode push : Anya va elle-même chercher les nouveaux emails (Gmail + Outlook), les classifie, met à jour le vault Obsidian, et soumet chaque action à validation Telegram.

**Phase 1** : ingestion + classification + MAJ vault (avec audit trail JSON). Sections 0 à 8.
**Phase 2** : drafts de réponse calibrés sur la tonalité du contact (Sonnet 4.6). Section 11 ci-dessous, à attaquer dès que la phase 1 est stable.

Les deux phases sont dans ce plan (même architecture, même service Anya), exécutées séquentiellement.

## 1. Décisions actées (Thomas, 2026-05-12)

| Décision | Choix |
|---|---|
| Modèle | Haiku 4.5 pour triage, Sonnet 4.6 pour enrichissement |
| Déclenchement | Polling toutes les 5 min (Replit cron) |
| Périmètre P1 | Locataires, contacts pro, apporteurs d'affaires off-market |
| Validation | **Tout passe par Telegram avant écriture vault** (zéro auto silencieuse) |
| Marqueur traité | Label Gmail `Anya/traité` + catégorie Outlook équivalente |
| No-match contact | `05. Notes/A classifier/` + ping Telegram, pas de fiche stub auto |
| Architecture écriture vault | **A — Anya écrit direct via API Drive** (un seul service Replit, vault-client minimaliste, pas de daemon local) |
| Audit trail | Logs JSONL dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` — chaque opération vault loggée avant exécution |
| Drafts de réponse | **Inclus en phase 2** dans ce même plan, exécutés après validation phase 1 |
| Budget cible | <60€/an total (phase 1 + phase 2 cumulées) |

## 2. Architecture cible

Trois couches, isolées et testables séparément.

### Couche 1 — Sources email

```
src/lib/secretariat/email-sources/
├── types.ts            # interface EmailSource + EmailMessage normalisé
├── gmail-source.ts     # OAuth Gmail (refresh token) + listMessages + getMessage + addLabel
├── outlook-source.ts   # MSAL + Graph API + categories
└── source-registry.ts  # registre des sources actives
```

`EmailMessage` normalisé (à utiliser partout en aval) :

```typescript
interface EmailMessage {
  source: 'gmail' | 'outlook'
  id: string                    // thread_id Gmail ou message id Graph
  from: { email: string; name?: string }
  to: { email: string; name?: string }[]
  cc: { email: string; name?: string }[]
  subject: string
  bodyPlain: string             // texte brut, HTML stripé
  receivedAt: Date
  attachments: Array<{ name: string; mimeType: string; sizeBytes: number; id: string }>
  threadHistory?: EmailMessage[] // les messages précédents du thread, si dispo
  rawRef: string                // pour audit (link Gmail/Outlook web)
}
```

### Couche 2 — Vault client (critique, à factoriser proprement)

```
src/lib/secretariat/vault-client/
├── vault-paths.ts      # constantes : CONTACTS_LOCATAIRES_ACTUELS, CONTACTS_PRO, etc.
├── drive-resolver.ts   # path logique → fileId Drive (+ cache)
├── obsidian-file.ts    # read/write d'un .md via Drive API (préserve UTF-8 réels)
├── frontmatter.ts      # parse + serialize YAML frontmatter (préserve ordre clés)
├── markdown-append.ts  # append à une section H2 sans casser le reste
├── audit-log.ts        # log JSONL dans _Inbox/AnyaLogs/ (avant chaque write)
└── index.ts            # API publique : findContactByEmail, appendToHistorique, ...
```

**Audit trail** : avant chaque écriture, append d'une ligne JSON dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl`. Format :

```json
{"ts":"2026-05-12T14:32:11Z","op":"append_historique","target":"07. Contacts/05. Locataires/01. Actuels/Kenan Beguigneau.md","trigger":"gmail_thread_19xx","payload":{"section":"### 2026-05-12 — Demande quittance avril","content":"..."},"status":"success"}
```

Cas d'usage : audit, debug, possibilité de rejouer ou rollback manuel si bug détecté. Rotation 90 jours (anciens logs archivés dans `_Inbox/AnyaLogs/_archive/`).

**Points de vigilance vault-client** :
- Le frontmatter doit être préservé caractère pour caractère sauf modifications explicites. Pas de re-sérialisation aveugle (YAML libs réordonnent les clés).
- Append à `## Historique` doit insérer la nouvelle section AVANT les sections datées existantes (ordre chrono inverse), pas à la fin du fichier.
- UTF-8 réels (`é`, `à`) — jamais d'échappement `é`.
- Cache des fileIds Drive (Map<path, fileId>) avec TTL 1h, invalidé en cas d'erreur 404.
- Locks d'écriture : si deux handlers veulent modifier la même fiche en parallèle, sérialiser (queue par path).

### Couche 3 — Triage + handlers

```
src/lib/secretariat/email-ingest/
├── poller.ts           # cron job, orchestre source → triage → handler
├── triage.ts           # appel Haiku, retourne TriageResult
├── intent-router.ts    # dispatch TriageResult → handler
└── handlers/
    ├── locataire.ts    # MAJ fiche locataire + flag quittance/incident/etc.
    ├── contact-pro.ts  # MAJ Historique + date_derniere_interaction
    ├── apporteur.ts    # création fiche bien stub si nouveau deal
    └── a-classifier.ts # no-match → dépose dans A classifier/ + ping
```

`TriageResult` retourné par Haiku :

```typescript
interface TriageResult {
  category: 'locataire' | 'pro' | 'apporteur' | 'newsletter' | 'autre'
  intent: string              // ex: "demande_quittance_mai", "incident_chauffe_eau", "proposition_bien"
  contactEmail: string        // l'email à matcher (sender principal)
  confidence: number          // 0-1
  summary: string             // 1-2 phrases factuelles
  suggestedActions: Array<{
    type: 'append_historique' | 'update_frontmatter' | 'create_bien_stub' | 'add_todo' | 'a_classifier'
    target?: string           // path vault si applicable
    payload: Record<string, unknown>
  }>
}
```

### Couche 4 — Telegram validation UI

```
src/lib/secretariat/email-ingest/
├── telegram-cards.ts   # construit les messages Telegram avec InlineKeyboard
└── callback-handler.ts # traite [Oui] / [Non] / [Voir email]
```

Format type d'une carte Telegram (texte) :

```
📧 Kenan Beguigneau — Locataire (Bd Seine)
Intent : demande quittance avril
Confiance : 92%

Résumé : Kenan demande la quittance d'avril 2026, mentionne
qu'il a fait le virement le 2 mai.

Actions proposées :
✓ Ajouter une entrée Historique sur la fiche
✓ Update date_derniere_interaction → 2026-05-12
→ Workflow quittance (option) ?

[ Valider ] [ Modifier ] [ Voir email ] [ Skip ]
```

## 3. Plan en jalons

Chaque jalon est livrable indépendamment et testable end-to-end avant de passer au suivant. Pas de big bang.

### Jalon 0 — Setup (0,5 jour)

- Branch git `feature/email-ingest` dans `thomasissa-png/ISSA-Capital`
- Ajouter env vars Replit (cf. §5)
- Activer Gmail API + Outlook Graph côté Google Cloud / Azure AD, scopes minimum (`gmail.readonly` + `gmail.labels` + `Mail.Read` + `Mail.ReadWrite` pour catégories)
- Créer le label Gmail `Anya/traité` et la catégorie Outlook équivalente manuellement (1 fois)

**Critère de réussite** : `npm run dev` démarre sans erreur, env vars chargées.

### Jalon 1 — Vault client (2-3 jours, le plus critique)

Implémenter `vault-client/` complet avec tests Vitest exhaustifs (couverture cible 95%).

**Fichiers à créer** :
- `vault-paths.ts` (constantes statiques, trivial)
- `drive-resolver.ts` avec cache
- `obsidian-file.ts` read/write
- `frontmatter.ts` parser + serializer (utiliser `gray-matter` mais wrapper pour préserver l'ordre)
- `markdown-append.ts` insertion section H2 ordonnée chrono inverse

**Tests obligatoires** :
- Parse + re-serialize de chaque template (`Templates/*.md`) → bit-identique
- Append d'une section `### 2026-05-12 — Test` sur la fiche Kenan → insertion avant `### 2026-05-06`, frontmatter préservé
- Modification d'un champ frontmatter (`date_derniere_interaction`) → autres champs intacts, ordre intact
- Recherche fiche par email : `kbeguigneau@gmail.com` → Kenan, `kenanbe@gmail.com` (alias) → Kenan aussi
- Test conflict : deux writes simultanés sur Kenan → un seul write final propre

**Critère de réussite** : 30+ tests verts, lecture/écriture d'une fiche locataire prouvée bit-parfaite sur la sauvegarde.

### Jalon 2 — Source Gmail (1 jour)

`gmail-source.ts` :
- Liste les messages avec `q='-label:Anya/traité is:inbox newer_than:7d'`
- Pour chaque message non traité, fetch détail + normalise en `EmailMessage`
- Méthode `markProcessed(messageId)` qui pose le label `Anya/traité`
- Méthode `markFailed(messageId)` qui pose le label `Anya/à-revoir`

**Tests** : mock Gmail API + assert que le pipeline retourne 3 emails normalisés sur un fixture de 5 (2 déjà labellisés).

**Critère de réussite** : lancement manuel `npm run ingest:gmail --dry-run` liste les nouveaux emails sans rien modifier.

### Jalon 3 — Triage Haiku (1 jour)

`triage.ts` :
- Prompt système versionné (`prompts/triage-v1.md`) qui contient :
  - Les catégories possibles + définitions
  - La structure JSON de sortie attendue
  - Les red lines (zéro invention, confidence honest)
- Appel Haiku avec response_format JSON
- Validation Zod du retour
- Retry x1 si JSON invalide

**Prompt à rédiger spécifiquement** :
- Liste des locataires (extraite des fiches `01. Actuels/`) injectée comme contexte
- Liste des contacts pro principaux (Martin Yhuel, Carl, Maxime, Mathias Dubot, etc.)
- Anti-pattern : ne jamais classer en "locataire" si l'email vient d'un domaine pro (`@pnmavocats.law` → pro, pas locataire)

**Tests** : 20 emails fixtures (anonymisés) avec verdict attendu → matrice de confusion. Cible : 90%+ d'accuracy sur catégorie, 80% sur intent.

**Critère de réussite** : matrice de confusion documentée dans `tests/fixtures/triage-eval.md`.

### Jalon 4 — Handlers + Telegram UI (2 jours)

Implémenter dans cet ordre :
1. `handlers/a-classifier.ts` (le plus simple, fait juste un append dans `05. Notes/A classifier/<YYYY-MM-DD - sujet>.md`)
2. `handlers/contact-pro.ts` (append Historique + update date)
3. `handlers/locataire.ts` (idem + détection intent quittance → délégué au workflow existant phase 2)
4. `handlers/apporteur.ts` (création fiche bien stub dans `02. Projets/...`)

Chaque handler retourne `Array<ActionProposal>`, jamais `void`. La validation Telegram applique les actions seulement après clic "Valider".

**Telegram UI** :
- `telegram-cards.ts` : sérialise un `TriageResult` + handlers proposés en message Telegram + inline keyboard
- `callback-handler.ts` : traite les callbacks `valider:<msgId>`, `skip:<msgId>`, `voir:<msgId>` (renvoie le mail brut), `modifier:<msgId>` (entre en workflow modification)
- Stockage temporaire des `TriageResult` en attente de validation : JSON file `secretariat/pending-validations.json` (TTL 24h)

**Critère de réussite** : un email locataire test → carte Telegram reçue → clic "Valider" → fiche locataire mise à jour vérifiée manuellement.

### Jalon 5 — Source Outlook (1 jour)

Calqué sur Gmail mais via MSAL + Graph API. Catégories Outlook au lieu de labels.

**Critère de réussite** : pipeline identique fonctionnel sur Outlook.

### Jalon 6 — Polling cron + monitoring (0,5 jour)

- Cron Replit toutes les 5 min
- Logger structuré (JSON) qui écrit dans `secretariat/logs/email-ingest-YYYY-MM-DD.jsonl`
- Notification Telegram en cas d'échec (avec stack trace tronquée)
- Endpoint `/api/secretariat/email-ingest/status` qui retourne dernières runs

**Critère de réussite** : 24h en prod sans crash, au moins 5 emails traités correctement.

## 4. Total estimé

**8-9 jours dev** pour un dev qui connaît le repo Anya. Jalon 1 (vault client) est le plus risqué, ne pas le sous-estimer.

## 5. Variables d'environnement à ajouter

```
# Gmail (déjà partiellement existants)
GMAIL_USER_EMAIL=thomas.issa@gmail.com
GMAIL_LABEL_TRAITE=Anya/traité
GMAIL_LABEL_A_REVOIR=Anya/à-revoir

# Outlook
OUTLOOK_TENANT_ID=...
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
OUTLOOK_USER_EMAIL=...
OUTLOOK_REFRESH_TOKEN=...
OUTLOOK_CATEGORY_TRAITE=AnyaTraite

# Email-ingest
EMAIL_INGEST_ENABLED=true
EMAIL_INGEST_INTERVAL_MIN=5
EMAIL_INGEST_LOOKBACK_DAYS=7
EMAIL_INGEST_DRY_RUN=false   # true pour tests
```

## 6. Coûts détaillés

À 200 emails/mois (estimation conservatrice, à ajuster après J+30) :
- **Haiku 4.5** ($1/$5 par MTok) — triage ~500 tokens in + 100 out par email = $0.0007/email × 200 = **$0.14/mois**
- **Sonnet 4.6** ($3/$15) — uniquement si on enrichit l'historique avec un résumé (optionnel P1), ~2k in + 200 out = $0.009/email. Si 50% des emails : **$0.90/mois**
- **Replit** : déjà payé pour Anya, coût marginal nul
- **Total estimé** : **~12-14€/an** en complément des 12€/an actuels

Alerte budget à câbler dans le code : si dépense mensuelle > 5€, ping Telegram + désactivation temporaire.

## 7. Risques et points d'attention

| Risque | Mitigation |
|---|---|
| Vault client casse silencieusement une fiche existante | Tests bit-parfaits sur tous les templates (jalon 1). Backup quotidien du vault avant chaque MAJ (déjà fait via Drive) |
| Haiku classe mal un email pro en locataire | Validation Telegram obligatoire (décision Thomas), donc erreur visible avant écriture |
| Token OAuth Gmail expire | Refresh token (déjà géré pour Anya CR) + monitoring expiry < 7j |
| Bug fait 200 MAJ en boucle sur même fiche | Lock d'écriture par path (jalon 1) + dédup par thread_id (Gmail) / internetMessageId (Outlook) |
| Coût LLM explose (spam, mailing list) | Heuristique pré-Haiku : skip si sender domaine = liste connue (newsletter, no-reply, mailer-daemon). Alerte budget à 5€/mois. |
| Fiche contact mise à jour pendant que Thomas l'édite dans Obsidian | Conflict de write sur Drive : Drive gère via revisions, mais Thomas peut perdre des modifs locales. Mitigation : MAJ vault toutes ≤ 1 fois par 5 min par fiche, fenêtre de battement |

## 8. Anti-patterns à éviter (red lines Thomas)

- **Pas d'invention.** Si Haiku n'identifie pas avec confiance ≥ 0.7 → ne pas auto-proposer d'action, dépose en `A classifier/`.
- **Pas de remplacement silencieux.** Toute MAJ est un append ou un patch ciblé d'un champ frontmatter, jamais un overwrite de section existante.
- **Pas de fallback automatique.** Si Drive API échoue → erreur visible Telegram, pas de retry silencieux.
- **Pas d'envoi auto d'email.** Ce plan ne crée jamais de draft Gmail/Outlook en phase 1. Phase 2 créera des drafts, jamais des envois.

## 9. Checklist dev (à cocher avant chaque commit)

- [ ] Tests Vitest passent (`npm test`, 100% des nouveaux tests verts)
- [ ] `tsc --noEmit` sans erreur (strict mode)
- [ ] `npm run lint` clean
- [ ] Pas de credential en clair (red line P0 #6)
- [ ] Si modification du vault-client : tests bit-parfaits relancés sur 3+ fiches existantes
- [ ] Si modification du prompt triage : `prompts/triage-vN.md` créé (versionné, pas écrasé)
- [ ] Telegram dry-run testé : carte affichée correctement avant déploiement

## 10. Phase 2 — Drafts de réponse

À attaquer dès que la phase 1 est stable (au moins 30 jours en prod, taux de classification > 90%, zéro régression vault).

### Vision

Quand un email entre, Anya prépare un **brouillon de réponse** dans la voix de Thomas, calibré sur le destinataire et l'historique du thread. Le draft atterrit dans Gmail/Outlook en mode brouillon (jamais d'envoi auto — red line P0). Telegram affiche une preview, Thomas valide ou corrige.

### Architecture (réutilise les couches phase 1)

```
src/lib/secretariat/email-ingest/
├── handlers/
│   ├── locataire.ts        # phase 1 — ajoute appel à reply-drafter
│   ├── contact-pro.ts      # idem
│   └── apporteur.ts        # idem
├── reply-drafter/
│   ├── prompt-builder.ts   # construit le contexte (voice + brand + contact + thread)
│   ├── sonnet-call.ts      # appel Sonnet 4.6 + validation Zod
│   ├── gmail-drafter.ts    # crée draft via Gmail API (users.drafts.create)
│   └── outlook-drafter.ts  # crée draft via Graph (messages/{id}/createReply)
└── prompts/
    └── reply-v1.md         # prompt système versionné
```

### Contexte injecté à chaque draft (~3-5k tokens)

1. Extrait de `01. Profil/voice-preferences.md` — section "La voix de Thomas" + "Comment Claude doit répondre" (figé)
2. Extrait de `01. Profil/red-lines.md` — points P2 anti-patterns rédactionnels
3. Extrait de `01. Profil/content-templates.md` — section "Emails business" + tableau sous-registres
4. Fiche du contact — frontmatter + sections "Tonalité de communication" + "Notes"
5. Les 3 derniers messages du thread (texte brut + auteur + date)
6. L'email auquel répondre (corps + sujet)
7. L'intent détecté par Haiku au triage (réutilisé)

Output Sonnet : JSON structuré `{ subject, body, register, confidence, warnings }`. Le champ `warnings` flagge les red lines potentielles détectées par Sonnet lui-même.

### Validation Telegram

```
✏️ Brouillon prêt — Réponse à Kenan Beguigneau
Registre : locataire (tu, amical)

Objet : Re: Quittance avril

> Hello Kenan,
>
> Je te la prépare et je te l'envoie dans la journée.
> Tu confirmes que c'est bien la même adresse de
> facturation que d'habitude ?
>
> Thomas

[ Créer le draft Gmail ] [ Modifier ] [ Skip ]
```

Mode "Modifier" : Thomas envoie un correctif texte ("trop direct, ajoute une phrase sur les travaux") → Sonnet régénère.

### Red lines spécifiques phase 2

- **Jamais d'envoi auto.** Brouillon Gmail/Outlook uniquement.
- **Pas d'invention.** Si Sonnet manque d'info (date, montant, nom), il pose la question dans le draft sous forme `[À CONFIRMER : ...]` plutôt que d'inventer.
- **Auto-audit obligatoire.** Sonnet score le draft sur 3 axes (Thomas validerait /10, qualité rédactionnelle /10, pertinence destinataire /10). Si un axe < 8 → ne crée pas le draft Gmail, renvoie une suggestion Telegram avec score visible.
- **Conformité voix.** Anti-patterns détectés (red-lines #20-25) → flag dans warnings, ne bloque pas mais visible.

### Jalons additionnels (~3-4 jours)

**Jalon 7 — Prompt builder et fixtures (1j)**
- `prompt-builder.ts` qui agrège les 7 éléments de contexte
- `prompts/reply-v1.md` rédigé (versionné)
- 10 fixtures emails variés (locataire amical, avocat formel, apporteur off-market, investisseur, fournisseur, etc.) avec drafts de référence rédigés par Thomas
- Test : drafts générés ≥ 8/10 sur l'auto-évaluation Sonnet pour 8/10 fixtures

**Jalon 8 — Intégration Gmail/Outlook drafts (1j)**
- `gmail-drafter.ts` via `users.drafts.create`
- `outlook-drafter.ts` via Graph `createReply` + update body
- Pièces jointes : Anya ne ré-attache pas — Thomas le fait à l'envoi si pertinent

**Jalon 9 — Telegram preview + mode modifier (0,5j)**
- Carte preview + boutons
- Mode "Modifier" : conversation correctif ↔ régénération

**Jalon 10 — Eval terrain et tuning (1j)**
- 50 emails réels traités en dry-run (drafts générés, pas créés dans Gmail)
- Thomas note chaque draft sur 10
- Identifier patterns d'échec, ajuster prompt, itérer jusqu'à score moyen ≥ 8.5/10

### Coût phase 2

À 100 drafts/mois (50% des emails P1 méritent un draft) :
- Sonnet 4.6 : ~3-5k tokens in + ~500 out par draft = ~$0.024/draft
- Total : **~$2.50/mois soit ~30€/an additionnels**
- Cumul phase 1 + phase 2 : **~45-55€/an**, dans l'enveloppe cible <60€/an

### Pré-requis avant de lancer phase 2

1. Phase 1 en prod ≥ 30 jours
2. Taux de classification Haiku ≥ 90% catégorie, ≥ 80% intent (mesuré sur logs réels)
3. Zéro régression vault détectée (aucune fiche corrompue, frontmatter intact sur audit aléatoire)
4. Thomas a rédigé manuellement ≥ 10 fixtures emails de référence

## 11. Liens

- Fiche Anya : [[Anya]]
- Spec officielle Anya (GitHub) : `docs/ia/anya-spec.md` — à dupliquer pour email-ingest une fois ce plan validé
- Workflow Inbox (Plaud) : [[Workflow Inbox]] — pattern de référence pour la résolution photos↔notes, applicable aux pièces jointes email
- Workflow Quittances : [[Workflow Quittances]] — sera appelé par `handlers/locataire.ts` si intent = demande_quittance
- Templates touchés par le handler : [[Templates/Contact pro]], [[Templates/Locataire]], [[Templates/Bien immobilier]]
- Red lines : [[red-lines]] — particulièrement P0 #1 (zéro invention), P0 #6 (zéro credential), P1 #8 (compléter ≠ remplacer), P1 #9 (pas de modif silencieuse)
