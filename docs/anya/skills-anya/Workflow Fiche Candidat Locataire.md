---
skill: fiche-candidat
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~5-10/mois en haute saison
modules_code:
  - src/lib/secretariat/rent/candidat.ts [À CONFIRMER chemin]
  - src/lib/secretariat/handlers/candidat.ts
  - src/lib/secretariat/email-ingest/
  - src/lib/secretariat/vault-client/
  - src/lib/secretariat/llm/client.ts
modeles_llm:
  - sonnet-4 (claude-sonnet-4-20250514) — extraction + pré-qualification
trigger_principal: email entrant classifié `candidat` par workflow Email Ingest
output_principal: fiche markdown dans `09. Administratif/Candidatures/[Nom].md` + carte Telegram 5 boutons
---

# Workflow Fiche Candidat Locataire — pré-qualifier un candidat à la location

> Source : `src/lib/secretariat/handlers/candidat.ts` (handler triage Email Ingest — 6 catégories Haiku 4.5). Pipeline parent : workflow Email Ingest → triage → dispatch `handlers/candidat`. Architecture : voir `docs/ia/anya-current-architecture.md`.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — email entrant
- Email reçu sur Gmail (cron 1h workflow Email Ingest) → triage Haiku 4.5 → catégorie `candidat`.
- Critères catégorisation `candidat` (system prompt triage) : mention dossier locatif, fiche de paie en pièce jointe, demande de visite location, formulaire candidature reçu via plateforme.

### Variantes ciblées
- **Candidature spontanée** : email direct sans contexte plateforme (annonce reçue par bouche-à-oreille ou recherche directe).
- **Candidature depuis plateforme** : email forwardé d'une plateforme d'annonces (format structuré reconnaissable).
- **Candidature avec dossier complet** : pièces jointes ≥ 4 (CV, fiches de paie x3, avis d'imposition, justificatif domicile).

### Hors trigger
- Email visiteur curieux sans intention sérieuse (catégorisé `autre`).
- Email "à classifier" si Anya ne reconnaît pas la candidature → workflow no-match contact.

---

## 2. Input

### Fiches à consulter en début de workflow
- **Annonces en cours** (vault `09. Administratif/Annonces actives/`) [À CONFIRMER chemin] — pour matcher le candidat à un lot précis.
- **Fiche lot concerné** (`02. Projets/02. Pro/Immobilier Direct/`) — pour critères loyer / type bail / état.
- **`00. Me/hot-context.md`** — contexte récent (Thomas a-t-il déjà reçu d'autres candidatures cette semaine ?).

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Email Gmail | Corps + pièces jointes | gmail-source/ |
| Pièces jointes | CV / fiches paie / avis d'imposition / justificatifs | parsing MIME |
| Fiche lot | Loyer attendu / type bail / zone | vault-reader |
| Contacts cache | Vérifier si candidat déjà connu | contacts-cache.ts TTL 1h |

### Convention de nommage
- **Fiche candidat** : `09. Administratif/Candidatures/[YYYY-MM-DD] [Nom Candidat].md` [À CONFIRMER format].
- **Pièces jointes** : `09. Administratif/Candidatures/_pieces/[Nom Candidat]/` (sous-dossier).

### Outils API requis
- **Anthropic SDK** — Sonnet 4 via wrapper `llm/client.ts` (qualité d'extraction critique : pas Haiku, le scoring est qualitatif).
- **Zod** — `CandidatProfileSchema` [À CONFIRMER existence].
- **Google Drive API** — `vault-client.createFile()` pour fiche markdown + uploads pièces jointes.
- **Gmail API** — fetch pièces jointes (`gmail-source/`).
- **Telegram Bot API** — carte 5 boutons via pending-store Drive TTL 7j R3.

---

## 3. Étapes

### 3.1 Réception via Email Ingest
Le workflow Email Ingest a déjà triagé l'email en `candidat`. Le handler `handlers/candidat.ts` est invoqué avec l'objet email + pièces jointes.

### 3.2 Extraction profil candidat (Sonnet 4)
- Wrapper `llm/client.ts` → Sonnet 4.
- Input prompt : corps email + texte extrait des pièces jointes (OCR si scan ? [À CONFIRMER]).
- Output JSON validé Zod : nom complet, situation pro (CDI/CDD/freelance/autre), revenu net mensuel, garant (oui/non + situation), composition foyer, lot ciblé (si mention).

### 3.3 Scoring de viabilité
Critères objectifs (jamais discriminatoires — voir red lines) :
- **Ratio revenu / loyer** : ≥ 3× = vert / 2,5-3× = orange / < 2,5× = rouge.
- **Stabilité pro** : CDI hors période d'essai = vert / CDI en essai ou CDD long = orange / CDD court ou freelance < 2 ans = rouge.
- **Garant** : garant solide (CDI revenu ≥ 3× loyer) = vert / garant moyen = orange / pas de garant = rouge (sauf revenu candidat > 4× loyer).
- **Dossier complet** : 4+ pièces = vert / 2-3 = orange / 0-1 = rouge.

Score global = couleur dominante (worst-case parmi les 4 critères = couleur finale).

### 3.4 Création fiche markdown vault
- `vault-client.createFile()` dans `09. Administratif/Candidatures/`.
- Contenu fiche : frontmatter YAML (nom, date_reception, lot_cible, score) + sections :
  - `## Profil` (nom, contact, situation pro, revenu)
  - `## Garant` (si applicable)
  - `## Pièces fournies` (liste avec wikilinks vers sous-dossier `_pieces/`)
  - `## Scoring` (4 critères + couleur finale)
  - `## Notes` (vide, à remplir par Thomas)

### 3.5 Upload pièces jointes
- Pour chaque pièce : `createFile()` dans `09. Administratif/Candidatures/_pieces/[Nom]/`.
- Wikilinks ajoutés dans la section `## Pièces fournies` de la fiche.

### 3.6 Carte Telegram 5 boutons
- Carte inline keyboard via pending-store Drive (TTL 7j R3 P1 #96).
- 5 boutons : `Valider` / `Refuser` / `Pièce manquante` / `Appeler` / `Archiver`.
- Préfixe callback `candidat:` (R4 P1 #97 — handler dédié + dispatch + test E2E obligatoires).
- Récap candidat affiché : nom + revenu + situation + score couleur + lien fiche vault.

### 3.7 Callback Thomas
- `Valider` → fiche taggée `#candidat-valide`, email re-classifié dans Gmail (label `Candidat / Validé`).
- `Refuser` → Anya rédige draft réponse polie (workflow Draft Email), Thomas l'envoie.
- `Pièce manquante` → carte secondaire pour préciser quelle pièce ; Anya rédige draft email demandant la pièce.
- `Appeler` → ajoute "Appeler [Nom]" dans TickTick (push via workflow TickTick Sync).
- `Archiver` → fiche taggée `#archive`, email labellisé `Candidat / Archive`.

---

## 4. Output

### Modifications vault
1. **Fiche candidat** créée dans `09. Administratif/Candidatures/[YYYY-MM-DD] [Nom].md`.
2. **Pièces jointes** uploadées dans `_pieces/[Nom]/`.
3. **Aucune modification** sur fiche lot (la fiche lot reste neutre — Thomas ajoute manuellement le locataire retenu en cas de signature).

### Quarantaine
- Si extraction Sonnet 4 retourne un profil incohérent (revenu manquant, nom illisible) → fiche créée avec sections vides + tag `#a-completer`, carte Telegram alerte Thomas.

### Récap (gabarit Telegram envoyé à Thomas)
```
Nouvelle candidature locataire.

Nom : [Nom Candidat]
Lot ciblé : [Adresse] (si identifié)
Revenu : [X EUR/mois] — [CDI / CDD / freelance]
Garant : [oui : profil / non]
Pièces : [X/5 reçues]
Score : 🟢 / 🟠 / 🔴

Fiche : [lien vault]
Pièces : [lien sous-dossier]

[5 boutons : Valider / Refuser / Pièce manquante / Appeler / Archiver]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS de critères discriminatoires** : origine, religion, situation maritale, orientation, âge (sauf majorité légale), nationalité hors UE-extra-territorial (LEGAL). Critères objectifs uniquement (revenu, garantie, stabilité pro, dossier complet). Conformité @legal RGPD + droit du logement.
- **JAMAIS d'auto-décision Valider/Refuser** — toujours carte Telegram à Thomas, Thomas tranche.
- **JAMAIS create+delete sur la fiche candidat** (R5 P0 #99) — si correction nécessaire, PATCH in-place via `updateFileContent()`.
- **JAMAIS envoyer un mail directement au candidat** — toujours brouillon via workflow Draft Email (règle 11 CLAUDE.md).
- **JAMAIS conserver les pièces jointes au-delà de la durée légale** [À CONFIRMER avec @legal — souvent 3 mois après refus, sauf opposition candidat].

### 5.2 Arbre de décision — scoring couleur
```
4 critères scorés : ratio revenu, stabilité pro, garant, dossier complet
├── Tous vert → 🟢 (recommandé)
├── ≥ 1 orange, 0 rouge → 🟠 (à étudier)
└── ≥ 1 rouge → 🔴 (risqué)
```
Le scoring est indicatif — Thomas décide. Anya n'auto-refuse jamais.

### 5.3 Critères de qualité
- **G1 (extraction conforme)** : profil candidat extrait avec nom + revenu + situation pro (3 champs minimum). Si manquant → tag `#a-completer`.
- **G2 (RGPD)** : pièces jointes stockées dans sous-dossier `_pieces/` dédié, suppression possible en batch.
- **G3 (zéro discrimination)** : audit régulier du system prompt extraction pour vérifier absence de bias.
- **G4 (cache hit Anthropic)** : `cache_read_input_tokens` > 0 sur candidatures suivantes (system prompt stable caché).

### 5.4 Exemple complet (cas réel — anonymisé)
**Email reçu** : "Bonjour, je suis intéressée par votre annonce pour l'appartement rue Henri Barbusse. Je suis cadre en CDI depuis 4 ans (salaire net 3500 EUR). Mes parents se portent garants. Voici mon dossier complet en PJ : CV, 3 dernières fiches de paie, avis d'imposition, justificatif de domicile. Cordialement, Sophie M."

**Pièces** : 6 PJ détectées.

**Extraction Sonnet 4** :
```json
{
  "nom": "Sophie M.",
  "situation_pro": "CDI cadre",
  "revenu_net_mensuel": 3500,
  "garant": { "type": "parents", "stabilite": "à vérifier dans PJ" },
  "lot_cible": "Lot Henri Barbusse 2",
  "pieces_fournies": ["CV", "fiche paie M-1", "fiche paie M-2", "fiche paie M-3", "avis imposition", "justificatif domicile"]
}
```

**Scoring** (loyer 950 EUR) :
- Ratio revenu : 3500/950 = 3,68× → 🟢
- Stabilité pro : CDI 4 ans → 🟢
- Garant : parents (à confirmer dans PJ) → 🟠
- Dossier : 6/5 → 🟢

**Score global** : 🟠 (worst-case = orange à cause du garant à vérifier).

**Fiche vault** : `09. Administratif/Candidatures/[2026-05-20] Sophie M.md` créée.

**Telegram** : carte 5 boutons → Thomas clique "Pièce manquante" → carte secondaire "Quelle pièce ?" → Thomas précise "Avis imposition garant" → Anya rédige draft email demandant la pièce.

### 5.5 Maintenance
- **Mise à jour critères scoring** : si Thomas veut ajuster les seuils (3× / 2,5×) → modifier la constante dans `rent/candidat.ts` [À CONFIRMER constante exacte].
- **Cache TTL** : fiche lot + annonces actives lues live (TTL 1h).
- **Conformité RGPD** : revue annuelle @legal sur durée de conservation pièces jointes.
- **Tests** : couverture minimale (candidat vert / orange / rouge / dossier incomplet) [À CONFIRMER suite test].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Création handler `candidat` dans la suite des 6 handlers triage [À CONFIRMER session origine]. |
| S17 | 2026-05-19 | Migration wrapper LLM unifié (R1) — cache_control auto + tracking 100%. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~5-10/mois en haute saison (mai-septembre — relocations universitaires + mobilité pro), ~1-3/mois hors saison.

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/rent/candidat.ts` vs `handlers/candidat.ts` (les deux ?).
- [À CONFIRMER] Chemin vault candidatures : `09. Administratif/Candidatures/` confirmé ?
- [À CONFIRMER] Seuils scoring exacts (3× / 2,5× — modifiables ?) et constante TS.
- [À CONFIRMER] Schéma Zod `CandidatProfileSchema` — existe-t-il ? Champs exacts ?
- [À CONFIRMER] OCR des pièces jointes scannées (PDF non textuel) — implémenté ou pas ?
- [À CONFIRMER] Durée légale de conservation des pièces jointes après refus (3 mois ? 6 mois ?).
- [À CONFIRMER] Préfixe callback Telegram `candidat:` — handler + dispatch + test E2E (R4) existants ?
- [À CONFIRMER] Suite de tests dédiée candidat (les 1255 tests baseline ne le mentionnent pas explicitement).
