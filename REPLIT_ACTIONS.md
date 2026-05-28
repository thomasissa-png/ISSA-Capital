# Déploiement ISSA Capital sur Replit — Procédure étape par étape

> ## ⚠️ OBSOLÈTE depuis S25.1 (2026-05-28)
>
> Le site `issa-capital.com` a été **migré sur le VPS IONOS** (Caddy + Let's
> Encrypt). Replit a été conservé en hot standby J+7 le temps de stabiliser
> la prod VPS, puis désactivé (~4 juin).
>
> **Ce document est gardé en archive historique uniquement.** Ne pas suivre
> ces étapes pour un nouveau déploiement. SOT actuelle :
> - `deploy/caddy/README.md` (procédure migration site sur VPS)
> - `deploy/README.md` (architecture VPS générale)
> - `docs/infra/infrastructure.md` (SOT infra)
>
> À supprimer du dépôt après la désactivation Replit confirmée (J+7 ~ 4 juin).
>
> ---

> **Pour qui ?** Thomas (fondateur, non-technique).
> **Objectif** : déployer issa-capital.com en confiance, sans surprise, avec un plan de retour arrière clair.
> **Durée estimée** : 1h30 à 2h30 le jour J (hors propagation DNS qui peut prendre jusqu'à 24h).
> **Branche source** : `claude/issa-session-4-reprise-9oB9r` (commit `42b3075`) — à merger sur `main` AVANT déploiement.
> **Dernière mise à jour** : 2026-04-07 — @infrastructure (Phase 3, Étape 3 phase 2).

---

## Comment lire ce document

Ce document est une **procédure linéaire** : tu fais Étape 1, puis Étape 2, etc. Chaque étape contient :
- Une **action concrète** (où cliquer, quoi taper)
- Un **test de validation** (comment savoir que c'est OK)
- Un **point d'attention** si quelque chose peut mal tourner

Si une étape échoue, va voir l'**Annexe Troubleshooting** en bas du document.

**Règle d'or** : ne saute aucune étape, même si elle semble évidente. Le déploiement est l'étape la plus risquée du projet — chaque case cochée réduit le risque.

---

## Pré-requis avant de commencer (à valider AVANT de lancer Replit)

- [ ] **Compte Replit actif** avec un plan permettant les **Replit Deployments** (plan **Core** minimum recommandé — environ 20 $/mois — qui inclut Autoscale Deployments et domaines custom). [À VÉRIFIER : tarif exact à confirmer sur https://replit.com/pricing au jour J]
- [ ] **Repo GitHub `thomasissa-png/issa-capital` accessible** depuis le compte Replit (autorisation OAuth GitHub validée)
- [ ] **Branche `main` à jour** : la branche `claude/issa-session-4-reprise-9oB9r` doit être **mergée vers `main`** via Pull Request avant tout déploiement. Si ce n'est pas fait, demander à @orchestrator de procéder au merge
- [ ] **Domaine `issa-capital.com` acheté et accessible** chez le registrar (OVH, Gandi, Cloudflare, ou autre). Tu dois pouvoir te connecter au panneau DNS du registrar
- [ ] **Compte Resend actif** : domaine `issa-capital.com` ajouté, **DKIM/SPF/DMARC vérifiés** (statut "Verified" dans le dashboard Resend), API Key production générée et copiée dans un endroit sûr
- [ ] **DPA Resend signé** (obligation RGPD article 28 — voir `docs/legal/legal-audit.md`)
- [ ] **Compte Plausible Analytics** actif avec `issa-capital.com` ajouté (script déjà présent dans le code, il ne reste qu'à valider la réception du premier pageview)
- [ ] **Données fondateur confirmées** dans les mentions légales : capital social `1 047 562,00 €` et TVA `FR50102356094` déjà en code
- [ ] **Checklist GO/NO-GO validée** : `docs/reviews/go-nogo-checklist.md` — toutes les cases de la Section 1 cochées
- [ ] **Tu es disponible 2h après le déploiement** pour exécuter les smoke tests manuels (Étape 4) et le rollback éventuel
- [ ] **Tu as ce document ouvert** dans un onglet et la checklist GO/NO-GO dans un autre

---

## Étape 1 — Configuration des Secrets Replit

**Pourquoi ?** Le code a besoin de plusieurs valeurs sensibles (clé API Resend, email destinataire, etc.) qui ne doivent JAMAIS apparaître dans le code source. Replit les stocke chiffrées dans un coffre-fort appelé "Secrets".

**Où ?** Dans Replit, ouvre ton Repl `issa-capital`, puis clique sur l'icône **Tools** (barre latérale gauche) → **Secrets** (icône cadenas).

**Action** : pour chaque ligne du tableau ci-dessous, clique sur **+ New Secret**, colle le **Nom exact** dans le champ Key, et la **Valeur** dans le champ Value, puis **Add Secret**.

| # | Nom (Key) | Valeur attendue | Source / Où trouver | Obligatoire ? |
|---|---|---|---|---|
| 1 | `RESEND_API_KEY` | Clé qui commence par `re_...` (ne pas réutiliser une clé de test) | Dashboard Resend → API Keys → ta clé production | Oui |
| 2 | `RESEND_FROM_EMAIL` | `ISSA Capital <contact@issa-capital.com>` | Email vérifié sur ton domaine Resend | Oui |
| 3 | `RESEND_TO_EMAIL` | `contact@issa-capital.com` | Email destinataire des formulaires | Oui |
| 4 | `NEXT_PUBLIC_SITE_URL` | `https://issa-capital.com` | URL canonique de production (SANS slash final) | Oui |
| 5 | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `issa-capital.com` | Nom de domaine sans `https://` | Oui |
| 6 | `RATE_LIMIT_MAX` | `5` | Nombre max de soumissions du formulaire par fenêtre de temps | Oui |
| 7 | `RATE_LIMIT_WINDOW_MS` | `60000` | Durée de la fenêtre en millisecondes (60 000 ms = 60 secondes) | Oui |
| 8 | `TURNSTILE_SECRET_KEY` | (laisser vide) | Cloudflare Turnstile — anti-spam optionnel, à activer plus tard si spam massif | Non |
| 9 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | (laisser vide) | Cloudflare Turnstile — clé publique | Non |

**Test de validation** :
- [ ] Les 7 secrets obligatoires (lignes 1 à 7) apparaissent dans la liste Secrets de Replit
- [ ] Aucune valeur ne contient d'espace en début ou fin (erreur classique)
- [ ] `NEXT_PUBLIC_SITE_URL` ne se termine PAS par un slash (`/`)

**Point d'attention** : ces secrets sont des **variables d'environnement runtime**. Tout changement nécessite un **redéploiement** pour prendre effet. Si tu changes une valeur après le déploiement, retourne dans Deployments et clique "Redeploy".

---

## Étape 2 — Configuration du Build & Run sur Replit

**Pourquoi ?** Replit a besoin de savoir comment compiler le code (`build`) et comment lancer le serveur (`start`).

**Où ?** Deux options selon comment tu as importé le projet :
- **Option A** : si tu as importé via "Import from GitHub", Replit a peut-être déjà créé un fichier `.replit` automatiquement
- **Option B** : si le fichier `.replit` n'existe pas encore, le créer manuellement

**Action — vérifier ou créer le fichier `.replit`** :

1. Dans l'arborescence du Repl (panneau gauche), cherche un fichier nommé `.replit` à la racine
2. S'il existe, ouvre-le et **vérifie qu'il contient au minimum** :

```toml
run = "npm run start"
entrypoint = "src/app/page.tsx"
hidden = [".next", "node_modules"]

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run start"]
build = ["sh", "-c", "npm run build"]
deploymentTarget = "autoscale"
ignorePorts = false
```

3. S'il n'existe pas, **crée-le** : clic droit sur la racine du projet → New file → nom : `.replit` (avec le point au début) → coller le contenu ci-dessus → sauvegarder

**Test de validation** :
- [ ] Le fichier `.replit` existe à la racine du projet
- [ ] Il contient bien `run = "npm run start"` et la section `[deployment]`
- [ ] La cible de déploiement est `autoscale` (site vitrine, faible trafic = pas besoin de Reserved VM)

**Configuration des ports** :
- Next.js démarre par défaut sur le port `3000`. Replit Deployments mappe automatiquement ce port vers HTTPS public, **tu n'as rien à configurer côté ports**.

**Point d'attention** :
- Si tu vois un fichier `replit.nix` à la racine, **n'y touche pas** : il est généré automatiquement par Replit pour gérer les dépendances système (Node.js, etc.). Le bloc `[nix] channel = "stable-24_05"` dans `.replit` suffit
- Si Replit te propose d'utiliser une "Repl native run" différente, ignore — utilise toujours `npm run start` pour la production

---

## Étape 3 — Premier déploiement (preview interne Replit)

**Pourquoi ?** Avant de connecter le domaine `issa-capital.com`, on déploie d'abord sur l'URL temporaire `*.replit.app` pour vérifier que tout fonctionne. C'est un filet de sécurité : si quelque chose casse, personne ne le voit puisque le vrai domaine n'est pas encore relié.

**Où ?** Dans Replit, panneau latéral gauche → **Deployments**.

**Action** :
1. Clique **Create Deployment** (ou **New Deployment** si premier déploiement)
2. Type : choisir **Autoscale** (pas Reserved VM, pas Static — Autoscale est adapté à un site Next.js vitrine avec trafic variable)
3. Nom : `issa-capital-prod`
4. Region : choisir la région la plus proche de l'audience (Europe — `eu-west` si disponible). Sinon laisser le défaut
5. Build command : `npm run build`
6. Run command : `npm run start`
7. Machine power : laisser le minimum proposé (le site est léger, < 100 kB par route)
8. Max machines : `3` (largement suffisant pour un site vitrine)
9. Clique **Deploy** et **attends que le build se termine** (3 à 8 minutes selon la machine)

**Test de validation** :
- [ ] Le build se termine sans erreur (statut **Live** dans Deployments)
- [ ] Replit affiche une URL au format `https://issa-capital-prod.<ton-username>.replit.app` (ou similaire)
- [ ] Cette URL répond avec un code 200 quand tu la charges dans le navigateur
- [ ] La page d'accueil s'affiche (logo ISSA Capital, hero, contenu visible)

**Si le build échoue** : ouvrir l'onglet **Logs** du Deployment, identifier l'erreur, voir l'**Annexe Troubleshooting** pour les erreurs courantes. Ne pas passer à l'Étape 4 tant que le build ne passe pas.

**Point d'attention** :
- Le **premier build est le plus long** car Replit installe toutes les dépendances. Les builds suivants sont plus rapides grâce au cache
- L'URL `*.replit.app` est **publiquement accessible** mais difficile à deviner — c'est suffisant pour un test, mais ne la diffuse pas

---

## Étape 4 — Smoke tests sur le preview

**Pourquoi ?** Avant de relier le domaine custom, on vérifie manuellement que les fonctionnalités critiques marchent. Si un test échoue ici, on corrige sur l'URL temporaire — pas en production.

**À exécuter sur l'URL `https://issa-capital-prod.<...>.replit.app`** (pas encore sur issa-capital.com).

### 4.1 Navigation des pages

- [ ] `/` (accueil) — chargement < 3s, hero visible, navigation cliquable
- [ ] `/mission` — contenu visible, JSON-LD Person Thomas présent (clic droit → Code source de la page → chercher "application/ld+json")
- [ ] `/accompagnement` — contenu visible, formulaire de contact en bas
- [ ] `/participations` — contenu visible
- [ ] `/opportunites` — contenu visible, formulaire de contact en bas
- [ ] `/contact` — contenu visible
- [ ] `/mentions-legales` — contenu visible, capital social `1 047 562,00 €` et TVA `FR50102356094` affichés, hébergeur Replit cité
- [ ] `/page-inexistante-test` — page 404 custom (pas une page blanche)
- [ ] **Console navigateur (F12 → Console)** : aucune erreur rouge sur aucune des pages

### 4.2 ContactForm — test bout en bout (CRITIQUE)

Tester les **2 variants** du formulaire :

- [ ] **Variant `/accompagnement`** :
  1. Remplir tous les champs avec des données réalistes (nom : "Test Thomas", email : ton email perso, message court)
  2. Soumettre
  3. Vérifier le **message de succès** affiché côté UI
  4. **Vérifier réception email** sur `contact@issa-capital.com` dans les 60 secondes (regarder aussi les spams au cas où, mais ça ne devrait PAS y aller si DKIM/SPF/DMARC sont OK)
  5. Vérifier que l'email contient bien tous les champs remplis + horodatage

- [ ] **Variant `/opportunites`** :
  1. Remplir le formulaire (inclure le champ Localisation pour la variante deal immo)
  2. Soumettre
  3. Vérifier le **rappel délai "dans la journée"** affiché
  4. Vérifier réception email distinct du précédent

- [ ] **Test honeypot anti-spam** : ouvrir la console (F12), localiser le champ honeypot caché (input avec un nom comme `website` ou `url`), le remplir via JavaScript, soumettre → **aucun email ne doit arriver** (soumission silencieusement ignorée)

- [ ] **Test rate limit** : soumettre 6 fois le formulaire en moins de 60 secondes depuis la même connexion → la 6e soumission doit retourner une erreur 429 (Too Many Requests)

### 4.3 SEO et fichiers techniques

- [ ] `/sitemap.xml` — accessible, XML valide, liste les 7 URLs
- [ ] `/robots.txt` — accessible, autorise `Allow: /` et bloque `Disallow: /api/`
- [ ] Code source `/` — balises `<title>`, `<meta name="description">`, `<meta property="og:image">`, `<link rel="canonical">` toutes présentes
- [ ] Code source `/` — bloc `<script type="application/ld+json">` Organization présent
- [ ] Code source `/mission` — bloc JSON-LD Person Thomas présent

### 4.4 Lighthouse rapide (DevTools → Lighthouse)

Sur `/` en mode **Mobile** :

- [ ] Performance ≥ 85
- [ ] Accessibility ≥ 95
- [ ] Best Practices ≥ 95
- [ ] SEO ≥ 95
- [ ] LCP < 3s
- [ ] CLS < 0.1

**Si un test 4.1-4.4 échoue** : NE PAS passer à l'Étape 5. Ouvrir un ticket à @fullstack ou @qa, corriger sur la branche, re-merger, et redéployer (Replit redéploie automatiquement si auto-deploy actif, sinon clic manuel).

---

## Étape 5 — Déploiement production (activation)

**Pourquoi ?** Si tous les smoke tests Étape 4 sont verts, on confirme que le Deployment est en production. Avec Replit Autoscale, le déploiement créé à l'Étape 3 EST déjà la production — il n'y a pas de "promotion staging → prod" séparée. Cette étape consiste à :
1. Confirmer que le statut est **Live**
2. Activer le **redéploiement automatique** sur push `main`
3. Documenter l'URL et l'IP

**Action** :
1. Dans **Deployments**, vérifier que le statut du déploiement `issa-capital-prod` est bien **Live** (pastille verte)
2. Aller dans **Deployments → Settings → Source control**
3. Activer l'option **Auto-deploy on push to `main`** (si disponible — sinon, il faudra cliquer "Redeploy" manuellement après chaque merge sur main)
4. Noter l'URL `*.replit.app` finale dans un mémo perso (utile pour debug)

**Test de validation** :
- [ ] Statut Deployment : **Live** (pastille verte)
- [ ] Auto-deploy activé (ou procédure manuelle documentée si l'option n'existe pas dans ton plan)
- [ ] URL `*.replit.app` répond toujours en 200

**Point d'attention** :
- Avec Autoscale, **le coût varie selon le trafic**. Pour un site vitrine à faible trafic, le coût mensuel devrait rester très bas. Surveiller le dashboard Replit Usage la première semaine pour calibrer
- Si tu vois des cold starts (premier chargement lent après inactivité), c'est normal en Autoscale. Pour un site institutionnel, c'est acceptable

---

## Étape 6 — Configuration du domaine personnalisé `issa-capital.com`

**Pourquoi ?** Le site doit répondre sur `https://issa-capital.com` (et `https://www.issa-capital.com` qui redirige vers la version sans www). Pour cela, on relie le domaine au Deployment Replit via les DNS.

**Convention ISSA Capital** : apex sans `www` est l'URL canonique (`issa-capital.com`). `www.issa-capital.com` redirige (301) vers l'apex.

### 6.1 Côté Replit — Ajouter le domaine

**Action** :
1. Dans **Deployments → Settings → Custom domains** (ou **Linked domains**)
2. Cliquer **Link a domain**
3. Entrer : `issa-capital.com`
4. Replit affiche **2 enregistrements DNS** à configurer chez le registrar :
   - Un `A record` (ou parfois `ANAME`/`ALIAS`) pour l'apex `@` → IP de Replit
   - Un `TXT record` de vérification de propriété (token unique)
5. **Copier ces 2 valeurs dans un fichier texte temporaire** (tu vas les utiliser à l'Étape 6.2)
6. Recommencer pour `www.issa-capital.com` :
   - Replit affiche cette fois un `CNAME record` `www` → alias Replit (typiquement `<deployment-name>.replit.app` ou similaire)
   - Copier la valeur

**Test de validation** :
- [ ] `issa-capital.com` apparaît dans la liste des Custom domains avec statut "Pending verification"
- [ ] `www.issa-capital.com` apparaît avec le même statut
- [ ] Tu as noté les 3 valeurs DNS (A record IP, TXT verify token, CNAME www alias)

### 6.2 Côté registrar — Configurer les DNS

**Où ?** Sur le panneau de gestion DNS de ton registrar (OVH, Gandi, Cloudflare, etc.).

**Action — créer les enregistrements** (le format dépend du registrar, voici la logique commune) :

| Type | Nom / Sous-domaine | Valeur | TTL |
|---|---|---|---|
| `A` | `@` (ou vide selon registrar) | IP fournie par Replit (ex: `35.x.x.x`) | 3600 |
| `CNAME` | `www` | Alias fourni par Replit (ex: `<deployment>.replit.app.`) | 3600 |
| `TXT` | `@` | Token de vérification fourni par Replit (`replit-verify=...`) | 3600 |

**Spécificités registrar courantes** :
- **OVH** : Zone DNS → Modifier en mode expert → ajouter chaque ligne. Attention au point final dans les CNAME
- **Gandi** : LiveDNS → Records → Add record
- **Cloudflare** : DNS → Records → Add record. **DÉSACTIVER le proxy orange (mode "DNS only")** au début pour ne pas perturber la vérification Replit. Tu pourras réactiver le proxy plus tard si désiré
- **Si un enregistrement A `@` existe déjà** (souvent un parking page), le **supprimer** avant d'ajouter le nouveau

**Test de validation immédiate** (depuis ton terminal local ou un service en ligne comme https://dnschecker.org) :
- [ ] `dig issa-capital.com A` (ou outil web équivalent) retourne l'IP Replit
- [ ] `dig www.issa-capital.com CNAME` retourne l'alias Replit
- [ ] `dig issa-capital.com TXT` retourne le token de vérification Replit

**Propagation DNS** :
- Typiquement **5 minutes à 4 heures**
- Maximum théorique : **24 à 48 heures**
- Pendant la propagation, certains visiteurs verront le nouveau site et d'autres l'ancien (ou rien) — c'est normal, ça se résout tout seul

### 6.3 Vérification dans Replit

**Action** : retourner dans **Deployments → Settings → Custom domains** et cliquer **Verify** (ou **Recheck**) pour les 2 domaines.

**Test de validation** :
- [ ] Statut `issa-capital.com` passe à **Verified** (pastille verte)
- [ ] Statut `www.issa-capital.com` passe à **Verified**
- [ ] Replit déclenche automatiquement la **génération du certificat HTTPS Let's Encrypt** (5 à 30 minutes)
- [ ] Une fois le certificat actif, le statut passe à **Active** ou affiche un cadenas

**Point d'attention** :
- **NE PAS** chercher à forcer le HTTPS si la verification est en "Pending". Attendre que Replit confirme
- Si la vérification reste bloquée plus de 4h alors que `dig` montre les bons records, voir l'Annexe Troubleshooting

### 6.4 Test de l'accès via le domaine custom

- [ ] Ouvrir `https://issa-capital.com` dans le navigateur → page d'accueil ISSA Capital chargée, **cadenas vert** dans la barre d'URL
- [ ] Ouvrir `https://www.issa-capital.com` → redirection 301 vers `https://issa-capital.com` (l'URL change automatiquement dans la barre)
- [ ] Ouvrir `http://issa-capital.com` (sans HTTPS) → redirection 301 vers `https://issa-capital.com`

---

## Étape 7 — Smoke tests post-domaine (sur issa-capital.com)

**Pourquoi ?** Maintenant que le site répond sur le vrai domaine, on refait une passe de tests pour s'assurer que rien n'a cassé pendant la transition (notamment les URLs canoniques, les liens absolus, les emails Resend qui dépendent du domaine vérifié).

**À exécuter sur `https://issa-capital.com`** (le vrai domaine).

- [ ] **Refaire les sections 4.1 (navigation), 4.2 (formulaire), 4.3 (SEO)** sur `https://issa-capital.com`
- [ ] **Vérifier la cohérence des URLs canoniques** : code source `/` → la balise `<link rel="canonical" href="https://issa-capital.com/">` doit pointer vers `issa-capital.com`, **pas** vers `*.replit.app`. Si désalignement → vérifier que `NEXT_PUBLIC_SITE_URL` est bien `https://issa-capital.com` dans les Secrets, puis **redéployer**
- [ ] **Vérifier le sitemap.xml** : `https://issa-capital.com/sitemap.xml` doit lister les URLs avec le préfixe `https://issa-capital.com`, pas `*.replit.app`
- [ ] **Vérifier le JSON-LD Organization** : code source `/` → `"url": "https://issa-capital.com"` dans le bloc JSON-LD
- [ ] **Test email Resend depuis le domaine custom** : soumettre 1 fois chaque variant du formulaire → vérifier réception

**Si un désalignement d'URL est détecté** : retourner dans Secrets, corriger `NEXT_PUBLIC_SITE_URL`, redéployer, refaire le test.

---

## Étape 8 — Soumission aux moteurs de recherche

**Pourquoi ?** Sans soumission active, Google peut mettre des semaines à indexer le site. Avec une soumission manuelle, l'indexation démarre en quelques heures à quelques jours.

### 8.1 Google Search Console

1. Aller sur https://search.google.com/search-console
2. **Add property** → **URL prefix** → entrer `https://issa-capital.com`
3. Vérification de propriété : choisir la méthode **HTML tag** ou **DNS TXT record** (selon préférence)
   - Méthode HTML tag : copier la balise `<meta name="google-site-verification" ...>` → la coller dans `src/app/layout.tsx` (demander à @fullstack ou @ia) → redéployer → revenir sur GSC → cliquer Verify
   - Méthode DNS TXT : ajouter un TXT record chez le registrar → revenir cliquer Verify (15 min de propagation)
4. Une fois la propriété vérifiée : **Sitemaps** → ajouter `sitemap.xml` (juste le chemin, pas l'URL complète)
5. **URL Inspection** : entrer `https://issa-capital.com/` → cliquer **Request indexing**
6. Refaire `Request indexing` pour les 6 autres pages principales (`/mission`, `/accompagnement`, `/participations`, `/opportunites`, `/contact`, `/mentions-legales`)
7. **Rich Results Test** : https://search.google.com/test/rich-results → tester `/` (Organization JSON-LD doit être valide) et `/mission` (Person JSON-LD doit être valide)

### 8.2 Bing Webmaster Tools

1. https://www.bing.com/webmasters
2. Add a site → `https://issa-capital.com`
3. Importer depuis Google Search Console (gain de temps : Bing récupère la vérif GSC) OU vérifier indépendamment
4. Submit sitemap : `https://issa-capital.com/sitemap.xml`

### 8.3 Validation partages sociaux

- [ ] **LinkedIn Post Inspector** : https://www.linkedin.com/post-inspector/ → entrer `https://issa-capital.com` → vérifier que l'image OG, le titre et la description s'affichent correctement
- [ ] **Facebook Sharing Debugger** : https://developers.facebook.com/tools/debug/ → idem (cliquer "Scrape Again" pour forcer le rafraîchissement)
- [ ] **Twitter Card Validator** (si compte X actif) : https://cards-dev.twitter.com/validator

**Test de validation** :
- [ ] Sitemap soumis dans GSC sans erreur
- [ ] Au moins 1 URL passée en "Request indexing"
- [ ] Rich Results Test PASS pour Organization et Person
- [ ] LinkedIn Post Inspector affiche correctement l'OG image

---

## Étape 9 — Monitoring post-deploy

**Pourquoi ?** Les premières 72h sont les plus risquées. Il faut surveiller activement.

### 9.1 UptimeRobot (gratuit)

1. https://uptimerobot.com → créer un compte (gratuit, 50 monitors)
2. **Add New Monitor** :
   - Type : **HTTP(s)**
   - URL : `https://issa-capital.com/`
   - Friendly name : `ISSA Capital — Home`
   - Monitoring interval : **5 minutes**
   - Alert contacts : ton email principal (et SMS si plan payant)
3. Créer un 2e monitor pour `https://issa-capital.com/api/health` si l'endpoint existe (sinon ignorer)
4. Vérifier que le monitor est **Up** (vert) après 10 minutes

### 9.2 Plausible Analytics

- [ ] Ouvrir le dashboard Plausible → vérifier que **le premier pageview** est enregistré
- [ ] Vérifier que les 3 Goals sont configurés : `contact_form_submit`, `cta_primary_click`, `external_link_click` (voir `docs/analytics/tracking-plan.md`)
- [ ] Si Goals absents : les créer dans Settings → Goals

### 9.3 Logs Replit (premières 24h)

- [ ] Ouvrir **Deployments → Logs** régulièrement les 24 premières heures
- [ ] Surveiller les erreurs `500`, `429`, `ECONNREFUSED`, `Resend error`
- [ ] Si erreurs récurrentes : voir Annexe Troubleshooting ou alerter @fullstack

### 9.4 Lighthouse à J+3

- [ ] Refaire un audit Lighthouse complet à J+3 sur `/` et `/mission` en mode mobile + desktop
- [ ] Vérifier que les scores Core Web Vitals sont **stables** (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- [ ] Si dégradation > 10 points par rapport à l'Étape 4 : alerter @infrastructure

### 9.5 Mémo DNS pour le futur

Documenter dans un fichier perso (ou directement dans `docs/infra/infrastructure.md`) :
- IP Replit assignée à `issa-capital.com` (utile si tu dois changer de registrar)
- Alias CNAME `www`
- Date de génération du certificat HTTPS Let's Encrypt (renouvelé automatiquement, mais bon à savoir)

---

## Critères de rollback (à connaître AVANT le déploiement)

**Rollback immédiat** si **un seul** des critères suivants est observé dans les **2h post-déploiement** :

| # | Condition | Comment vérifier |
|---|---|---|
| R1 | Erreur 500 persistante sur `/` ou une page principale | Recharger la page plusieurs fois |
| R2 | ContactForm cassé : email Resend non reçu après 3 tests successifs | Test manuel + dashboard Resend |
| R3 | Contenu absent ou tronqué sur une page publique | Lecture visuelle |
| R4 | Certificat HTTPS invalide ou navigateur warning rouge | Cadenas dans la barre d'URL |
| R5 | Erreur de conformité légale majeure (mention interdite, chiffre faux, nom mineur exposé) | Revue Thomas |
| R6 | Fuite de secret (clé API visible dans le code client) | F12 → Sources → chercher `re_` |
| R7 | Lighthouse Performance < 50 sur mobile (dégradation majeure) | Audit Lighthouse |
| R8 | Spam massif du formulaire malgré rate limit | Dashboard Resend |

### Procédure de rollback Replit (1 clic, 2 minutes)

1. Aller dans **Deployments → History** (ou **Versions**)
2. Identifier le **déploiement précédent** qui était en statut **Live** et fonctionnel
3. Cliquer **Rollback** (ou **Redeploy this version**) sur cette version
4. Attendre 1 à 3 minutes que Replit bascule
5. Vérifier que `https://issa-capital.com` répond avec l'ancienne version
6. **Notifier @orchestrator + ouvrir un ticket post-mortem** dans `docs/lessons-learned.md`

**Si le rollback échoue** (bug aussi présent dans la version précédente) :
1. **Stopper le Deployment** : Deployments → Settings → **Stop deployment** (le site répond temporairement avec une page d'erreur Replit, mais on évite de propager du contenu cassé)
2. Notifier @fullstack en urgence pour un hotfix
3. Une fois le hotfix mergé sur `main`, redéployer

---

## Annexe A — Récapitulatif des variables d'environnement

| # | Nom | Type | Visible côté client ? | Obligatoire | Description courte |
|---|---|---|---|---|---|
| 1 | `RESEND_API_KEY` | Secret | Non (server-only) | Oui | Clé API Resend production |
| 2 | `RESEND_FROM_EMAIL` | Secret | Non | Oui | Email émetteur (vérifié sur Resend) |
| 3 | `RESEND_TO_EMAIL` | Secret | Non | Oui | Email destinataire (Thomas) |
| 4 | `NEXT_PUBLIC_SITE_URL` | Public | Oui | Oui | URL canonique production |
| 5 | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Public | Oui | Oui | Domaine pour script Plausible |
| 6 | `RATE_LIMIT_MAX` | Server | Non | Oui | Nb max soumissions / fenêtre |
| 7 | `RATE_LIMIT_WINDOW_MS` | Server | Non | Oui | Durée fenêtre rate limit (ms) |
| 8 | `TURNSTILE_SECRET_KEY` | Secret | Non | Non | Cloudflare Turnstile (anti-spam) |
| 9 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public | Oui | Non | Cloudflare Turnstile (clé publique) |

**Règle de sécurité absolue** : ne JAMAIS coller une vraie valeur de secret dans un commit Git, un message Slack, un email, ou un ticket. Les Secrets Replit sont chiffrés et ne fuitent pas dans les logs.

---

## Annexe B — Troubleshooting (erreurs courantes)

### B1. Build Replit échoue avec "Out of memory"

**Symptôme** : log Replit → `JavaScript heap out of memory` pendant `npm run build`.

**Solution** :
1. Augmenter la mémoire du Build dans Deployments → Settings → Build → Machine power (passer à un tier supérieur)
2. OU ajouter dans `package.json` : `"build": "NODE_OPTIONS='--max-old-space-size=4096' next build"` (demander à @fullstack)

### B2. 502 Bad Gateway après déploiement

**Symptôme** : le déploiement passe Live mais l'URL retourne 502.

**Solution** :
1. Vérifier les **Logs** du Deployment : chercher une erreur au démarrage du serveur
2. Vérifier que le **port** exposé est `3000` (Next.js par défaut) — Replit doit le détecter automatiquement
3. Vérifier que `npm run start` est bien la commande Run (pas `npm run dev`)
4. Vérifier que `NEXT_PUBLIC_SITE_URL` est bien défini dans les Secrets (sinon le build peut générer du HTML invalide)

### B3. Email Resend non reçu

**Symptôme** : formulaire soumis avec succès UI, mais aucun email n'arrive sur `contact@issa-capital.com`.

**Solution** :
1. **Dashboard Resend → Logs** : vérifier si l'email apparaît. S'il y est avec statut "Delivered" → problème côté boîte de réception (vérifier spams)
2. S'il y est avec statut "Bounced" → vérifier que `RESEND_TO_EMAIL` est correct et que la boîte existe
3. S'il n'apparaît pas du tout → vérifier que `RESEND_API_KEY` est valide et correspond bien à la production
4. Vérifier que le **domaine `issa-capital.com` est Verified** dans Resend (DKIM/SPF/DMARC tous verts)
5. Si DKIM/SPF non vérifiés → ajouter les TXT records fournis par Resend chez le registrar

### B4. HTTPS ne s'active pas après vérification du domaine

**Symptôme** : le domaine est "Verified" dans Replit mais le cadenas reste rouge / "Not Secure".

**Solution** :
1. Attendre **30 minutes** : Let's Encrypt prend du temps après la vérification
2. Vérifier qu'il n'y a pas de **CAA record DNS** restrictif chez le registrar (parfois bloque Let's Encrypt). Si CAA présent et restrictif → ajouter `0 issue "letsencrypt.org"`
3. Vérifier que **Cloudflare proxy est désactivé** (mode "DNS only") si tu utilises Cloudflare
4. Si bloqué > 4h : contacter le support Replit

### B5. DNS ne propage pas

**Symptôme** : `dig issa-capital.com` ne retourne pas la nouvelle IP même après 4h.

**Solution** :
1. Vider le cache DNS local : `sudo dscacheutil -flushcache` (Mac) ou `ipconfig /flushdns` (Windows)
2. Tester via un service tiers : https://dnschecker.org → vérifier la propagation dans plusieurs régions
3. Vérifier que l'ancien A record a bien été **supprimé** chez le registrar (sinon conflit)
4. Vérifier que le TTL de l'ancien record n'était pas trop élevé (> 3600s peut prolonger la propagation)

### B6. Le site charge en HTTP mais pas en HTTPS

Voir B4. C'est le même problème (certificat non généré).

### B7. La page d'accueil affiche les bonnes URLs mais le sitemap pointe vers *.replit.app

**Symptôme** : URLs canoniques OK mais `sitemap.xml` contient des URLs `*.replit.app`.

**Solution** :
1. Vérifier `NEXT_PUBLIC_SITE_URL` dans Secrets → doit être `https://issa-capital.com` (sans slash final)
2. **Redéployer** : les variables d'environnement sont lues au build time pour le sitemap statique

---

## Handoff → @orchestrator + Thomas

- **Fichiers produits** : `/home/user/ISSA-Capital/REPLIT_ACTIONS.md` (refonte complète), `/home/user/ISSA-Capital/docs/infra/infrastructure.md` (section "Déploiement Replit production" mise à jour)
- **Décisions prises** :
  1. Procédure linéaire en 9 étapes + 2 annexes, calibrée pour Thomas non-technique
  2. Type Replit Deployment : **Autoscale** (cohérent avec `deployment-replit.md` existant)
  3. Convention canonique : `issa-capital.com` (apex sans www), `www` redirige 301
  4. Ordre des opérations : Secrets → Build config → Preview *.replit.app → Smoke tests → Activation → Domaine custom → Smoke tests post-domaine → SEO → Monitoring
  5. Rollback documenté avec 8 critères binaires (R1-R8) repris de `go-nogo-checklist.md` Section 5
- **Points d'attention pour Thomas** :
  1. **Toujours faire les smoke tests sur `*.replit.app` AVANT** de relier le domaine custom
  2. **Toujours refaire les smoke tests sur `issa-capital.com` APRÈS** la propagation DNS (URLs canoniques peuvent désaligner)
  3. **Ne pas paniquer pendant la propagation DNS** (5 min à 24h) — c'est normal
  4. **Garder ce document ouvert pendant tout le déploiement** + la checklist GO/NO-GO en parallèle
  5. **Être disponible 2h après le déploiement** pour rollback éventuel
- **Prérequis humains restants** (non automatisables) :
  1. Plan Replit Core actif et confirmé (tarif [À VÉRIFIER] sur replit.com/pricing)
  2. DPA Resend signé
  3. Domaine `issa-capital.com` vérifié dans Resend (DKIM/SPF/DMARC)
  4. Accès au panneau DNS du registrar
  5. Branche `claude/issa-session-4-reprise-9oB9r` mergée sur `main`
- **Ce qui peut être automatisé en futur (V2)** :
  1. **GitHub Actions auto-deploy → Replit** : webhook GitHub déclenchant un redeploy Replit automatique sur push `main` (existe déjà nativement dans certains plans Replit, sinon API Replit)
  2. **Health check endpoint `/api/health`** : créer un endpoint qui vérifie Resend + autres dépendances → branché à UptimeRobot
  3. **CI/CD pre-deploy gate** : bloquer le merge sur `main` si `tsc + lint + build + tests` ne passent pas (workflow GitHub Actions)
  4. **Backup automatique** : pas de DB côté ISSA Capital (site statique vitrine), donc rien à backup côté données. Backup du repo Git suffit
  5. **Visual regression CI** : Playwright screenshots vs baselines automatique sur chaque PR

---

## S20 — Bascule TickTick hub + miroir read-only (livré 2026-05-21)

**Action Thomas requise (1 minute, urgent)** :

1. **Replit Secrets** — Ajouter une variable :
   - `TICKTICK_SYNC_LEGACY_DISABLED` = `1`

   Cette variable désactive l'ancien moteur bidirectionnel S18 (`ticktick-sync/`) qui poussait vault → TickTick et patchait Todo.md depuis TickTick. Sans cette variable, les anciens crons GitHub (qui sont déjà désactivés côté `.github/workflows/`) continueraient à appeler les endpoints repo si ré-armés manuellement.

2. **Vérification (smoke tests E2E) — à faire dans les 24h suivant le déploiement** :
   - **Test 1 Telegram → TickTick** : envoyer depuis l'app Telegram le message `/todo Test S20 demain matin`. Attendu : carte de confirmation Telegram avec titre + échéance + priorité + bouton inline `Annuler`. Vérifier dans l'app TickTick (mobile ou web) que la tâche est créée avec tag `anya-telegram`.
   - **Test 2 régénération miroir** : attendre 15 min (cron `cron-ticktick-poll.yml`). Ouvrir `03. Tâches/Todo.md` dans Obsidian (vault Drive). Attendu : header `<!-- AUTO-GENERATED depuis TickTick. NE PAS ÉDITER. -->` + sections par projet TickTick + section `## Inbox` en tête s'il y a des tâches orphelines.
   - **Test 3 annulation** : dans Telegram, cliquer le bouton `Annuler` sur la carte du Test 1. Attendu : message Telegram remplacé par "❌ Tâche annulée." + au prochain cron (15 min), la tâche disparaît de `Todo.md` (filtrée car `status === 2`).

3. **Rollback rapide si problème** : retirer `TICKTICK_SYNC_LEGACY_DISABLED` des Secrets Replit, redémarrer le déploiement. L'ancien moteur S18 reprend (mais les crons GitHub restent désactivés — il faut les ré-armer en éditant les workflows si besoin). Le code S18 est conservé intact jusqu'à la suppression définitive S21.

4. **Suppression définitive S21** (post-validation 24h) : retrait du dossier `src/lib/secretariat/ticktick-sync/` + suppression des workflows `cron-ticktick-sync-{pull,push}.yml`.

Voir spec complète : `docs/ia/ticktick-gap-analysis-s20.md` + vault SOT `08. Outils/Anya/Skills/Workflow Todo.md`.

---

## S18.1 — Sync vault → TickTick (livré 2026-05-19)

**Action Thomas requise** :

1. **Replit Secrets** — Vérifier que les secrets suivants sont configurés (déjà en place pour la plupart, juste à confirmer) :
   - `CRON_SECRET` — déjà utilisé par `cron-email-ingest` et `cron-ticktick-poll`. Pas de nouvelle valeur à créer.
   - `TICKTICK_ACCESS_TOKEN` — déjà configuré en S15.2.x (180j de durée de vie).
   - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID_THOMAS` — déjà configurés.
   - `DRIVE_VAULT_ROOT_ID` — déjà configuré (pointe sur `00. Me/`).

2. **GitHub Actions** — Le workflow `cron-ticktick-sync-push.yml` (toutes les 5 min) utilise les secrets GitHub déjà en place :
   - `CRON_SECRET` (idem cron poll)
   - `APP_BASE_URL` (idem cron poll)
   Aucun nouveau secret GitHub à ajouter.

3. **Premier run — confirmation projets TickTick** (red line spec §8 step 4) :
   - Quand le cron tournera la première fois, Anya t'enverra une carte Telegram :
     *"Sync TickTick — premier run. Je vais créer 7 projets dans TickTick : Personnel, Versi, ISSA, Gradient One, Immobilier, Sarani, Inbox. Confirmer ?"* [Créer] [Annuler]
   - Clique **[Créer]** une seule fois. Les 7 projets seront créés et leurs IDs persistés dans `_Inbox/AnyaState/ticktick-sync-state.json` sur Drive.
   - Tant que tu n'as pas cliqué [Créer], chaque cron skip avec un log et te ré-envoie la carte. Pas de spam (idempotence : si les projets sont déjà créés, no-op).

4. **Vérification après premier sync** :
   - Ouvrir TickTick iPhone → vérifier que les 7 projets sont visibles
   - Les tâches actives de `03. Tâches/Todo.md` doivent apparaître dans le bon projet en moins de 5 min
   - Cocher dans le vault → tâche TickTick complétée au prochain cron
   - Supprimer une ligne du vault → tâche TickTick supprimée au prochain cron

5. **Rollback** : si le sync se comporte mal, désactiver le workflow GitHub Actions `cron-ticktick-sync-push.yml` (un clic dans l'UI GitHub). Le state Drive reste intact ; ré-activer plus tard reprendra là où on s'est arrêté.

**Hors scope S18.1** (reporté S18.2/S18.3) : pull TickTick → vault, résolution conflits, validation Telegram deletes, iCal réunions, scan tâches inline dans Reunions/Projets.

---

## S18.2 — Sync TickTick → vault + conflits + scan inline (livré 2026-05-19)

**Action Thomas requise** :

1. **Replit Secret à ajouter** :
   - `OBSIDIAN_VAULT_NAME` — Nom EXACT de ton vault Obsidian local (case-sensitive). Permet la construction du deep-link `obsidian://open?vault=<name>&file=...` envoyé par la carte Telegram [Voir] quand TickTick supprime une tâche. Si non défini, fallback = `ThomasIssa`.
   - Action : Replit → Secrets → `OBSIDIAN_VAULT_NAME` = `<ton nom de vault>`.

2. **Secrets déjà configurés (S18.1)** — Aucun nouveau secret Replit autre que `OBSIDIAN_VAULT_NAME`. Le cron-pull réutilise tous les secrets de S18.1 :
   - `CRON_SECRET`, `TICKTICK_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_THOMAS`, `DRIVE_VAULT_ROOT_ID`.

3. **GitHub Actions** — Le workflow `cron-ticktick-sync-pull.yml` (toutes les 5 min, décalé +30s vs push) utilise les secrets GitHub déjà en place :
   - `CRON_SECRET` (idem push)
   - `APP_BASE_URL` (idem push)
   Aucun nouveau secret GitHub à ajouter.

4. **Vérification après premier pull (à valider visuellement)** :
   - Sur l'app TickTick iPhone, crée une tâche manuelle dans projet "Inbox" (ex: "test pull S18.2").
   - Attends 5 min (ou trigger manuel `workflow_dispatch` sur GH Actions).
   - Vérifie dans Obsidian : la tâche doit apparaître sous `## Inbox` de `03. Tâches/Todo.md`.
   - Modifie le titre de la tâche dans TickTick → attendre 5 min → la ligne vault doit être mise à jour (last-write-wins TickTick gagne).
   - Supprime la tâche dans TickTick → Anya envoie une carte Telegram [Oui][Garder][Voir] (TTL pending 7j R3).

5. **Red line §9.2 — pas de delete silencieux** :
   - Anya NE SUPPRIME JAMAIS une ligne du vault sans confirmation Telegram explicite.
   - Si la carte expire (>7j sans réponse), le pending est purgé et la tâche reste dans le vault (la tâche sera re-créée TickTick au prochain cron push).

6. **Verrou push/pull** :
   - Un verrou simple (TTL 30s) dans `_Inbox/AnyaState/ticktick-sync-state.json` empêche le push et le pull de tourner simultanément. Si l'un est bloqué (crash), le verrou se libère automatiquement après 30s.

7. **Rollback** : désactiver `cron-ticktick-sync-pull.yml` dans GitHub Actions (un clic). Le push S18.1 continue de fonctionner. État Drive intact.

**Hors scope S18.2** (reporté S18.3) :
- Récursion sous-dossiers vault (V1 scanne 4 dossiers racine : `Réunions/<year>/<month>` mois courant, `Projets/01. Perso`, `Projets/02. Pro`, `Notes`).
- Tests E2E réels iPhone (R6 — validation visuelle Thomas requise).
- Audit JSONL des pulls (write trace dans `_Inbox/AnyaLogs/`).
- Re-création TickTick effective sur action [Garder] (V1 = clear `state.tasks[key]`, prochain push créera, mais ID TickTick change).

---

## Annexe S18.6 — Calendar-ingest Google Calendar → vault Reunions

**Livré** : module `src/lib/secretariat/calendar-ingest/` + endpoint `GET /api/secretariat/calendar-ingest/cron` + workflow `.github/workflows/cron-calendar-ingest.yml` (cadence 15 min).

**Décision Thomas (verbatim S18.6)** :
> « mon google calendar n'est pas sync avec ticktick et le vault ? C'est tres important. Si on minvite a un meeting il faut que ce soit géré ! »

**Direction V1 (one-way)** :
Google Calendar → vault `06. Réunions/YYYY/MM/` → TickTick (via iCal feed S18.3a déjà actif) + enrichissement automatique des fiches contacts existantes (cohérent S18.5 livrable A).

**Hors scope V1** : bidirectionnel (vault → Google Calendar), détection conflits, reschedule auto, création automatique de fiches contacts stub (red line).

### Actions Replit requises avant activation

1. **Scope OAuth `calendar.readonly`** — Vérifier que le refresh token Google actuel (partagé Gmail + Drive) inclut bien le scope `https://www.googleapis.com/auth/calendar.readonly`. Si non :
   - Soit re-générer un refresh token avec ce scope (re-faire le flow OAuth Google avec scopes étendus)
   - Soit ajouter le scope au flow OAuth existant (`src/app/api/secretariat/ticktick/oauth/init/route.ts` — pas concerné, c'est TickTick. Le flow Google se fait via les credentials drive-upload).
   - Test rapide après ajout du scope : `curl -fsS "https://<APP_BASE_URL>/api/secretariat/calendar-ingest/cron?token=<CRON_SECRET>&dryRun=1"` → doit retourner `stats.eventsFetched > 0` si Thomas a des events dans les 14 prochains jours.
2. **Activer le workflow GitHub Actions** — Le fichier `.github/workflows/cron-calendar-ingest.yml` se déclenchera automatiquement après merge sur `main`. Cadence : 15 min décalée (`1,16,31,46 * * * *`).
3. **Carte Telegram récap** — Aucune action requise si `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID_THOMAS` sont déjà configurés. Sinon : voir Annexe S14 Telegram.

### Test de validation post-déploiement

1. Inviter Thomas à une réunion test via Google Calendar (depuis un autre compte) :
   - Sujet : "Test calendar-ingest S18.6"
   - Date : J+1 (pour rester dans la fenêtre 14 jours)
   - Inviter un participant qui a une fiche vault (ex: Maxime, Carl)
2. Attendre max 15 min (ou trigger manuel : "Run workflow" sur GitHub Actions)
3. Vérifier dans Obsidian :
   - `06. Réunions/<année>/<mois>/<YYYY-MM-DD> - <Participants> - Test calendar-ingest.md` créé
   - Frontmatter contient `google_calendar_event_id`, `google_calendar_html_link`
   - Fiche du participant invité a une nouvelle ligne `### YYYY-MM-DD — Réunion : Test calendar-ingest S18.6` dans `## Historique` + `date_dernière_interaction` mis à jour
4. Vérifier dans TickTick : la réunion apparaît via le feed iCal `06. Réunions` (peut prendre 1h selon refresh TickTick)
5. Vérifier carte Telegram : message "Calendar-ingest — 1 réunion(s) traitée(s)"

### State + audit

- **State** : `_Inbox/AnyaState/calendar-ingest-state.json` (idempotence via `processedEvents[eventId].lastSeenUpdated`)
- **Audit JSONL** : `_Inbox/AnyaLogs/calendar-ingest-YYYY-MM-DD.jsonl` (1 ligne par event traité)
- **PATCH in-place R5** : toutes les écritures Drive (fiches réunions + fiches contacts + state + audit)

### Plan B si scope OAuth calendar bloqué

Si l'ajout du scope Calendar nécessite la re-validation OAuth manuelle par Thomas (consent screen Google), basculer en mode "dryRun temporaire" :
- Le cron tournera et loggera `[calendar-source] pas de token OAuth2 — Calendar désactivé`
- Aucune action vault, aucune carte Telegram
- L'activation effective interviendra dès que le nouveau refresh_token avec scope Calendar sera configuré dans Replit Secrets

---

## S19.B — Hot-context-updater (livré 2026-05-19)

**Aucun nouveau secret Replit requis.** Le module hot-context réutilise tous les secrets déjà configurés en S14-S18 :
- `CRON_SECRET` (auth cron route `/api/secretariat/hot-context/cron-scan`)
- `ANTHROPIC_API_KEY` (Haiku 4.5 via wrapper `llm/client.ts`)
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID_THOMAS` (carte validation patches)
- OAuth Drive (scopes vault déjà configurés en S14)

### GitHub Secrets requis (workflow `cron-hot-context-scan.yml`)

Aucun ajout — réutilise `CRON_SECRET` et `APP_BASE_URL` (déjà configurés pour `cron-ticktick-sync-pull.yml`).

### Activation

1. **Merge sur main** : la branche contient le code + workflow GitHub Actions
2. **Vérifier le workflow** : sur GitHub → Actions → "Cron Hot Context Scan (Anya S19.B, every 5 min)" → doit apparaître après le merge
3. **Premier run** : déclenche manuellement via "Run workflow" pour valider l'auth + accès Drive (vérifier les logs Replit pour `[cron-hot-context-scan] terminé — candidates=X patches=Y`)
4. **State auto-créé** : au premier run, `_Inbox/AnyaState/hot-context-state.json` est créé automatiquement (vide). Aucune action manuelle.

### Phase C (post-merge, à valider visuellement Thomas — R6)

Trois mises à jour vault à faire MANUELLEMENT par Claude principal (R6 — validation visuelle Thomas dans Obsidian avant batch) :
1. **Frontmatter `00. Me/hot-context.md`** : passer `budget_tokens: ~300` → `budget_tokens: ~500` (PATCH in-place R5)
2. **Document `08. Outils/Workflow Hot Context.md`** : refléter le format 4 sections (suppression des 5 blocs historiques) + mention cron 5min
3. **Test E2E** : 1 patch end-to-end avec validation visuelle Thomas dans Obsidian avant déclaration done

### Rollback

Désactiver `cron-hot-context-scan.yml` dans GitHub Actions (un clic). Le state Drive reste intact, aucune perte de données.

### Cap warn 500 tokens

Mode **warn-only** : si le briefing dépasse 500 tokens après merge, la carte Telegram affiche le delta ("520 tokens (cap warn 500 dépassé : +20)"), Thomas valide quand même si pertinent. Pas de refus automatique.

---

## S22 — Routage LLM par tâche (DeepSeek V4 Flash)

### Secret Replit OBLIGATOIRE

Ajouter dans Replit Secrets **avant déploiement** :
- `DEEPSEEK_API_KEY` — clé API DeepSeek (https://platform.deepseek.com). **Sans cette clé, les tâches routées DeepSeek (triage email, router inbox, hot-context detect/modify, brouillon email) échouent de façon VISIBLE** (`Error: DEEPSEEK_API_KEY manquante ou placeholder`) — AUCUN fallback silencieux vers Claude (garde-fou intentionnel).

### Secrets inchangés
- `ANTHROPIC_API_KEY` — toujours requis (CR avec web_search reste sur Sonnet).

### Override par tâche (optionnel, runtime)
Pour repasser une tâche sur Claude sans redéploiement de code, ajouter en Secret :
- `LLM_TASK_OVERRIDE_EMAIL_TRIAGE=anthropic:claude-haiku-4-5-20251001` (exemple)
- Tâches : `INBOX_ROUTER`, `EMAIL_TRIAGE`, `HOT_CONTEXT_DETECT`, `HOT_CONTEXT_MODIFY`, `EMAIL_DRAFT`, `CR`.

### Rollback complet (tout sur Anthropic)
Définir les 5 overrides DeepSeek vers Anthropic en Secrets, ou inverser le mapping par défaut dans `src/lib/secretariat/llm/models.ts` (`TASK_MODEL`).

### Monitoring
Coût DeepSeek tracké dans `/home/runner/issa-data/deepseek-usage.json` (même mécanisme que `anthropic-usage.json`). Aucune action requise — auto-créé au premier appel.

---


