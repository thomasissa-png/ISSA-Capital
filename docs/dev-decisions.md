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
