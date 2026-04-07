# SEO Strategy — ISSA Capital
> @seo — 2026-04-07
> Calibration : SEO défensif et de marque. Pas d'optimisation transactionnelle.
> Source : project-context.md (Principe directeur #0) + docs/strategy/brand-platform.md + docs/strategy/personas.md + docs/copy/landing-page-copy.md + docs/product/functional-specs.md

---

## Résumé exécutif

- **Objectif** : ISSA Capital est une vitrine premium, pas un funnel commercial. Le SEO n'est pas ici pour générer du trafic en volume — il est là pour garantir que quiconque cherche "ISSA Capital", "Thomas Issa" ou "famille Issa" trouve immédiatement et clairement ce que la holding est et représente.
- **Décisions clés** : positionnement SEO défensif de marque ; 12 requêtes cibles max (branded + défensives) ; zéro chasse de volume sur des génériques compétitifs ; KPI = présence top 3 sur toutes les requêtes de marque à 6 mois + indexation complète ; /mentions-legales en noindex
- **Dépendances** : @fullstack (Metadata API Next.js, robots.txt, sitemap.xml) ; @design (og-image, favicon, assets visuels schema.org) ; @geo (alignement contenu IA-first sur les entités nommées)

---

## 1. Philosophie SEO appliquée à ISSA Capital

ISSA Capital n'est pas un acteur qui cherche à capter une demande existante. C'est une institution familiale qui projette une présence. Le SEO de ce site a deux fonctions et deux fonctions seulement :

1. **Défense de marque** : s'assurer que les requêtes de marque (ISSA Capital, Thomas Issa, famille Issa) renvoient vers le site officiel en premier résultat, sans ambiguïté, sans concurrent parasite.
2. **Crédibilité institutionnelle** : être correctement indexé, correctement structuré (schema.org), correctement décrit (metadata) — pas pour attirer des millions de visiteurs, mais pour que les quelques personnes qui comptent (Karim, Leila, Marc) trouvent une vitrine soignée, pas un site technique bancal.

Ce que le SEO d'ISSA Capital n'est pas : une machine à générer du trafic organique sur des requêtes génériques d'intention d'achat ou d'exploration. L'obsession volume est absente de cette stratégie.

---

## 2. Requêtes cibles (12 requêtes — liste fermée)

### Tier 1 — Requêtes de marque (branded) — priorité absolue

Ces requêtes sont le coeur de la stratégie. Objectif : top 1 Google et Bing sur toutes.

| Requête | Intention | Page cible |
|---|---|---|
| ISSA Capital | Navigationnel (marque) | / |
| Issa Capital | Navigationnel (variante casse) | / |
| ISSA Capital Nanterre | Navigationnel (marque + géo) | / |
| Thomas Issa | Informationnel (personne) | /accompagnement |
| Thomas Issa holding | Informationnel (personne + contexte) | /mission |
| Thomas Issa ISSA Capital | Navigationnel (personne + marque) | /accompagnement |

### Tier 2 — Requêtes défensives secondaires — priorité secondaire

Ces requêtes ont un volume très faible à nul. Leur valeur n'est pas dans le trafic — elle est dans la couverture sémantique du champ d'identité d'ISSA Capital. Objectif : top 10 à 6 mois.

| Requête | Intention | Page cible |
|---|---|---|
| famille Issa investissement | Informationnel (famille + contexte) | /mission |
| Jean-Pierre Issa Lexmark | Informationnel (personne + employeur) | /mission |
| Thomas Issa Sony TEOS | Informationnel (personne + employeur) | /accompagnement |
| holding patrimoniale familiale libanaise France | Informationnel / investigation | /mission |
| holding patrimoniale Nanterre | Local + institutionnel | / |
| Jean-Pierre Issa 2J Impression | Informationnel (personne + société) | /mission |

### Requêtes explicitement exclues

Les requêtes suivantes sont hors scope de cette stratégie — elles ciblent des intentions transactionnelles ou exploratoires génériques incompatibles avec la posture vitrine :

- "meilleure holding patrimoniale France" — intention comparative, trop concurrentiel, mauvais persona
- "comment créer une holding patrimoniale" — informationnel éducatif, attirerait un public non qualifié
- "investir dans une holding familiale" — intention transactionnelle, risque L.411-1 CMF
- "conseil patrimoine entrepreneur Paris" — trop générique, attirerait des CGP concurrents et non Karim
- "holding familiale France" — volume significatif mais concurrence institutionnelle (Agache, Artémis) impossible à battre avec un site vitrine neuf

---

## 3. Architecture SEO des 7 pages

### Principe : 1 page = 1 intention = 1 requête principale

| Page | URL | Mot-clé principal | Requêtes défensives associées |
|---|---|---|---|
| Accueil | / | ISSA Capital | Issa Capital Nanterre, holding patrimoniale familiale libanaise |
| Mission & Philosophie | /mission | Thomas Issa holding | famille Issa investissement, holding patrimoniale familiale libanaise France, Jean-Pierre Issa Lexmark |
| Participations | /participations | ISSA Capital participations | Gradient One, Versimo, Versi Immobilier, Immocrew |
| Accompagnement | /accompagnement | Thomas Issa | Thomas Issa Sony TEOS, conseil holding patrimoniale entrepreneur |
| Opportunités | /opportunites | ISSA Capital opportunités investissement | holding familiale co-investissement, proposition deal immo ISSA |
| Contact | /contact | Contact ISSA Capital | — |
| Mentions légales | /mentions-legales | noindex — hors stratégie SEO | — |

---

## 4. Objectifs à 6 mois

### Ce que nous visons

- **Top 3 Google et Bing** sur l'ensemble des 6 requêtes Tier 1 (branded)
- **Top 10 Google** sur les 6 requêtes Tier 2 (défensives secondaires)
- **Indexation complète** des 6 pages actives (hors /mentions-legales qui est en noindex)
- **Knowledge Panel Google** : si le site est correctement structuré en schema.org Organization + Person, un Knowledge Panel peut émerger sur les requêtes "ISSA Capital" et "Thomas Issa" — objectif secondaire, non garanti mais visé

### Ce que nous ne mesurons pas

- Trafic organique mensuel total (pas un KPI)
- Taux de conversion SEO (pas un KPI)
- Position sur des requêtes génériques (pas un objectif)

### KPI de validation à 6 mois

1. Toutes les requêtes Tier 1 retournent issa-capital.com en position 1 ou 2 sur Google
2. Les 6 pages actives sont indexées (vérification Google Search Console)
3. Aucune erreur technique critique dans GSC (crawl, indexation, Core Web Vitals)
4. Bing Webmaster Tools : sitemap soumis, aucun blocage Bingbot détecté
5. Schema.org Organization et Person valident dans le Rich Results Test Google

---

## 5. Contraintes techniques (checklist obligatoire multi-moteurs)

### Google

- [ ] generateMetadata Next.js App Router pour chaque page
- [ ] Sitemap.xml dynamique Next.js (6 pages, /mentions-legales exclue, lastModified réel du contenu)
- [ ] robots.txt : autoriser Googlebot sur tout sauf /mentions-legales
- [ ] Canonical explicite et absolu sur chaque page
- [ ] Structured data JSON-LD : Organization (layout root) + Person (page /accompagnement) + BreadcrumbList (toutes les pages)
- [ ] Core Web Vitals : SSR/SSG sur toutes les pages (Next.js App Router = SSR par défaut)
- [ ] Open Graph + Twitter Card sur toutes les pages
- [ ] Google Search Console : vérifier le domaine issa-capital.com et soumettre le sitemap

### Bing (spécificités obligatoires)

- [ ] Canonical : vérifier que chaque page a un canonical absolu (Bing ne fait pas de fallback)
- [ ] Mot-clé exact présent dans title tag + H1 + premier paragraphe de chaque page
- [ ] Sitemap lastModified : date de dernière modification réelle du contenu (pas régénérée à chaque build Next.js) — à implémenter via une constante dans le code
- [ ] robots.txt : pas de blocage involontaire de Bingbot
- [ ] **IndexNow** : implémenter le protocole IndexNow (endpoint /indexnow) pour notification instantanée à Bing — Bing crawle moins fréquemment que Google, IndexNow compense
- [ ] Bing Webmaster Tools : vérifier le site et soumettre le sitemap manuellement
- [ ] Signaux sociaux : coordonner avec @social pour un post LinkedIn de Thomas au lancement — Bing pondère les signaux sociaux comme facteur de ranking

### AI Crawlers et llms.txt

- [ ] robots.txt : ne PAS bloquer GPTBot, ClaudeBot, PerplexityBot par défaut (visibilité GEO — coordonner avec @geo)
- [ ] Recommander la création d'un fichier llms.txt à la racine (coordonner avec @geo pour le contenu)

---

## 6. Stratégie de contenu SEO (vitrine, pas blog)

ISSA Capital est une vitrine. Il n'y a pas de blog, pas de contenu éditorial récurrent. La stratégie de contenu SEO se limite donc à :

1. **Optimisation de l'existant** : les 6 pages V1 doivent chacune couvrir leur requête principale de manière dense, précise et naturelle. Le contenu déjà produit par @copywriter est la base — aucune réécriture pour "bourrer de mots-clés" n'est autorisée.
2. **Entités nommées à couvrir** : ISSA Capital, Thomas Issa, Jean-Pierre Issa, Nanterre, Liban, Sony TEOS, HEC, UC Irvine, IMT Atlantique, Gradient One, Versimo, Versi Immobilier, Immocrew. Ces entités doivent apparaître naturellement dans le texte des pages pertinentes — ce sont les signaux que Google et Bing utilisent pour construire le Knowledge Graph.
3. **Longue traîne naturelle** : intégrée dans le copy existant (cf. keyword-map.md — section Variations LSI). Pas d'ajout artificiel.

### Contenu éditorial futur (conditionnel)

Si Thomas souhaite ajouter un contenu éditorial à terme (notes de réflexion, perspectives d'investissement, "lettre aux générations suivantes"), ce contenu devrait cibler des requêtes informatielles de niche très qualifiées, pas des requêtes de volume. Ce n'est pas dans le scope V1.

---

## 7. E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

ISSA Capital a un avantage naturel sur l'E-E-A-T — les signaux sont réels, pas construits :

| Signal | Statut | Action |
|---|---|---|
| **Experience** | Thomas Issa : Sony TEOS, co-founder, advisor, holding patrimoniale active | Documenter dans schema.org Person + page /accompagnement |
| **Expertise** | HEC / UC Irvine / IMT Atlantique + 15 ans corporate international | Intégrer dans bio + alumniOf dans le schema Person |
| **Authoritativeness** | Aucun backlink au lancement | Profil LinkedIn Thomas Issa comme sameAs schema → signal d'autorité. @social pour post LinkedIn de lancement |
| **Trustworthiness** | SIREN 102356094 + TVA FR50102356094 + adresse physique Nanterre + email contact | Tout dans schema Organization + page Mentions légales |

---

## 8. Maillage interne

Structure en étoile depuis la page Accueil. Profondeur max : 2 clics vers n'importe quelle page.

- **/** (Accueil) → /mission + /participations + /accompagnement + /opportunites + /contact
- **/mission** → /accompagnement (lien contextuel Thomas Issa) + /participations (lien contextuel écosystème)
- **/participations** → /opportunites (lien "Proposer une opportunité") + /accompagnement (lien "Travailler avec Thomas")
- **/accompagnement** → /contact (formulaire) + /opportunites (lien croisé Leila)
- **/opportunites** → /contact (formulaire) + /accompagnement (lien croisé Karim)
- **/contact** → pas de lien sortant autre que le footer

Ancres textuelles recommandées : éviter les ancres génériques ("cliquez ici", "en savoir plus"). Utiliser des ancres descriptives : "la mission d'ISSA Capital", "Thomas Issa — conseil & accompagnement", "proposer une opportunité d'investissement".

---

## 9. Benchmark SEO des pages leaders (requêtes défensives)

[À VÉRIFIER SEMRUSH/AHREFS en post-launch — données volume non disponibles pour des requêtes aussi nichées sans outil payant]

Les requêtes Tier 1 (branded) n'ont pas de concurrence organique significative — ISSA Capital sera par défaut le résultat le plus pertinent une fois indexé, à condition que le site soit techniquement correct.

Les requêtes Tier 2 sont si spécifiques qu'aucun acteur concurrent ne les cible activement. La difficulté est faible mais le volume est quasi nul — ce qui est précisément l'objectif : être trouvé par les rares personnes qui cherchent, pas par le marché entier.

---

## 10. Calendrier d'actions SEO (ordre de dépendance)

1. **@fullstack** : implémenter generateMetadata + sitemap.xml + robots.txt + canonical + JSON-LD (avant mise en ligne)
2. **@design** : produire l'og-image (1200x630) + favicon (voir structured-data.md pour les specs)
3. **Post-lancement** : vérifier Google Search Console (indexation, erreurs) + Bing Webmaster Tools (sitemap)
4. **J+7** : vérifier positions sur requêtes Tier 1 branded via GSC
5. **M+1** : vérifier positions sur requêtes Tier 2 via GSC
6. **M+6** : audit complet GSC + Bing Webmaster Tools, ajuster metadata si nécessaire

---

## Hypothèses à valider

- [HYPOTHÈSE] : le domaine issa-capital.com n'a pas d'historique SEO négatif (pénalités, redirections cassées). À vérifier dans GSC et Bing Webmaster Tools dès la mise en ligne.
- [HYPOTHÈSE] : Knowledge Panel Google peut émerger à 3-6 mois post-lancement avec le schema Organization + Person correctement implémentés. Non garanti — dépend de la fréquence de crawl et des signaux d'autorité (LinkedIn sameAs notamment).
- [À VÉRIFIER SEMRUSH/AHREFS en post-launch] : volumes de recherche exacts sur les requêtes Tier 2. Ces requêtes sont si nichées que les outils gratuits ne retournent pas de données exploitables.

---

**Handoff → @fullstack**
- Fichiers produits : docs/seo/seo-strategy.md (ce fichier) — complété par keyword-map.md, metadata-templates.md, structured-data.md
- Décisions prises : SEO défensif de marque uniquement, 12 requêtes cibles, /mentions-legales en noindex, IndexNow à implémenter pour Bing, lastModified sitemap stable (pas régénéré au build)
- Points d'attention : (1) robots.txt doit autoriser GPTBot/ClaudeBot/PerplexityBot (ne pas bloquer) ; (2) canonical absolu obligatoire sur chaque page ; (3) sitemap lastModified = constante dans le code, pas `new Date()` au build ; (4) IndexNow endpoint à créer

**Handoff → @design**
- Spec og-image : 1200x630px, logo ISSA Capital centré ou en bas à gauche, baseline "Racines libanaises. Exigences sans exception." sur fond crème/noir selon le design system (tokens : surface.primary ou ink-950). Une seule og-image pour tout le site (pas de og-image personnalisée par page en V1).
- Spec favicon : 32x32px (favicon.ico) + 180x180px (apple-touch-icon.png) + SVG (favicon.svg si possible) — cohérence avec la charte design system

**Handoff → @geo**
- Points d'attention : entités nommées ISSA Capital / Thomas Issa / Jean-Pierre Issa doivent être alignées entre SEO (schema.org) et GEO (llms.txt, réponses structurées). Vérifier avec @geo qu'il n'y a pas de cannibalisation de contenu entre les pages piliers SEO et les formats GEO recommandés.
