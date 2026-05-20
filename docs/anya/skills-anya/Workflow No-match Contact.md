---
skill: nomatch-contact
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~10-20/mois
modules_code:
  - src/lib/secretariat/email/no-match.ts [À CONFIRMER chemin]
  - src/lib/secretariat/handlers/nomatch.ts [À CONFIRMER chemin]
  - src/lib/secretariat/telegram-validation/
  - src/lib/secretariat/vault-client/
modeles_llm: []
trigger_principal: workflow Email Ingest détecte expéditeur inconnu (non présent dans contacts-cache)
output_principal: fiche contact créée dans vault `01. Contacts/[catégorie]/` OU email en quarantaine
---

# Workflow No-match Contact — gérer les expéditeurs email inconnus (UX 5 boutons)

> Source : `src/lib/secretariat/email/no-match.ts` + `handlers/nomatch.ts` [À CONFIRMER chemins]. Pipeline parent : workflow Email Ingest → catégorie `a-classifier` quand expéditeur inconnu. Architecture : voir `docs/ia/anya-current-architecture.md`.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — expéditeur inconnu
- Workflow Email Ingest reçoit un email dont le champ `from` n'est PAS présent dans `contacts-cache` (TTL 1h).
- Triage Haiku 4.5 retourne catégorie `a-classifier` OU un handler downstream remonte "expéditeur inconnu".
- Bascule vers workflow no-match contact avant toute autre action.

### Variantes ciblées
- **Email professionnel évident** (signature avec entreprise, domaine pro identifiable) : carte Telegram suggère `Pro` par défaut.
- **Email personnel** (domaine grand public gmail/free/outlook + signature courte) : pas de suggestion automatique.
- **Email plateforme automatique** (noreply, no-reply, donotreply) : pas de no-match — directement catégorisé `autre` par pré-filtre heuristique (workflow Email Ingest).

### Hors trigger
- Expéditeur déjà connu dans `contacts-cache` → triage direct vers handler approprié (pas de passage par no-match).
- Vocaux / photos / texte Telegram direct → pas concerné (le no-match est spécifique aux emails entrants).

---

## 2. Input

### Fiches à consulter en début de workflow
- **`01. Contacts/`** complet — `contacts-cache.ts` (TTL 1h) déjà consulté en amont par Email Ingest → si miss, on est ici.
- **`00. Me/hot-context.md`** — pour contexte récent (Thomas attendait un email d'un nouveau contact ?).

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Email Gmail | `from` (nom + adresse), `subject`, `body[0:500]` | gmail-source/ |
| Contacts cache | Confirmation absence du match | `contacts-cache.ts` TTL 1h |
| Hot-context | Indices d'un nouveau contact attendu | vault-reader cache TTL 1h |

### Convention de nommage
- **Fiche contact créée** : `01. Contacts/[Pro|Famille|Amis|Autres]/[Nom Prénom].md` (selon bouton cliqué).
- **Pending-store** : `_Inbox/AnyaState/pending-nomatch-[pendingId].json` [À CONFIRMER nomenclature exacte].

### Outils API requis
- **Telegram Bot API** — carte 5 boutons inline keyboard via pending-store Drive TTL 7j R3.
- **Google Drive API** — `vault-client.createFile()` pour créer la fiche contact si Thomas valide.
- **Gmail API** — `users.messages.modify` pour re-labelliser l'email après décision Thomas.

---

## 3. Étapes

### 3.1 Réception via Email Ingest
Email Ingest signale `a-classifier` avec sender inconnu. Le handler `handlers/nomatch.ts` est invoqué avec l'objet email (sans pièces jointes — elles restent côté Gmail jusqu'à décision).

### 3.2 Construction du pending
- Génération `pendingId` (uuid v4 ou hash sha1 du messageId).
- Création JSON pending : `{ pendingId, messageId, from, subject, bodyPreview, createdAt, ttl: 7d }`.
- Écriture atomique via `.tmp + rename` (R3 / red line carte Validation Telegram).
- Persistance dans `_Inbox/AnyaState/` Drive (PATCH in-place R5 si le dossier existe, createFile sinon).

### 3.3 Carte Telegram 5 boutons
- Carte inline keyboard envoyée à Thomas :
  - `Pro` (callback `email_nomatch:pro:<pendingId>`)
  - `Famille` (callback `email_nomatch:famille:<pendingId>`)
  - `Amis` (callback `email_nomatch:amis:<pendingId>`)
  - `Autres` (callback `email_nomatch:autres:<pendingId>`)
  - `Skip` (callback `email_nomatch:skip:<pendingId>`)
- Préfixe callback `email_nomatch:` — R4 strict : (a) handler `handlers/nomatch.ts` + (b) dispatch dans `webhook/route.ts` + (c) test E2E.
- Affichage récap : expéditeur (nom + adresse), sujet, 3 premières lignes body.

### 3.4 Attente callback Thomas (TTL 7j R3)
- Pending persiste 7 jours minimum (R3 P1 #96 verbatim — "coût pending qui traîne << re-traitement").
- Si Thomas clique avant TTL → étape 3.5.
- Si TTL expire sans clic → cleanup pending Drive + email reste en label Gmail `Anya/a-classifier` (Thomas verra dans Gmail).

### 3.5 Traitement callback
Selon bouton cliqué :

- **`Pro` / `Famille` / `Amis` / `Autres`** :
  1. Création fiche contact dans `01. Contacts/[Catégorie]/[Nom].md` via `vault-client.createFile()`.
  2. Structure fiche : frontmatter (`nom`, `email`, `categorie`, `date_creation`) + sections `## Coordonnées`, `## Échanges`, `## Notes`.
  3. Wikilink vers la fiche : ajout dans hot-context si pertinent [À CONFIRMER comportement].
  4. Refresh `contacts-cache` (invalidation entrée cache).
  5. Re-déclenchement triage de l'email original avec contact maintenant matché → dispatch vers handler approprié (`apporteur`, `contact-pro`, etc.).
  6. Labellisation Gmail `Anya/[Catégorie]` au lieu de `Anya/a-classifier`.

- **`Skip`** :
  1. Pas de création de fiche.
  2. Email reste labellisé `Anya/a-classifier` (Thomas garde la main dans Gmail).
  3. Pending Drive supprimé.
  4. Note : si Thomas reçoit ultérieurement un autre email du même expéditeur, le no-match se redéclenchera (pas de "ignore list" persistante par défaut) [À CONFIRMER comportement souhaité].

### 3.6 Cleanup pending
- Suppression atomique du pending Drive après traitement réussi.
- Audit log dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` : `{ pendingId, action, contactCategory, timestamp }`.

---

## 4. Output

### Modifications vault
- **Si bouton catégorie cliqué** : 1 fiche contact créée dans `01. Contacts/[Pro|Famille|Amis|Autres]/[Nom].md`.
- **Si Skip** : aucune modification vault.

### Modifications Gmail
- Si catégorie validée → label re-appliqué selon catégorie (`Anya/Apporteur`, `Anya/Contact-Pro`, etc.).
- Si Skip → label `Anya/a-classifier` conservé.

### Quarantaine
- Email reste accessible via Gmail label `Anya/a-classifier` (jamais supprimé par Anya).
- Pending Drive expire après 7j → email reste consultable côté Gmail, à reclassifier manuellement par Thomas.

### Récap (gabarit Telegram envoyé à Thomas)
```
Email d'un expéditeur inconnu.

De : [Nom (si parsing OK)] <[email]>
Sujet : [subject]

Aperçu :
> [3 premières lignes]

Quel type de contact ?

[5 boutons : Pro / Famille / Amis / Autres / Skip]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS créer un contact sans validation Thomas** — pas d'auto-création même si signature email semble pro (typo possible, faux positif inacceptable).
- **JAMAIS perdre l'email** — pending Drive ou label Gmail `Anya/a-classifier` garantissent qu'on peut toujours retrouver l'email.
- **JAMAIS write direct pending JSON** — toujours `.tmp + rename` atomique (red line Validation Telegram, évite corruption si crash).
- **JAMAIS TTL pending < 7j** (R3 P1 #96 verbatim).
- **JAMAIS de nouveau préfixe callback sans (a)(b)(c)** (R4 P1 #97) : handler + dispatch + test E2E obligatoires.

### 5.2 Arbre de décision — catégorisation
```
Email expéditeur inconnu
└── Carte Telegram 5 boutons
    ├── Pro → fiche `01. Contacts/Pro/` + re-triage email
    ├── Famille → fiche `01. Contacts/Famille/` + re-triage
    ├── Amis → fiche `01. Contacts/Amis/` + re-triage
    ├── Autres → fiche `01. Contacts/Autres/` + re-triage
    └── Skip → pas de fiche, email reste `a-classifier`
```

### 5.3 Critères de qualité
- **G1 (TTL ≥ 7j)** : pending Drive respecte R3, ne expire jamais avant 7j.
- **G2 (atomicité)** : pending écrit via `.tmp + rename`, jamais de corruption.
- **G3 (R4 strict)** : préfixe `email_nomatch:` = handler + dispatch + test E2E présents.
- **G4 (refresh cache)** : après création fiche, `contacts-cache` invalidé et re-rempli (la prochaine occurrence du même expéditeur sera matchée).
- **G5 (zéro perte email)** : email toujours retrouvable via Gmail label OU vault si fiche créée.

### 5.4 Exemple complet (cas réel)
**Email reçu** : `from: Marc Dupond <marc.dupond@notaire-paris9.fr> / subject: Compromis Lot Henri Barbusse 3`

**Triage Email Ingest** : expéditeur non présent dans `contacts-cache` → bascule no-match.

**Pending créé** : `_Inbox/AnyaState/pending-nomatch-uuid123.json`.

**Carte Telegram envoyée** :
```
Email d'un expéditeur inconnu.

De : Marc Dupond <marc.dupond@notaire-paris9.fr>
Sujet : Compromis Lot Henri Barbusse 3

Aperçu :
> Bonjour Monsieur Issa,
> Suite à notre échange téléphonique d'hier, vous trouverez ci-joint
> le projet de compromis pour le Lot 3...

[5 boutons : Pro / Famille / Amis / Autres / Skip]
```

**Thomas clique `Pro`** (callback `email_nomatch:pro:uuid123`).

**Actions Anya** :
1. Création fiche `01. Contacts/Pro/Marc Dupond.md` :
   ```yaml
   ---
   nom: Marc Dupond
   email: marc.dupond@notaire-paris9.fr
   categorie: Pro
   date_creation: 2026-05-20
   ---
   
   # Marc Dupond
   
   ## Coordonnées
   - Email : marc.dupond@notaire-paris9.fr
   - Téléphone : [à compléter]
   - Métier : [à compléter, probablement notaire]
   
   ## Échanges
   
   ## Notes
   ```
2. `contacts-cache` invalidé.
3. Email re-triagé → maintenant matché → catégorie `contact-pro` → dispatch `handlers/contact-pro.ts`.
4. Label Gmail `Anya/a-classifier` → `Anya/Contact-Pro`.
5. Cleanup pending uuid123.

### 5.5 Maintenance
- **TTL pending** : 7j (R3 — non négociable). Si Thomas demande plus, c'est OK ; si moins, refuser (P1 #96).
- **Refresh cache** : invalidation explicite par entrée (pas full flush) pour éviter ré-IO inutile.
- **Audit logs** : `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` permet de tracer les décisions Thomas (utile pour entraîner un futur auto-classifier ML si volume justifie).
- **Tests E2E (R4)** : suite couvrant chaque préfixe callback `email_nomatch:*` [À CONFIRMER existence dans la baseline 1255 tests].
- **Évolution UX** : si Thomas demande plus de catégories (`Notaire` séparé de `Pro` par ex.), ajouter un sous-bouton OU une seconde carte après `Pro` [À CONFIRMER besoin].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Mise en production no-match avec 5 boutons [À CONFIRMER session origine]. |
| S14 ou S15 | — | TTL pending standardisé 7j (R3 P1 #96) [À CONFIRMER session exacte]. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~10-20/mois (nouveaux contacts pro principalement — apporteurs, notaires, candidats locataires). Coût négligeable (pas de LLM impliqué directement, le re-triage post-validation utilise Email Ingest existant).

## À confirmer (Thomas)

- [À CONFIRMER] Chemins exacts : `src/lib/secretariat/email/no-match.ts` + `handlers/nomatch.ts` ?
- [À CONFIRMER] Nomenclature pending : `_Inbox/AnyaState/pending-nomatch-[pendingId].json` ?
- [À CONFIRMER] Préfixe callback Telegram `email_nomatch:` — handler + dispatch + test E2E (R4) existants ?
- [À CONFIRMER] Comportement Skip : ignore list persistante (futurs emails du même sender re-déclenchent no-match ?) ou pas d'ignore list ?
- [À CONFIRMER] Ajout wikilink vers nouvelle fiche dans hot-context (oui/non) ?
- [À CONFIRMER] Structure exacte de la fiche contact créée (frontmatter + sections).
- [À CONFIRMER] Session exacte de standardisation TTL 7j pending (S14 ou S15) — référence à project-context.md historique.
- [À CONFIRMER] Suite de tests dédiée no-match dans la baseline 1255+ tests.
