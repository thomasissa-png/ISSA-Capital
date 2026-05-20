---
skill: draft-email
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~10-20/mois
modules_code:
  - src/lib/secretariat/email/draft-composer.ts [À CONFIRMER chemin]
  - src/lib/secretariat/contacts-cache.ts
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/llm/client.ts
modeles_llm:
  - sonnet-4 (claude-sonnet-4-20250514) — génération qualitative (ton naturel)
trigger_principal: Thomas demande à Anya (Telegram) "rédige un mail à [contact] sur [sujet]" OU email entrant nécessitant réponse
output_principal: Gmail draft (JAMAIS envoi direct) + lien Telegram + carte 2 boutons
---

# Workflow Draft Email — rédiger un brouillon Gmail (jamais envoi direct)

> Source : `src/lib/secretariat/email/draft-composer.ts` [À CONFIRMER chemin]. Pipeline parent : webhook Telegram (commande Thomas) OU workflow Email Ingest (réponse attendue détectée). Architecture : voir `docs/ia/anya-current-architecture.md`.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — commande Telegram explicite
- Thomas tape à Anya : "Anya, rédige un mail à [Nom Contact] sur [Sujet]" OU "Anya, réponds à [dernier email de X]".
- Détection par handler conversationnel inline (Sonnet 4) → intent "draft-email".

### Déclencheur secondaire — workflow Email Ingest
- Email entrant catégorisé `contact-pro` ou `apporteur` → handler dédié détecte qu'une réponse est attendue (formulation interrogative, demande d'information, RDV à fixer) → propose à Thomas un draft via carte Telegram "Rédiger une réponse ?".

### Variantes ciblées
- **Nouveau mail** : pas de thread existant, Anya crée un nouveau brouillon Gmail.
- **Reply dans thread** : si déclencheur secondaire (réponse à email reçu), Anya crée le draft en mode `In-Reply-To` du thread existant (préserve threading Gmail).

### Hors trigger
- **JAMAIS d'envoi automatique** (règle 11 CLAUDE.md). Anya crée uniquement un brouillon — l'envoi reste manuel côté Thomas (depuis Gmail web/mobile).
- Si le contact destinataire n'est pas dans `contacts-cache` → workflow no-match contact d'abord, draft ensuite.

---

## 2. Input

### Fiches à consulter en début de workflow
- **Contact destinataire** dans vault `01. Contacts/[Pro|Famille|Amis|Autres]/[Nom].md` (résolution par `vault-reader.findByPath()` + `contacts-cache.ts` TTL 1h).
- **`00. Me/hot-context.md`** — contexte récent (RDV en cours, négos pendantes).
- **`docs/founder-preferences.md`** [À CONFIRMER existence et accès depuis runtime] — ton de marque Thomas (formel mais chaleureux, tutoiement vs vouvoiement selon contact).
- **Thread email récent** (si reply) — lecture des 3-5 derniers messages via Gmail API.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Commande Telegram / email source | Destinataire + sujet + intention | webhook update OU email-ingest |
| Fiche contact vault | Historique relation, ton préféré, RDV passés | vault-reader |
| Hot-context | Signaux récents (RDV programmé, négo en cours) | vault-reader cache TTL 1h |
| Thread Gmail (si reply) | 3-5 derniers messages | Gmail API |

### Outils API requis
- **Anthropic SDK** — Sonnet 4 via wrapper `llm/client.ts` (ton naturel critique).
- **Gmail API** — `drafts.create()` endpoint :
  - Nouveau mail : `POST /gmail/v1/users/me/drafts` avec body RFC 5322.
  - Reply : même endpoint avec headers `In-Reply-To` + `References` du thread.
  - JAMAIS `messages.send` (envoi direct interdit).
- **Telegram Bot API** — carte 2 boutons + lien Gmail draft.

---

## 3. Étapes

### 3.1 Ack webhook < 5s
Webhook Telegram ack immédiat. Génération draft se fait dans la même request (Replit autoscale).

### 3.2 Résolution destinataire
- Lookup dans `contacts-cache.ts` (TTL 1h) par nom approximatif.
- Si ambiguïté (2+ matches) → carte Telegram "Quel contact ?".
- Si pas de match → bascule workflow no-match contact AVANT génération draft.

### 3.3 Chargement contexte
- Lire fiche contact destinataire (historique relation, ton).
- Lire `00. Me/hot-context.md` (signaux récents pertinents).
- Si reply : fetch thread Gmail (5 derniers messages max).
- Lire `docs/founder-preferences.md` [À CONFIRMER] pour ton de marque.

### 3.4 Génération draft par Sonnet 4
- Wrapper `llm/client.ts` → Sonnet 4.
- System prompt scindé : partie stable cachée (instructions ton + signature Thomas), partie dynamique (contact + sujet + contexte).
- Output JSON validé Zod (`EmailDraftSchema` [À CONFIRMER]) : `to`, `subject`, `body` (texte + HTML), `inReplyTo` (si applicable).
- Retry x1 self-correction si JSON invalide.

### 3.5 Création Gmail draft
- Construire body MIME RFC 5322 (texte + HTML alternative).
- Si reply : ajouter headers `In-Reply-To: <message-id>` + `References: <thread-references>` pour préserver le threading.
- `POST /gmail/v1/users/me/drafts` → retour `draftId` + lien Gmail web.

### 3.6 Confirmation Telegram + carte 2 boutons
- Récap court à Thomas : destinataire + sujet + extrait body (3 premières lignes).
- Carte inline keyboard : `Modifier` / `Approuver pour envoi manuel`.
- Préfixe callback `draft_email:` (R4 P1 #97 — handler + dispatch + test E2E).
- Lien direct vers Gmail draft (URL `https://mail.google.com/mail/u/0/#drafts?compose=<draftId>`) [À CONFIRMER format URL exact].

### 3.7 Callback Thomas
- `Modifier` → Thomas tape un message complémentaire ("plus court", "ajoute la dispo lundi 14h") → Anya régénère le draft (`updateDraft()` Gmail API) avec les instructions complémentaires.
- `Approuver pour envoi manuel` → Anya confirme "Draft prêt. Envoi à faire manuellement côté Gmail." Pas d'envoi côté Anya. Optionnel : tag `#draft-approuve` dans la fiche contact vault.

---

## 4. Output

### Modifications vault
- **Aucune** par défaut (les drafts vivent côté Gmail, pas dans le vault).
- **Optionnel** : si Thomas approuve, possibilité de logger l'échange dans la fiche contact (section `## Échanges`) — [À CONFIRMER comportement Thomas souhaité].

### Modifications Gmail
- **Draft** créé dans Gmail (label `[Gmail]/Drafts` ou équivalent).
- Si reply : draft attaché au thread d'origine (threading préservé).

### Quarantaine
- Si génération Sonnet 4 échoue → retry x1 puis warn Telegram à Thomas.
- Si création Gmail draft échoue (rate limit, OAuth expiré) → fallback : envoyer le texte du draft à Thomas en Telegram (markdown) avec instruction "Gmail draft impossible. Copie-colle si besoin."

### Récap (gabarit Telegram envoyé à Thomas)
```
Brouillon Gmail créé.

À : [Nom Contact] <[email]>
Sujet : [Subject]

Extrait :
> [3 premières lignes du body]

Gmail : [lien direct draft]

[2 boutons : Modifier / Approuver pour envoi manuel]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS d'envoi direct** — uniquement `drafts.create()`, JAMAIS `messages.send` (règle 11 CLAUDE.md). Envoi 100% manuel côté Thomas.
- **JAMAIS inventer un nom propre absent de `contacts-cache`** (G1 zéro invention CLAUDE.md). Si destinataire ambigu → bascule workflow no-match.
- **JAMAIS inventer un fait précis** (RDV, montant, date) absent du contexte fourni. Si Thomas n'a pas précisé "RDV mardi 14h", ne pas l'ajouter au draft.
- **JAMAIS oublier la signature Thomas** — automatique via system prompt stable.
- **JAMAIS de tutoiement avec contact pro non explicitement tutoyé** — par défaut vouvoiement pour `contact-pro` et `apporteur`, tutoiement seulement si `01. Contacts/Amis/` ou `01. Contacts/Famille/` ou flag `tutoiement: true` dans fiche contact.

### 5.2 Arbre de décision — ton et destinataire
```
Trigger draft-email
├── Destinataire matché contacts-cache ?
│   ├── NON → workflow no-match contact d'abord
│   └── OUI → continuer
└── Catégorie contact :
    ├── Pro / Apporteur → vouvoiement par défaut, ton professionnel chaleureux
    ├── Amis / Famille → tutoiement par défaut, ton décontracté
    └── Autres → vouvoiement par défaut (safe choice)
        └── sauf flag `tutoiement: true` dans fiche
```

### 5.3 Critères de qualité
- **G1 (zéro invention)** : aucune donnée factuelle (RDV, montant, fait) absente du contexte. Si manque → "[À COMPLÉTER]" dans le draft, Thomas remplit avant envoi.
- **G2 (threading préservé)** : reply crée un draft attaché au thread d'origine (headers `In-Reply-To` + `References`).
- **G3 (ton aligné)** : vouvoiement/tutoiement conforme à la catégorie contact + flags fiche.
- **G4 (cache hit Anthropic)** : `cache_read_input_tokens` > 0 sur drafts suivants (system prompt + signature stable cachés).
- **G5 (signature Thomas)** : présente dans 100% des drafts générés.

### 5.4 Exemple complet (cas réel)
**Commande Telegram** : "Anya, réponds à Karim Mokhtar pour confirmer le RDV de mercredi 14h chez le notaire pour la signature du compromis Lot Henri Barbusse 3."

**Détection** :
- Intent : reply email (Karim Mokhtar a déjà envoyé un mail récent — fetch thread).
- Destinataire matché : `01. Contacts/Pro/Karim Mokhtar.md` (apporteur d'affaires).
- Contexte : RDV mercredi 14h, notaire, compromis Lot Henri Barbusse 3.

**Draft généré** :
```
À : Karim Mokhtar <karim@[domaine].fr>
Sujet : Re: Compromis Lot Henri Barbusse 3 — RDV notaire

Bonjour Karim,

Je vous confirme le rendez-vous chez le notaire mercredi 22 mai à 14h
pour la signature du compromis sur le Lot 3 de la rue Henri Barbusse.

Je vous remercie pour la coordination, et reste à disposition si une
information de dernière minute vous remontait avant la signature.

À mercredi,

Thomas Issa
ISSA Capital
```

**Gmail draft** : créé avec `In-Reply-To: <messageId>` du dernier mail Karim → threading préservé.

**Telegram** : carte 2 boutons. Thomas clique "Approuver pour envoi manuel" → ouvre Gmail web → envoie manuellement.

### 5.5 Maintenance
- **Mise à jour signature Thomas** : modifier le system prompt stable (cache invalidé une fois).
- **Cache TTL** : contacts cache + hot-context lus live (TTL 1h).
- **Évolution ton** : si Thomas évolue ses préférences (ex. tutoiement plus large), mise à jour `docs/founder-preferences.md` + system prompt stable.
- **Tests** : couverture minimale (draft nouveau / reply threadé / contact pro / contact ami) [À CONFIRMER suite test].
- **Rate-limit Gmail** : surveiller quota `drafts.create` (1M units/jour, draft = 10 units typiquement [À CONFIRMER]).

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Création module draft-composer (héritage features S10-S14 email) [À CONFIRMER session origine]. |
| S17 | 2026-05-19 | Migration wrapper LLM unifié (R1) — cache_control auto + tracking 100%. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~10-20/mois (rythme normal échanges pro + apporteurs immo). Coût Anthropic ~0,5-1 EUR/mois (Sonnet 4 + cache_control system prompt stable).

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/email/draft-composer.ts` ?
- [À CONFIRMER] Schéma Zod `EmailDraftSchema` — existe-t-il ?
- [À CONFIRMER] Format exact URL Gmail draft pour le lien direct Telegram.
- [À CONFIRMER] Lecture de `docs/founder-preferences.md` accessible depuis runtime Anya (le fichier est dans le repo, mais Anya le lit-elle dynamiquement ou via system prompt stable ?).
- [À CONFIRMER] Comportement souhaité après approbation Thomas : logger l'échange dans la fiche contact vault (section `## Échanges`) ou laisser uniquement côté Gmail ?
- [À CONFIRMER] Préfixe callback Telegram `draft_email:` — handler + dispatch + test E2E (R4) existants ?
- [À CONFIRMER] Gestion threading reply : headers `In-Reply-To` + `References` correctement implémentés ?
- [À CONFIRMER] Suite de tests dédiée draft email (les 1255 tests baseline ne le mentionnent pas explicitement).
