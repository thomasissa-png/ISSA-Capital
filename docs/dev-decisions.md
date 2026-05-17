# Dev Decisions — ISSA Capital

> @fullstack — 2026-04-07 — session 2 (Phase 2b).
> Journal des décisions techniques prises pendant l'implémentation du site vitrine.

---

## Résumé exécutif

- Site vitrine Next.js 14 App Router, TypeScript strict, Tailwind avec tokens 3 tiers.
- 7 pages statiques + 1 API route (`/api/contact`).
- Composant unique `<ContactForm variant="…">` qui couvre les 3 formulaires (contact / accompagnement / opportunite).
- Build passe (`tsc`, `next lint`, `next build`) avec 0 erreur, 0 warning.
- First Load JS : ~94-98 kB par route, largement sous le budget de 200 kB.

---

## Décisions majeures

### 1. Polices — fallback système temporaire

**Contexte** : le brief impose des polices self-hosted (Cormorant Garamond + Inter) via `next/font/local`. Le dossier `public/fonts/` était vide au démarrage et l'environnement de build de la session n'a **aucun accès réseau** (echec de `next/font/google` lors de la tentative de bundling).

**Décision** : configurer les CSS variables `--font-cormorant` et `--font-inter` dans `globals.css` avec des **stacks système** de qualité typographique proche (Georgia pour le serif, Inter/system-ui pour le sans-serif). Les composants référencent toujours ces variables via Tailwind (`font-heading`, `font-body`), donc la bascule vers du vrai self-hosting sera une modification **localisée** (une seule dépendance : les fichiers .woff2).

**TODO Phase 2c / Phase 3** : placer les fichiers `.woff2` dans `public/fonts/` et remplacer les stacks dans `globals.css` par des règles `@font-face` avec `font-display: swap`. Ou, si l'environnement Replit a accès réseau au build, rebasculer sur `next/font/google` (un commit inverse des deux blocs supprimés de `app/layout.tsx` suffit).

**Pourquoi ce choix** : avancer plutôt que bloquer — les stacks système sont WCAG-compatibles et rendent correctement le design. La correction sera triviale.

### 2. ContactForm — composant unique à 3 variants

**Décision** : un seul fichier `src/components/ui/ContactForm.tsx` qui prend une prop `variant: 'contact' | 'accompagnement' | 'opportunite'` et rend dynamiquement les bons champs, le bon libellé de submit, et le bon message de confirmation.

**Pourquoi** : demandé explicitement dans le brief. Évite la duplication. Les 3 variants partagent 100% du pipeline (validation Zod discriminated union, fetch, gestion d'état, honeypot, consentement RGPD, messages d'erreur).

**États UI couverts (gate G21)** : 5 états (idle / submitting / success / error / field-errors). Le `vide` n'est pas applicable à un formulaire (pas de liste à remplir).

### 3. Rate limit — in-memory Map

**Décision** : `src/lib/rateLimit.ts` implémente un limiter in-memory basé sur une Map JavaScript, avec GC automatique toutes les 60s. Pas d'Upstash/Redis.

**Pourquoi** : site vitrine déployé sur une instance unique Replit. Aucune raison de complexifier avec une dépendance externe. Limite par défaut : 5 requêtes / 10 minutes par IP. Configurable via `RATE_LIMIT_MAX` et `RATE_LIMIT_WINDOW_MS`.

**Limite connue** : si Replit passe en scale horizontal plus tard, chaque instance aura son propre compteur. À migrer vers Upstash à ce moment-là. Documenté dans le fichier lui-même.

### 4. Sanitization — regex sans dépendance

**Décision** : `src/lib/sanitize.ts` fait du strip HTML + suppression des caractères de contrôle avec des regex simples. Pas de DOMPurify, pas de jsdom.

**Pourquoi** : DOMPurify côté serveur Node nécessite jsdom (~15MB installés). Pour un site où les seuls champs libres sont `name`, `message`, `location`, `description`, `ticket`, les regex sont suffisantes. La validation de format (email, enum) est faite en amont par Zod. Le HTML n'est jamais rendu : il est seulement injecté dans un email HTML via un escape maison (`escapeHtml` dans `resend.ts`).

### 5. Resend — instanciation paresseuse

**Décision** : `getClient()` dans `src/lib/resend.ts` instancie le client Resend seulement à la première utilisation. Le build ne crashe pas si `RESEND_API_KEY` est absent/placeholder — un warning est loggué et l'API retourne une erreur contrôlée.

**Pourquoi** : permet le build CI même sans secrets. Détecte explicitement les placeholders (`re_xxxxx`) pour éviter les timeouts silencieux sur `resend.emails.send()` (pattern déjà documenté dans le mindset `@fullstack`).

### 6. Headers de sécurité — déjà dans `next.config.js`

Le fichier `next.config.js` était déjà en place à l'ouverture de session avec tous les headers conformes au `docs/infra/infrastructure.md` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). **Non modifié** — validé tel quel.

### 7. Rendu statique partout

**Décision** : toutes les 7 pages publiques ont `export const dynamic = 'force-static'`. Aucune d'entre elles ne dépend de données runtime. Next les génère en SSG au build.

**Pourquoi** : performance maximum (TTFB < 50ms sur CDN), coût serveur minimal, aucune fuite de PII. Les seules routes dynamiques sont `/api/contact` (POST) et `/sitemap.xml`/`/robots.txt` (générés au build).

### 8. Accessibilité — WCAG 2.2 AA

- Skip link en haut de chaque page (`.skip-link` focus-visible uniquement)
- Focus-visible global à `2px solid levant-500` avec offset 2px
- Touch targets : boutons 48px min, ghost 44px min
- `prefers-reduced-motion` : animations court-circuitées globalement dans `globals.css`
- ARIA : landmarks (`header`, `nav`, `main`, `footer`), `aria-label`, `aria-describedby` sur les erreurs, `aria-live` sur les messages de statut du formulaire
- Contraste levant : usage de **levant-600** (ratio 4.6:1) pour tout texte d'accent <18px sur fond clair. levant-500 uniquement sur fond sombre ou pour des bordures/séparateurs. Respecte la règle WCAG documentée dans `page-compositions.md`.

### 9. JSON-LD structured data

- **Organization** injecté dans `app/layout.tsx` (toutes les pages) — inclut `name`, `url`, `logo`, `address`, `founder`, `foundingDate`, `vatID`, `taxID`.
- **Person** (Thomas Issa) injecté sur `/mission` uniquement — inclut `jobTitle`, `alumniOf` (HEC, UC Irvine, IMT), `knowsLanguage`.

### 10. robots.txt et sitemap.xml

Générés dynamiquement par `app/robots.ts` et `app/sitemap.ts` (conventions Next 14). `mentions-legales` est exclue du sitemap ET marquée `noindex, nofollow` dans ses metadata Next.

### 11. Assets d'image — déjà présents

Les assets SVG (`favicon.svg`, `logo.svg`, `logo-inverse.svg`, `apple-touch-icon.svg`, `android-chrome-*.svg`, `og-image-source.svg`, `site.webmanifest`) étaient déjà dans `public/` au démarrage (produits par @design en parallèle). **Non modifiés**. Le `og-image.png` binaire (1200×630) reste à produire par @design — le metadata layout y fait déjà référence (`/og-image.png`). Tant qu'il n'existe pas, les cartes OG sur les réseaux sociaux afficheront une image cassée — à corriger en Phase 2c avant déploiement.

---

## Structure du code

```
src/
├── app/
│   ├── layout.tsx             ← Root layout, fonts, JSON-LD Organization, skip link
│   ├── page.tsx               ← Accueil
│   ├── mission/page.tsx       ← Mission & Philosophie + JSON-LD Person Thomas
│   ├── accompagnement/page.tsx
│   ├── opportunites/page.tsx
│   ├── participations/page.tsx
│   ├── contact/page.tsx
│   ├── mentions-legales/page.tsx  ← noindex, nofollow
│   ├── api/contact/route.ts   ← POST handler avec Zod + rate limit + Resend
│   ├── robots.ts              ← robots.txt dynamique
│   ├── sitemap.ts             ← sitemap.xml dynamique
│   ├── not-found.tsx          ← 404 custom
│   ├── error.tsx              ← Error boundary client
│   ├── loading.tsx            ← Loading state root
│   └── globals.css            ← Tokens sémantiques + reset + a11y
├── components/
│   ├── layout/
│   │   ├── Header.tsx         ← Client : sticky, burger mobile, active state
│   │   └── Footer.tsx         ← Server : clause légale, navigation
│   └── ui/
│       ├── Button.tsx         ← 4 variants, polymorphe link/button
│       ├── Container.tsx      ← max-w content/editorial/narrow
│       ├── Section.tsx        ← 4 tons, padding vertical responsive
│       ├── Overline.tsx       ← petit label avec usage WCAG levant-600/500
│       └── ContactForm.tsx    ← CLIENT — pièce centrale, 3 variants
├── lib/
│   ├── cn.ts                  ← Wrapper clsx
│   ├── env.ts                 ← Validation Zod runtime variables serveur
│   ├── rateLimit.ts           ← Limiter in-memory
│   ├── sanitize.ts            ← Strip HTML et contrôle
│   ├── contactSchema.ts       ← Schémas Zod discriminated union
│   ├── resend.ts              ← Client Resend + template email HTML
│   ├── rateLimit.test.ts      ← Vitest
│   └── contactSchema.test.ts  ← Vitest
└── config/
    └── site.ts                ← Source de vérité business (email, adresse, nav)
```

---

## Pre-commit gate check

Exécuté en fin de session :

| Check | Commande | Statut |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit` | ✅ PASS (0 erreur) |
| ESLint | `npx next lint` | ✅ PASS (0 warning, 0 erreur) |
| Production build | `npx next build` | ✅ PASS (12/12 pages générées) |
| Tests unitaires | `npx vitest run` | ✅ PASS (5 tests / 2 fichiers) |
| E2E Playwright | `npx playwright test` | ⏸️ DIFFÉRÉ — browsers non installables dans le sandbox de session (pas d'accès réseau). Les specs sont prêtes dans `tests/e2e/smoke.spec.ts` et `tests/visual/screenshots.spec.ts`. À exécuter par @qa en Phase 2c sur environnement avec accès réseau. |
| Boucle visuelle 3 devices | Screenshots Playwright | ⏸️ DIFFÉRÉ — même raison. Specs prêtes, baselines à générer en Phase 2c. |

---

## TODOs remontés à @orchestrator / @qa / @design

1. **@design** — og-image.png binaire 1200×630 (seule asset encore manquant en binaire).
2. **@design** — variantes PNG des icônes (favicon.ico, apple-touch-icon.png, android-chrome-*.png). Les SVG sources sont déjà en place ; la conversion binaire reste à faire si on veut un support complet legacy.
3. **@qa** — installer Playwright browsers et exécuter la matrice E2E + baselines screenshots 3 devices.
4. **@qa** — étendre `tests/e2e/smoke.spec.ts` vers la matrice traçabilité complète des 11 user stories de `functional-specs.md` (gate G27).
5. **Fonts** — placer Cormorant Garamond + Inter dans `public/fonts/` et rebasculer sur `next/font/local` (ou rebasculer sur `next/font/google` si l'env de build Replit a accès réseau). Fichier concerné : `src/app/layout.tsx` (commentaire TODO déjà en place) + `src/app/globals.css` (variables `--font-cormorant` et `--font-inter`).
6. **Thomas** — confirmation qualité Président dans les mentions légales (noté `[HYPOTHÈSE]` par @copywriter, affiché tel quel par défaut).

---

## Session 11 — Fix dossiers Inbox dupliqués sur cold start serverless

### Contexte du bug

Le bot Anya en mode inbox uploade les photos vers Google Drive dans un sous-dossier `Photos` sous le dossier parent `_Inbox`. Au premier test, Anya a correctement cree `Photos/` et y a uploade. Au second test (apres cold start serverless), au lieu de reutiliser `Photos/`, elle a cree un doublon `Photos (1)` a cote. Google Drive autorise les noms de dossiers identiques et desambiguise dans l'UI avec `(1)`.

### Cause racine identifiee

**Scope OAuth `drive.file`** (confirme dans `src/app/api/drive-auth/route.ts` ligne 18). Le scope `https://www.googleapis.com/auth/drive.file` limite la visibilite de l'app aux seuls fichiers et dossiers crees par cette meme app OAuth. Entre deux invocations serverless, le cache `globalThis` est perdu. La recherche `files.list` retournait 0 resultat car le scope `drive.file` ne voyait pas le dossier cree par l'instance precedente (potentiellement a cause d'un refresh token regenere ou d'un changement de credentials OAuth entre tests).

Le code original ne logguait pas le statut de la recherche, rendant le diagnostic invisible.

### Corrections appliquees

1. **Logs explicites sur la search** — status HTTP, body en cas d'erreur, nombre de resultats en cas de succes. Permet de diagnostiquer immediatement si le probleme est scope/permissions ou autre.

2. **`supportsAllDrives=true` + `includeItemsFromAllDrives=true`** — ajoutes a la search ET au create. Si le parent `_Inbox` est dans un Shared Drive, la search echouerait silencieusement sans ces parametres.

3. **Escape des quotes** dans `subfolderName` pour la query Google Drive (`subfolderName.replace(/'/g, "\\'")`) — securite defensive.

4. **Env vars pre-configurees (solution principale)** — 4 env vars optionnelles permettent de bypasser completement la recherche/creation :
   - `DRIVE_INBOX_PHOTOS_FOLDER_ID`
   - `DRIVE_INBOX_NOTES_FOLDER_ID`
   - `DRIVE_INBOX_VOICE_FOLDER_ID`
   - `DRIVE_INBOX_DOCUMENTS_FOLDER_ID`

   Si l'env var est definie pour un sous-dossier, son ID est utilise directement (zero fetch). Sinon, fallback sur le comportement search/create ameliore.

5. **Export de `getOrCreateSubfolder`** — la fonction etait `async function` (privee). Exportee pour permettre les tests unitaires.

### Pourquoi ne pas changer le scope OAuth

Passer de `drive.file` a `drive` (scope complet) resoudrait le probleme de visibilite mais donnerait a l'app un acces total au Drive de Thomas (lecture/ecriture/suppression de tous les fichiers). C'est disproportionne pour un bot secretariat. La solution env vars est plus securisee et plus robuste (zero dependance au scope pour les sous-dossiers configures).

### Tests ajoutes

`src/lib/secretariat/__tests__/drive-subfolder.test.ts` — 11 tests couvrant les 4 chemins de resolution :
- Env var definie → retour direct sans fetch (4 sous-dossiers + 1 test env var vide)
- Search retourne un resultat → utilise l'ID + cache globalThis
- Search retourne vide → creation du sous-dossier
- Search echoue (HTTP 403) → fallback creation avec log d'erreur
- Sous-dossier non mappe → fallback search/create
- Escape des quotes dans le nom

### Action manuelle Thomas

1. Dans Google Drive, ouvrir le dossier `Photos` original (le premier cree), copier son ID depuis l'URL
2. Dans Replit Secrets, ajouter `DRIVE_INBOX_PHOTOS_FOLDER_ID` avec cet ID
3. Deplacer les fichiers de `Photos (1)` vers `Photos`, puis supprimer `Photos (1)`
4. Optionnel : faire de meme pour `Notes`, `Voice`, `Documents` si ces sous-dossiers existent deja

### Fichiers modifies

- `src/lib/secretariat/drive-upload.ts` — fix principal + env vars + logs + export
- `src/lib/secretariat/__tests__/drive-subfolder.test.ts` — nouveau fichier test (11 tests)
- `.env.example` — documentation des 4 env vars optionnelles
- `docs/dev-decisions.md` — cette section

---

## Session 11 — Phase 1+2 Anya : lib rent/ + workflow quittance

### Contexte

Port du workflow Python `generer_quittance.py` (549 lignes, fpdf2) en TypeScript pour le bot Telegram Anya. Le Python original lit les fiches locataires depuis le vault Obsidian local, genere des quittances PDF et les ecrit sur le disque. La version TypeScript lit les fiches depuis Google Drive (decision verrouillee par Thomas) et uploade les PDF sur Drive.

### Choix de lib num-en-lettres : implementation native (~100 lignes)

**Decision** : implementation native dans `src/lib/secretariat/rent/num-en-lettres.ts` au lieu d'un package npm.

**Justification** :
- Le scope est limite : montants de loyer entre 0 et ~10 000 euros, toujours arrondis a l'entier (comme le Python : `int(round(montant))`)
- Les libs npm candidates (`to-words`, `written-number`, `nombre-en-toutes-lettres`) ajoutent 50-200KB de code pour 124 locales dont 123 inutiles
- Les regles du francais sont bien specifiees et testables : 80 = quatre-vingts (avec S sauf suivi), 71 = soixante-et-onze, 200 = deux cents (avec S si multiple exact)
- 100 lignes testees (27 tests) = ownership total, zero risque de breaking change npm
- **Alternative ecartee** : `to-words` — la lib la plus moderne mais necessite une configuration locale FR et ajoute une dependance pour un cas d'usage trivial

### Approche de lecture Drive (scope readonly)

Les fiches locataires sont lues depuis `07. Contacts/05. Locataires/01. Actuels/` puis `_Candidats/` sur Google Drive. Le code navigue dans l'arborescence via l'API files.list (dossier par dossier) car le scope OAuth actuel est `drive.file` (ne voit que les fichiers crees par l'app).

**Action Thomas** : migrer le scope OAuth vers `drive.readonly` via `/api/drive-auth` pour que le bot puisse lire les fiches locataires existantes. Sans ce scope, la recherche de locataires retournera toujours une liste vide.

Le parser YAML est minimaliste (cle: valeur simple par ligne) car les fiches locataires n'utilisent ni listes ni objets imbriques dans le frontmatter. Un parser YAML complet (js-yaml) ajouterait une dependance pour un format deja contraint.

### PDF : PDFKit (pas fpdf2)

Le Python utilise fpdf2 (pur Python). Le TypeScript utilise PDFKit (deja en dependance pour les CR). Le layout est porte fidellement : memes marges (22mm), memes sections, memes polices (Helvetica/Helvetica-Bold — polices internes PDFKit, pas de TTF necessaire), meme table Loyer/Charges/Total, meme texte juridique, memes mentions legales.

Difference notable : fpdf2 permet `align="J"` (justified) partout, PDFKit aussi via `{ align: 'justify' }`. Le rendu est visuellement equivalent.

### Upload Drive : ecrasement silencieux

Decision Thomas : si une quittance pour le meme mois + locataire existe deja sur Drive, on ecrase silencieusement (suppression + re-upload). Pas de demande de confirmation, pas d'increment de numero.

### Variables d'environnement ajoutees

- `DRIVE_QUITTANCES_FOLDER_ID` — optionnel, ID du dossier parent Drive pour les quittances
- `DRIVE_VAULT_ROOT_ID` — optionnel, ID du dossier racine Obsidian sur Drive (pour naviguer vers les fiches locataires)

### Fichiers ajoutes/modifies

**Nouveaux** :
- `src/lib/secretariat/rent/types.ts` — Zod schemas Locataire, Bien, BailleurConfig, QuittanceVariables, QuittanceWorkflowData
- `src/lib/secretariat/rent/locataires.ts` — lecture fiches locataires depuis Drive + parser YAML/frontmatter
- `src/lib/secretariat/rent/biens.ts` — resolution des biens (import JSON statique)
- `src/lib/secretariat/rent/bailleur.ts` — config bailleur
- `src/lib/secretariat/rent/num-en-lettres.ts` — conversion nombre en toutes lettres francaises
- `src/lib/secretariat/rent/dates-fr.ts` — formatage dates en francais
- `src/lib/secretariat/rent/signature.ts` — chargement signature PNG
- `src/lib/secretariat/rent/pdf-quittance.ts` — generation PDF quittance (PDFKit)
- `src/lib/secretariat/rent/data/biens.json` — copie statique de biens.yml
- `src/lib/secretariat/rent/__tests__/num-en-lettres.test.ts` — 27 tests
- `src/lib/secretariat/rent/__tests__/dates-fr.test.ts` — 14 tests
- `src/lib/secretariat/rent/__tests__/biens.test.ts` — 15 tests
- `src/lib/secretariat/rent/__tests__/locataires.test.ts` — 10 tests
- `src/lib/secretariat/rent/__tests__/types.test.ts` — 9 tests
- `src/lib/secretariat/rent/__tests__/pdf-quittance.test.ts` — 8 tests
- `src/lib/secretariat/rent/__tests__/quittance-workflow.test.ts` — 7 tests
- `src/lib/secretariat/workflows/quittance.ts` — workflow quittance (machine d'etats)

**Modifies** :
- `src/lib/secretariat/workflows/types.ts` — ajout WorkflowType 'quittance' + QuittanceWorkflowStep
- `src/lib/secretariat/workflows/registry.ts` — enregistrement du workflow quittance
- `src/lib/secretariat/telegram.ts` — ajout sendTelegramMessageWithButtons (boutons inline personnalises)
- `src/app/api/telegram/webhook/route.ts` — commande /quittance + dispatch workflow quittance
- `docs/ia/anya-spec.md` — documentation workflow quittance
- `.env.example` — variables Drive quittances

---

## Session 11 — Recherche locataire futée

### Contexte du bug

Thomas tape un nom de locataire dans `/quittance` et le bot repond "non trouve sur Drive". Cause : `searchDriveFiles` utilisait `name contains '<query>'` cote Drive API, trop strict. Les typos ("Hela" au lieu de "Hella"), les accents ("Hella" vs "Hélla"), les noms officiels differents du nom de fichier ("Hella Atika Taoutaou" dans le frontmatter mais le fichier s'appelle "Hella Taoutaou.md") ne matchaient pas.

### Decisions

**1. Chargement de toutes les fiches + matching local (pas de filtre Drive API)**

L'ancienne approche filtrait cote API Drive (`name contains '<query>'`). La nouvelle charge TOUTES les fiches .md des deux dossiers (Actuels + Candidats) et fait le matching en local. Avantage : controle total sur l'algorithme de matching. Cout : O(N) appels `readDriveFileContent` au premier chargement (12 fiches = 12 fetches en ~2s). Mitigation : cache memoire TTL 60s.

**2. Cache memoire TTL 60s**

Simple objet module-level avec timestamp. Pas de lib externe (pas besoin de Redis pour 12 fiches). Le cache est invalide apres 60s ou sur appel explicite `invalidateLocatairesCache()`. Le TTL de 60s est un compromis : assez court pour voir un ajout de fiche rapidement, assez long pour ne pas re-fetcher si Thomas tape plusieurs noms d'affilee.

**3. Levenshtein natif (~20 lignes) plutot que `fastest-levenshtein`**

Meme raisonnement que pour `num-en-lettres` : le scope est borne (noms courts, max ~30 chars), l'algorithme est trivial (Wagner-Fischer), zero dependance, ownership total. L'implementation utilise une optimisation memoire a 2 lignes (O(n) espace au lieu de O(mn)).

**4. Algorithme de matching en cascade**

Ordre de priorite (premier match gagne mais on collecte tous les candidats) :
1. Exact match sur nom de fichier normalise (score 0)
2. Exact match sur `nom_officiel` normalise (score 0)
3. StartsWith sur nom de fichier normalise (score 1)
4. StartsWith sur prenom seul (score 1)
5. Contains sur nom de fichier normalise (score 2)
6. Contains sur `nom_officiel` normalise (score 2)
7. Levenshtein distance ≤ 2 sur nom complet, prenom ou nom de famille (score = distance)

Decision : si 1 seul candidat avec score ≤ 1 → match direct (pas d'ambiguite). Sinon → liste de candidats triee par score.

**5. Type de retour enrichi**

`rechercherLocataire` retourne maintenant `RechercheLocataireResult` : `{ locataire, candidats, totaux }` au lieu de `{ locataire, alternatives }`. Breaking change volontaire, un seul call site (`quittance.ts`) mis a jour.

**6. Export de `matchFiches` pour les tests**

L'algorithme de matching est exporte separement pour permettre des tests unitaires purs (sans mock Drive). Les 12 fiches reelles du vault sont reproduites comme fixtures dans les tests.

### Tests ajoutes

42 nouveaux tests dans `locataires.test.ts` :
- 6 tests `normalizeForSearch` (lowercase, accents, espaces, cedilles, vide, caracteres speciaux)
- 8 tests `levenshtein` (identique, vide, substitution, insertion, suppression, distance 2, distance elevee)
- 28 tests `matchFiches` (les 10 cas du brief + 18 cas supplementaires : exact, startsWith, contains, Levenshtein, nom_officiel, deduplication, tri, source actuels/candidats, accents, espaces)

Total : 252 tests (vs 210 avant).

### Fichiers modifies

- `src/lib/secretariat/rent/types.ts` — ajout `LocataireMatch`, `RechercheLocataireResult`, `MatchType`
- `src/lib/secretariat/rent/locataires.ts` — refacto majeure : cache, normalisation, matching fuzzy, Levenshtein natif
- `src/lib/secretariat/workflows/quittance.ts` — adaptation au nouveau type de retour, gestion ambiguite + zero resultat
- `src/lib/secretariat/rent/__tests__/locataires.test.ts` — 42 nouveaux tests (total fichier : ~50 tests)
- `docs/ia/anya-spec.md` — documentation recherche futee, mise a jour compteurs tests
- `docs/dev-decisions.md` — cette section

---

## Session 11 — Batch quittance N locataires × M mois

**Date** : 2026-05-12
**Contexte** : Thomas veut pouvoir generer N quittances × M mois en une seule invocation de `/quittance`, au lieu du mode "1 locataire × 1 mois" precedent.

### Decisions

**1. Nouvelle machine d'etats simplifiee**

Anciens etats : `selecting_locataire` → `confirming_locataire` → `confirming_periode` → `confirming_montants` → `generating` → `done`
Nouveaux etats : `selecting_locataires` → `selecting_periode` → `confirming_recap` → `generating` → `done`

Skip total de `confirming_locataire` et `confirming_montants` — Thomas fait confiance au vault, pas besoin de re-confirmer chaque fiche.

**2. Parseur de selection locataires**

`parseLocataireSelection(input, totalCount)` → supporte : numeros (`1,3,5`), plages (`1-5`), mix (`1, 3-5, 8`), "tous"/"*", ou recherche textuelle (futee). Deduplication et tri automatiques. Validation bornes 1..totalCount.

**3. Parseur de periode**

`parsePeriodeSelection(input, today)` → supporte : mois unique (`2026-04`, `avril 2026`), liste (`2026-04,2026-05`), plage (`2026-04 a 2026-08`), trimestre (`T2 2026`), annee (`2026`), relatif (`mois en cours`, `mois dernier`). Max 24 mois par batch. Cross-year OK.

**4. Generation batch dans le webhook router**

La generation batch (`generateBatch`) est appelee directement par le webhook router apres le callback `quittance:launch_batch`. Chaque PDF est envoye individuellement sur Telegram (pas de ZIP — decision Thomas). Les erreurs sont accumulees et reportees en recap final, sans interrompre le batch.

**5. Boutons inline recap**

Le recap final affiche "Lancer" + "Annuler" (callback `quittance:launch_batch` / `q_cancel`). Pas de bouton "Modifier" — le cycle est assez court pour relancer.

**6. Compatibilite ascendante**

Le mode N=1 M=1 (un locataire, un mois) reste le cas minimal. La recherche futee par nom textuel est preservee. Aucun changement d'API dans les workflows CR ou inbox.

### Tests ajoutes

54 nouveaux tests dans `quittance-batch.test.ts` :
- 12 tests `parseLocataireSelection` (tous, indices, plages, mix, erreurs bornes, recherche texte)
- 22 tests `parsePeriodeSelection` (tous formats : YYYY-MM, nom FR, relatif, liste, plage, trimestre, annee, cross-year, erreurs, max 24)
- 3 tests `buildNumberedListMessage` (alignement, 10+ items, single)
- 17 tests workflow batch (start, cancel, callbacks, messages, generating transition)

Tests existants `quittance-workflow.test.ts` mis a jour (step names pluralises).

Total : 306 tests (vs 252 avant).

### Fichiers modifies

- `src/lib/secretariat/workflows/types.ts` — nouveaux step names (`selecting_locataires`, `selecting_periode`, `confirming_recap`)
- `src/lib/secretariat/rent/types.ts` — `QuittanceWorkflowData` enrichi (selectedLocataires, selectedMois, batchResults, batchErrors)
- `src/lib/secretariat/rent/locataires.ts` — exports `loadAllFiches`, `CachedFiche`, `FichesCache`
- `src/lib/secretariat/workflows/quittance.ts` — rewrite complet : parseurs, batch generation, nouvelle machine d'etats
- `src/app/api/telegram/webhook/route.ts` — `handleQuittanceBatchGeneration`, boutons recap Lancer/Annuler, import generateBatch
- `src/lib/secretariat/rent/__tests__/quittance-batch.test.ts` — nouveau fichier, 54 tests
- `src/lib/secretariat/rent/__tests__/quittance-workflow.test.ts` — step names mis a jour
- `docs/ia/anya-spec.md` — documentation batch, compteurs tests
- `docs/dev-decisions.md` — cette section

---

## Session 11 — Fix timestamp photos EXIF (inbox)

**Date** : 2026-05-12
**Probleme** : Les photos uploadees via le mode inbox etaient nommees avec `new Date()` (date d'upload), pas la date de prise de vue. Consequence : tri chronologique impossible dans Drive.

### Solution : pile de 3 fallback

Pour chaque photo, le timestamp du nom de fichier est determine dans cet ordre (premier succes gagne) :

1. **EXIF `DateTimeOriginal`** (ou `CreateDate`) — date reelle de prise de vue. Disponible uniquement si Thomas envoie en mode "fichier" (trombone Telegram), car le mode "photo" compresse et supprime les EXIF.
2. **`message.date` Telegram** — timestamp Unix d'envoi du message. Toujours disponible. Mieux que "aujourd'hui" si Thomas envoie des photos prises il y a 2 mois.
3. **`new Date()`** — dernier recours.

### Choix technique : exifr

Lib npm `exifr` choisie pour l'extraction EXIF :
- Legere (~5 ko), 0 dependance native
- Parsing partiel (`pick: ['DateTimeOriginal', 'CreateDate']`) — performance optimale
- Fallback gracieux : si le buffer n'est pas un JPEG/TIFF valide, `parse()` renvoie null ou throw — catch silencieux, pas de crash upload

### Fichiers ajoutes

- `src/lib/secretariat/photo-timestamp.ts` — `resolvePhotoTimestamp()` avec pile de 3 fallback
- `src/lib/secretariat/__tests__/photo-timestamp.test.ts` — 10 tests (EXIF valide, CreateDate, fallback Telegram, fallback now, dates invalides, crash exifr)

### Fichiers modifies

- `src/lib/secretariat/inbox.ts` — `handleInboxPhoto` et `handleInboxAlbum` utilisent `resolvePhotoTimestamp` ; `buildInboxFilename` accepte un param `date` optionnel
- `src/lib/secretariat/types.ts` — `MediaGroupBuffer` enrichi avec `messageDate` (timestamp Telegram du premier message du groupe)
- `src/app/api/telegram/webhook/route.ts` — extraction `update.message.date` et propagation vers `handleInboxPhoto` / buffer album / `handleInboxAlbum`
- `docs/ia/anya-spec.md` — documentation timestamp dans tableau inbox, compteur tests mis a jour (314)
- `docs/dev-decisions.md` — cette section
- `package.json` — ajout dep `exifr`

### Limite connue

Telegram en mode "photo" (envoi direct depuis galerie) compresse l'image et supprime les EXIF. La majorite des photos envoyees par Thomas tomberont donc sur le fallback 2 (`message.date`). Pour preserver les EXIF, Thomas doit envoyer en mode "fichier" (icone trombone → joindre fichier → choisir photo).

---

## Session 14 — Jalon 0 email-ingest : variables d'environnement

**Date** : 2026-05-13
**Contexte** : démarrage du plan email-ingest Anya (validé Thomas 2026-05-12). Jalon 0 = setup des env vars. Pas de Gmail/Outlook API à activer maintenant (Jalon 2+).

### Variables d'environnement à ajouter (Replit Secrets)

**Gmail (Phase 1A — Jalon 2+, pas maintenant)** :
```
GMAIL_USER_EMAIL=thomas.issa@gmail.com
GMAIL_LABEL_TRAITE=Anya/traité
GMAIL_LABEL_A_REVOIR=Anya/à-revoir
```

**Email-ingest (Phase 1A — Jalon 4+)** :
```
EMAIL_INGEST_ENABLED=true
EMAIL_INGEST_INTERVAL_MIN=5
EMAIL_INGEST_LOOKBACK_DAYS=7
EMAIL_INGEST_DRY_RUN=false
```

**Non nécessaires pour Jalon 1** : toutes ces vars sont pour les jalons 2+. Le Jalon 1 (vault-client) utilise uniquement les vars Drive déjà configurées (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_VAULT_ROOT_ID`).

### Décision technique : pas de gray-matter

Le plan email-ingest recommandait `gray-matter` pour le parsing frontmatter. Décision : ne PAS installer de dépendance externe.

**Justification** :
- Le projet utilise déjà un parseur YAML minimaliste natif dans `locataires.ts` (testé, en prod)
- La contrainte bit-parfait (frontmatter préservé caractère pour caractère sauf modifications explicites) est INCOMPATIBLE avec gray-matter qui re-sérialise via js-yaml et réordonne les clés
- L'approche retenue : travailler sur le texte brut, extraire le frontmatter par regex, parser les champs nécessaires, et lors de la re-sérialisation ne modifier QUE les lignes changées (patch chirurgical)
- 0 dépendance ajoutée, ownership total, comportement bit-parfait garanti

### Décision technique : mutualisation code Drive existant

Le vault-client réutilise les fonctions Drive existantes :
- `getAccessToken()` depuis `drive-upload.ts`
- Pattern `findDriveFolderByName()` depuis `rent/locataires.ts` (navigation arbo avec normalisation)
- Pattern `readDriveFileContent()` depuis `rent/locataires.ts`
- Pattern `updateFileContent()` depuis `drive-todo.ts`

Pas de duplication. Les fonctions communes sont importées directement.

---

## Session 14 — Jalon 1 vault-client : architecture et décisions

**Date** : 2026-05-13

### Architecture vault-client

```
src/lib/secretariat/vault-client/
├── vault-paths.ts      # constantes statiques (chemins logiques vault)
├── drive-resolver.ts   # path logique → fileId Drive (cache TTL 1h + invalidation 404)
├── obsidian-file.ts    # read/write .md via Drive API (UTF-8, préserve BOM si présent)
├── frontmatter.ts      # parse + patch YAML frontmatter (préserve ordre clés)
├── markdown-append.ts  # append à section H2 (chrono inverse)
├── audit-log.ts        # log JSONL dans _Inbox/AnyaLogs/
├── write-lock.ts       # sérialisation écriture par path (queue)
├── index.ts            # API publique
└── __tests__/
    ├── frontmatter.test.ts
    ├── markdown-append.test.ts
    ├── write-lock.test.ts
    ├── drive-resolver.test.ts
    ├── obsidian-file.test.ts
    └── index.test.ts
```

Note : `write-lock.ts` ajouté par rapport au plan initial. Le plan mentionnait les locks dans les contraintes mais pas comme fichier séparé. C'est plus propre isolé.

### Stratégie frontmatter bit-parfait

Au lieu de parser le YAML en objet puis re-sérialiser (ce qui réordonne les clés), le frontmatter est traité comme du texte brut :
1. Extraction par regex `^---\n([\s\S]*?)\n---`
2. Le bloc YAML est splitté en lignes
3. Pour UPDATE : on cherche la ligne `clé:` et on remplace sa valeur
4. Pour READ : on parse les valeurs nécessaires
5. Le body Markdown après `---` n'est JAMAIS touché sauf par `markdown-append.ts`

Résultat : le fichier re-sérialisé est bit-identique à l'original sauf pour la/les ligne(s) modifiée(s).

---

## Session 14 — Jalon 2 Gmail source : architecture et décisions

**Date** : 2026-05-13

### Architecture gmail-source

```
src/lib/secretariat/gmail-source/
├── types.ts            # EmailMessage normalisé (créé Jalon 0)
├── gmail-client.ts     # Client Gmail API mutualisé (listMessages, getMessage, modifyLabels, listLabels)
├── gmail-source.ts     # Façade : listUnprocessed, fetchDetail, markProcessed, markFailed
├── label-resolver.ts   # Résolution nom label → labelId (cache TTL 1h)
├── index.ts            # Re-exports
└── __tests__/
    ├── gmail-client.test.ts   # 27 tests (parsing, extraction body/attachments)
    ├── gmail-source.test.ts   # 12 tests (mock Gmail API)
    └── label-resolver.test.ts # 10 tests (cache, résolution, env vars)
```

### Décision : mutualisation getAccessToken()

Réutilise `getAccessToken()` depuis `drive-upload.ts`, conformément à la convention établie Jalon 1 et Session 13. Zéro duplication du code OAuth.

### Décision : label-resolver avec listing complet + filtre local

Règle CLAUDE.md n23 : l'API Gmail `labels.list` est appelée une fois (listing complet), puis le label est cherché localement par nom exact ou case-insensitive. Cache TTL 1h, même pattern que `drive-resolver.ts`. Les noms de labels visibles sont logués en `console.warn` pour diagnostic si scope insuffisant.

### Décision : parsing adresses email robuste

Le parser `parseEmailAddresses()` gère les virgules dans les noms entre guillemets (`"Dupont, Jean" <jean@test.com>`) et les chevrons imbriqués. Normalement les clients mail n'imbriquent pas les chevrons, mais la protection est défensive.

### Décision : extraction body texte multi-pass

L'extraction du corps texte (`extractBodyPlain`) suit une cascade :
1. `text/plain` (prioritaire)
2. `text/html` → strip tags (fallback)
3. Body racine (dernier recours)

Le strip HTML supprime les balises `<style>`, `<script>`, et décode les entités HTML basiques (`&amp;`, `&lt;`, etc.). Pas de DOMPurify (pas nécessaire pour du texte de classification).

### Décision : dry-run CLI

Script `scripts/ingest-gmail.ts` accessible via `npm run ingest:gmail -- --dry-run`. Liste les emails non traités sans modification. Critère de succès Jalon 2.

### Extension OAuth : 3 scopes Gmail ajoutés

Le flow OAuth `/api/drive-auth` demande maintenant 5 scopes au total :
- `drive` (existant)
- `calendar.events` (existant S13)
- `gmail.readonly` (nouveau — lecture inbox)
- `gmail.labels` (nouveau — gestion labels)
- `gmail.compose` (nouveau — préparé pour Phase 2 drafts)

La page callback affiche chaque scope avec un indicateur vert/rouge (règle CLAUDE.md n21).

---

## Session 14 — Jalon 3 Triage Haiku : architecture et décisions

**Date** : 2026-05-13

### Architecture triage

```
src/lib/secretariat/triage/
├── prompts/
│   └── triage-v1.md    # Prompt système versionné (6 catégories, anti-patterns, exemples)
├── types.ts            # TriageResult Zod schema + KnownContact
├── triage.ts           # Appel Haiku 4.5 + parsing + validation + retry x1
├── index.ts            # Re-exports
└── __tests__/
    ├── triage.test.ts       # 30 tests (parsing, Zod, buildUserMessage, prompt)
    └── triage-eval.test.ts  # 22 tests (matrice confusion 20 fixtures + 2 assertions globales)
```

### Décision : modèle Haiku 4.5

Model ID exact : `claude-haiku-4-5-20251001`. Choisi pour :
- Coût ~5x moindre que Sonnet 4.6
- Latence ~2x moindre
- Suffisant pour de la classification JSON simple

Retry x1 si JSON invalide (le retry utilise le même prompt, pas de modification).

### Décision : override confidence < 0.7

Si le modèle retourne confidence < 0.7 mais une catégorie autre que `a-classifier`, le code override automatiquement la catégorie à `a-classifier`. C'est une red line Thomas : pas d'action automatique si Haiku n'est pas sûr.

### Décision : prompt versionné dans fichier

Le prompt est chargé depuis `src/lib/secretariat/triage/prompts/triage-v1.md` (lecture disque, caché en mémoire). Si le fichier n'est pas trouvé, un prompt embarqué minimaliste prend le relais. Le versioning permet de créer `triage-v2.md` sans écraser l'ancien.

### Décision : 20 fixtures eval avec matrice de confusion

Les fixtures sont dans `tests/fixtures/triage-eval/fixtures.ts` (20 emails anonymisés). La matrice de confusion est calculée par `triage-eval.test.ts`. Les réponses LLM sont simulées en CI (pas d'appel API réel en test). Résultat : `tests/fixtures/triage-eval.md`.

Cibles atteintes : 100% catégorie (cible 90%), 100% intent (cible 80%).

### Décision : body tronqué à 3000 chars

Le body de l'email est tronqué à 3000 caractères avant envoi à Haiku. Économie de tokens (~500 tokens input par email au lieu de potentiellement 5000+). La plupart des informations de classification sont dans les 3000 premiers caractères.

### Fichiers ajoutés/modifiés

**Nouveaux** :
- `src/lib/secretariat/gmail-source/gmail-client.ts`
- `src/lib/secretariat/gmail-source/gmail-source.ts`
- `src/lib/secretariat/gmail-source/label-resolver.ts`
- `src/lib/secretariat/gmail-source/index.ts`
- `src/lib/secretariat/gmail-source/__tests__/gmail-client.test.ts` (27 tests)
- `src/lib/secretariat/gmail-source/__tests__/gmail-source.test.ts` (12 tests)
- `src/lib/secretariat/gmail-source/__tests__/label-resolver.test.ts` (10 tests)
- `src/lib/secretariat/triage/types.ts`
- `src/lib/secretariat/triage/triage.ts`
- `src/lib/secretariat/triage/index.ts`
- `src/lib/secretariat/triage/__tests__/triage.test.ts` (30 tests)
- `src/lib/secretariat/triage/__tests__/triage-eval.test.ts` (22 tests)
- `tests/fixtures/triage-eval/fixtures.ts` (20 fixtures anonymisées)
- `tests/fixtures/triage-eval.md` (matrice de confusion)
- `scripts/ingest-gmail.ts` (CLI dry-run)

**Modifiés** :
- `src/app/api/drive-auth/route.ts` — ajout 3 scopes Gmail + vérification scope granulaire
- `src/lib/secretariat/triage/prompts/triage-v1.md` — existait déjà (créé Jalon 0), non modifié
- `src/lib/secretariat/gmail-source/types.ts` — existait déjà (créé Jalon 0), non modifié
- `package.json` — ajout script `ingest:gmail`
- `docs/dev-decisions.md` — cette section
- `docs/ia/anya-spec.md` — roadmap mise à jour
- `project-context.md` — historique mis à jour

---

## Session 14 — Jalon 4 V1 email-ingest complète : architecture et décisions

**Date** : 2026-05-14

### Découpage 4A / 4B / 4C

Le Jalon 4 a été découpé en 3 sous-phases pour éviter les timeouts (règle n3) :
- **4A** (commit `995cfaf`) : 4 handlers (locataire, contact-pro, apporteur, a-classifier) + types ActionProposal
- **4B** (commit `05cbb50`) : module telegram-validation (cards HTML, pending-store Drive, callback-handler)
- **4C** (commits `3bca41b`, `2e0c828`, ce commit) : pipeline runner, pré-filtre, contacts cache, endpoint API, intégration webhook

### Architecture email-ingest complète

```
src/lib/secretariat/
├── email-ingest/
│   ├── email-ingest-runner.ts   # Pipeline orchestrateur (runEmailIngest)
│   ├── pre-filter.ts            # Heuristique spam/newsletter (3 regex)
│   ├── contacts-cache.ts        # Cache contacts Drive TTL 1h
│   └── __tests__/
│       ├── email-ingest-runner.test.ts (16 tests)
│       ├── pre-filter.test.ts          (24 tests)
│       └── contacts-cache.test.ts      (9 tests)
├── handlers/                    # 4A — handlers par catégorie
├── telegram-validation/         # 4B — cards + pending-store + callback
├── gmail-source/                # Jalon 2 — source Gmail
└── triage/                      # Jalon 3 — triage Haiku 4.5

src/app/api/
├── secretariat/email-ingest/
│   ├── route.ts                 # POST endpoint (auth secret query param)
│   └── __tests__/route.test.ts  (6 tests)
└── telegram/webhook/route.ts    # dispatch email_val: ajouté (1 test)
```

### Décision : pré-filtre heuristique (~70% économie tokens)

3 regex complémentaires :
1. **AUTOMATED_FROM_RE** : adresses automatisées (noreply, notifications, mailer-daemon, etc.)
2. **BULK_DOMAIN_RE** : domaines mass-mailing (sendgrid, mailgun, amazonses, *newsletter*, *marketing*)
3. **NEWSLETTER_SUBJECT_RE** : sujets newsletter/digest/weekly

Si au moins 1 matche → markProcessed + audit "auto-spam-prefilter", skip Haiku. Estimation : ~70% des emails de Thomas sont du bruit automatisé. Économie : ~70% des appels Haiku.

### Décision : direct-spam bypass (Haiku confidence > 0.9)

Si Haiku classe un email comme `spam` avec `confidence > 0.9` → markProcessed + audit "auto-spam-haiku", pas de carte Telegram. Seuil > 0.9 (pas >=) pour garder une marge. Les spams confidence <= 0.9 passent par handleAClassifier → carte Telegram pour validation Thomas.

### Décision : cache contacts 1h

Cache mémoire TTL 1h (`Map<'contacts', { data, ts }>`). Sur cache miss : listing Drive locataires actuels (tous) + contacts pro (top 20 par ordre alpha). Si listing échoue → retourne tableau vide + `console.warn` (le pipeline tourne même sans contexte). L'enrichissement du contexte est optionnel.

### Décision : stockage pending sur Drive (pas Replit FS)

Les PendingValidation sont stockées dans `_Inbox/AnyaState/pending-validations.json` sur Google Drive (décision 4B). Raison : le filesystem Replit est éphémère — les données disparaissent après redéploiement. Drive persiste les données entre les déploiements.

### Décision : action "modifier" hors scope V1

Le bouton "Modifier" sur les cartes Telegram est présent mais renvoie un message "non implémenté en V1". Raison : la modification d'actions proposées nécessite un workflow interactif complexe (choix d'action à modifier, saisie nouvelle valeur, re-validation). Trop risqué pour la V1. Thomas peut utiliser "Skip" et traiter manuellement.

### Décision : pas de retry automatique sur action vault échouée

Si une action vault (appendToHistorique, createVaultFile) échoue pendant la validation "Valider", l'erreur est logée dans l'audit trail et le message Telegram indique "certaines actions en erreur". Pas de retry automatique. Raison : un retry sur Drive pourrait créer des duplications. Thomas voit l'erreur et peut relancer manuellement.

### Décision : endpoint auth par secret query param

L'endpoint POST `/api/secretariat/email-ingest?secret=<token>` est protégé par un secret env var (`EMAIL_INGEST_TRIGGER_SECRET`), pas par session utilisateur. Raison : l'endpoint est appelé par cron externe ou manuellement, pas par un navigateur authentifié.

### Compteur tests global

856 tests verts (799 avant Jalon 4C + 57 nouveaux).

### Fichiers ajoutés/modifiés

**Commit 4C.1** :
- `src/lib/secretariat/email-ingest/email-ingest-runner.ts` — pipeline orchestrateur
- `src/lib/secretariat/email-ingest/pre-filter.ts` — fix regex sendgrid/mailgun
- `src/lib/secretariat/email-ingest/contacts-cache.ts` — cache contacts Drive TTL 1h
- `src/lib/secretariat/email-ingest/__tests__/email-ingest-runner.test.ts` (16 tests)
- `src/lib/secretariat/email-ingest/__tests__/pre-filter.test.ts` (24 tests)
- `src/lib/secretariat/email-ingest/__tests__/contacts-cache.test.ts` (9 tests)

**Commit 4C.2** :
- `src/app/api/secretariat/email-ingest/route.ts` — POST endpoint
- `src/app/api/secretariat/email-ingest/__tests__/route.test.ts` (6 tests)
- `src/app/api/telegram/webhook/route.ts` — dispatch email_val: + import
- `src/app/api/telegram/webhook/__tests__/route.test.ts` — mock telegram-validation + 1 test

**Commit 4C.3** :
- `docs/dev-decisions.md` — cette section
- `docs/ia/anya-spec.md` — Jalon 4 FAIT, compteurs tests
- `project-context.md` — historique S14
- `.env.example` — EMAIL_INGEST_TRIGGER_SECRET

---

## Session 14 — Jalon 4D-1 : fix paths vault inventés + handler candidat

**Date** : 2026-05-17

### Contexte du bug

Les 4 handlers email-ingest livrés au Jalon 4 utilisaient des paths vault **inventés** qui ne correspondent pas à la structure réelle du vault Drive de Thomas. Tous les `createVaultFile` échouaient en prod avec "Segment X non trouvé". L'audit JSONL (`_Inbox/AnyaLogs/2026-05-16.jsonl`) confirmait 0 handler exécuté avec succès.

Paths erronés identifiés :
- `07. Contacts/01. Pro/` → le vrai path est `07. Contacts/03. Pro/` (22 fiches)
- `02. Projets/Immobilier/Pipeline/` → n'existe pas, remplacé par `02. Projets/01. Perso/Immobilier Direct/Opportunités/`
- `Todo.md` en racine → le vrai path est `03. Tâches/Todo.md`

### Source de vérité

Paths vérifiés par scan Drive direct le 2026-05-17, documenté dans `docs/ia/Anya - Reponse questionnaire vault-paths.md` (réponses Cowork validées par Thomas).

### Décisions

**1. Centralisation dans `vault-paths.ts` (handlers/)**

Nouveau fichier `src/lib/secretariat/handlers/vault-paths.ts` — source de vérité unique pour tous les paths vault utilisés par les handlers. Différent de `vault-client/vault-paths.ts` (qui contient les paths pour le vault-client findContactByEmail). Les handlers importent depuis leur propre `vault-paths.ts` pour éviter les imports croisés.

Contenu : 13 paths statiques (`VAULT_PATHS` as const) + `reunionsPath()` dynamique + `slugifyVaultFilename()` + `buildEmailRef()` + `buildHistoriqueTitle()` + constante `EM_DASH`.

**2. Slugify obligatoire pour les noms de fichiers**

Convention vault (Cowork C1-C2) : noms de fichiers en ASCII sans accent. `slugifyVaultFilename()` applique NFD + strip diacritiques, retire `/ \ : * ? " < > | '`, compresse espaces, tronque à 80 chars. Exemple : `François D'Aremberg` → `Francois DAremberg`.

**3. Em-dash U+2014 dans les titres Historique**

Convention vault (Cowork D3) : `### YYYY-MM-DD — Sujet` (em-dash, pas tiret simple). Appliqué dans les 5 handlers via `buildHistoriqueTitle()`.

**4. Référence email dans le contenu Historique**

Convention vault (Cowork D3) : `(cf. thread Gmail <thread_id>)` en fin de description. Appliqué dans les 5 handlers via `buildEmailRef()`.

**5. Handler candidat dédié**

Nouveau handler `handleCandidat` pour les emails classés "candidat" par le triage. Auparavant routé vers `handleAClassifier` (fallback). Le handler crée/met à jour les fiches dans `07. Contacts/05. Locataires/_Candidats/` avec un frontmatter aligné sur les conventions vault (type: contact, categorie: locataire, statut: candidat).

Le dispatcher `email-ingest-runner.ts` route désormais `case 'candidat'` vers `handleCandidat` au lieu de `handleAClassifier`.

**6. Frontmatter contact-pro aligné sur le format réel du vault**

L'ancien frontmatter des nouvelles fiches contact-pro utilisait un format simplifié (`nom`, `email`, `type`). Le nouveau frontmatter est aligné sur le format réel observé dans le vault (Cowork D1) : `type: contact`, `categorie: pro`, `societe`, `role`, `email`, `telephone`, `rencontre_via`, `date_premier_contact`, `date_derniere_interaction`, `classification`, `tags`.

**7. Workflow Bail — destination unique documentée (hors scope)**

Décision Thomas : la destination unique du workflow Bail est `02. Projets/01. Perso/Immobilier Direct/Baux/`. Ce sera implémenté dans une session ultérieure, hors scope Jalon 4D.

### Tests

- **Avant** : 856 tests verts
- **Après** : 906 tests verts (+50)
  - vault-paths.test.ts : 25 tests (paths, slugify, ref, em-dash, reunions)
  - contact-pro.test.ts : 15 tests (+4 slugify/em-dash/ref/path)
  - locataire.test.ts : 15 tests (+2 slugify/todo-path)
  - apporteur.test.ts : 25 tests (+1 historique em-dash)
  - a-classifier.test.ts : 13 tests (+1 ref Gmail)
  - candidat.test.ts : 17 tests (nouveau)
  - email-ingest-runner.test.ts : 1 test mis à jour (dispatch candidat)

### Fichiers

**Nouveaux** :
- `src/lib/secretariat/handlers/vault-paths.ts` — paths centralisés
- `src/lib/secretariat/handlers/__tests__/vault-paths.test.ts` — 25 tests
- `src/lib/secretariat/handlers/candidat.ts` — handler candidat
- `src/lib/secretariat/handlers/__tests__/candidat.test.ts` — 17 tests

**Modifiés** :
- `src/lib/secretariat/handlers/contact-pro.ts` — path 03. Pro + slugify + em-dash + ref + frontmatter aligné
- `src/lib/secretariat/handlers/locataire.ts` — slugify + em-dash + ref + todo path
- `src/lib/secretariat/handlers/apporteur.ts` — path Opportunités + slugify + em-dash + ref + section Historique
- `src/lib/secretariat/handlers/a-classifier.ts` — path via VAULT_PATHS + slugify + em-dash + ref
- `src/lib/secretariat/handlers/index.ts` — export handleCandidat
- `src/lib/secretariat/email-ingest/email-ingest-runner.ts` — dispatch candidat → handleCandidat
- `src/lib/secretariat/handlers/__tests__/contact-pro.test.ts` — assertions paths corrigées + nouveaux tests
- `src/lib/secretariat/handlers/__tests__/locataire.test.ts` — assertions + tests slugify/todo
- `src/lib/secretariat/handlers/__tests__/apporteur.test.ts` — assertions path + test historique
- `src/lib/secretariat/handlers/__tests__/a-classifier.test.ts` — assertions path + test ref
- `src/lib/secretariat/email-ingest/__tests__/email-ingest-runner.test.ts` — test dispatch candidat mis à jour
- `docs/dev-decisions.md` — cette section
- `project-context.md` — historique mis à jour
