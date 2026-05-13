# Project Context — Archive

> Mémos de reprise et historique d'interventions archivés depuis project-context.md.
> Archivage effectué en clôture session 9 (2026-05-10) — sessions > 5 sessions d'ancienneté.

## Note

Les mémos de reprise des sessions 5 et 6, ainsi que les détails d'implémentation de ces sessions, ont été archivés ici pour maintenir project-context.md sous le cap de 250 lignes (hors historique/mémo). Consulter le git history (commits antérieurs au 2026-05-10) pour le contenu complet.
## Mémo de reprise — Session 7 (clôture session 6 le 2026-04-08)

### État à la clôture session 6
- **Branche active session 6 (clôturée)** : `claude/resume-issa-session-6-UDiOS` (HEAD à actualiser après commit clôture)
- **Site DÉPLOYÉ** : issa-capital.com (avec les corrections Phase 2 + 3+5 + 6a + 6.5 appliquées dans le code). Phase 7 implémentation des refontes /mission + /participations + /accompagnement NON appliquée dans le TSX.
- **Pipeline G28 final session 6** : tsc 0 / lint 0 / vitest 7/7 PASS / next build 15 routes (dernière Phase 6a) / 21 baselines Playwright régénérées
- **Compteur producteurs session 6** : 15/18 Tasks producteurs utilisés (marge 3)
- **Clôture demandée par Thomas** : "non finissons proprement puis changeons de session" — pas de Phase 7 ni Phase 4 en session 6

### 🔴 2 décisions Thomas BLOQUANTES en début session 7

**Décision 1 — Favicon direction** (brief `docs/design/favicon-brief-session6.md`)
- Diagnostic Direction A (session 5 C3) : 5 défauts identifiés (C Bézier illisible 16px, monogramme flottant sans identité libanaise, cabinet européen banal, pas de signal patrimonial, manque de robustesse)
- Direction 1 **Sceau / Cachet patrimonial** ⭐ recommandée par @creative-strategy (IC dans un sceau circulaire, fond ink-950, glyphe parchment-100, contour levant-500)
- Direction 2 Cèdre géométrique (identité libanaise explicite)
- Direction 3 I monumental (rigueur structurelle)
- Question Thomas : *"Pour le favicon ISSA Capital, quel signal veux-tu transmettre dans l'onglet parmi vingt autres — IC dans un sceau/cachet de famille (D1), I seul monumental (D3), ou cèdre géométrique identité libanaise explicite (D2) ?"*

**Décision 2 — /accompagnement opérationnel vs maison** (livrable `docs/strategy/accompagnement-refonte-10-10-session6.md`)
- Variante A "Duo opérationnel" 9.5/10 (Jean-Pierre ET Thomas dans les réunions, 8 sections avec 2 bios distinctes)
- Variante C "Maison et héritier" 9.4/10 (Thomas opère, Jean-Pierre figure tutélaire/méthode)
- Question Thomas : *"Quand tu dis 'tous les deux on accompagne', est-ce que Jean-Pierre intervient directement dans les missions clients — réunions, recommandations, échanges — ou est-ce qu'il est présent au sens de 'la maison Issa accompagne via sa méthode et son héritage', et c'est toi qui opères ?"*
- **Les 2 variantes ont leur verbatim complet prêt dans le livrable (551 lignes)** — implémentation possible dès tranchage

### Ce qui a été livré en session 6 (15 Tasks producteurs utilisés)

**Phase 2 vague 2.1 — Copy + Edit chirurgical (commit `0b1c42a`)** :
1. Filtres décision 4 textes A/B — Filtre 1 B principiel + Filtre 2 A pragmatique + Filtre 3 Horizon inchangé
2. Gradient One Option C (co-fondée avec deux associés, corrigée par Thomas) + Versi Invest
3. Incipit "Notre raison d'être" — suppression "Cette holding n'est pas née en 2026." (src/app/page.tsx l.102)

**Phase 2 vague 2.2 — 5 corrections justifications explicites (commit `7bcea0c`)** :
- 2 SUPPRIMER + 3 REFORMULER sur /accompagnement + /home + /opportunités
- P0 "Dans les deux cas : aucun tarif affiché..." → déplacée dans intro formulaire sous forme incarnée

**Phase 3+5 fusion — Mega-passe TSX (commit `cd30dbb`)** :
- Propagation Vague 2.1 (filtres + Gradient One Prop 1 + Versi Invest verbatim Thomas)
- Refonte complète src/app/mission/page.tsx en 7 sections (absorption /a-propos v1)
- Suppression intégrale src/app/a-propos/
- next.config.js redirect 301→308 /a-propos → /mission
- siteConfig.nav + footerLinks : item "À propos" retiré
- 21 baselines régénérées (7 pages × 3 devices)

**Phase 6a — 4 corrections rapides CHECKPOINT #3 (commit `60ef82b`)** :
- Homepage : grid 3 stats remise (2020 Co-fondation / 6 Participations / 3 Générations), label "Participation phare" retiré
- Écosystème Gradient One : "et financières" ajouté
- Écosystème Versi Invest : description simplifiée à "Conseil en investissement immobilier et co-investissement sur sélection."
- /participations : 2 occurrences "Participation phare" retirées

**Phase 6.5 — Corrections factuelles verrouillées Thomas (commit `c7f21fd`)** :
- src/app/mission/page.tsx l.131 : "En 1994" → "En 2016" (2J Impression rachat)
- src/app/mission/page.tsx l.163-170 : réordonnancement chronologique (Afrique du Sud en tête de parcours)
- project-context.md : section "Corrections factuelles verrouillées par Thomas — Session 6" ajoutée

**Phase 6b — Livrable /mission refonte RICHE v2 10/10 (commit `689ac3e`)** :
- `docs/strategy/mission-refonte-10-10-session6.md` (568 lignes, 3 versions MIN/INT/RICHE + auto-éval 10 dimensions)
- Version RICHE v2 atteint 10/10 après 1 itération
- **Architecture finale** : 6 sections (Hero + Jean-Pierre + Thomas + L'horizon NOUVELLE + Filtres + Ce que nous sommes)
- **Coupes** : Section Famille complète (Antoine/Noémie/Lucas), Thomas Florimont/Irvine/Inde/Sony/TEOS, Jean-Pierre 2J 17 pays/4M€/Co-Managing Director, Section Identité séparée
- **Sonia Issa GARDÉE** (1 phrase italique, décision Thomas CHECKPOINT #4)
- Impact JSON-LD : supprimer `alumniOf` (Florimont + UC Irvine)

**Phase 6c — Livrable /participations refonte Variante A 9.6/10 (commit `5e2fd5e`)** :
- `docs/strategy/participations-refonte-10-10-session6.md` (419 lignes, 2 variantes A/B + auto-éval)
- Variante A "par domaine d'activité" = 9.6/10 (non 10/10 car cosmétique, éviter la démonstration)
- **Architecture finale** : H1 "Un écosystème immobilier construit depuis 2020." + 5 sections (Immobilier en direct / Accompagnement et co-investissement / Technologie au service de l'immobilier NOUVELLE / Une thèse pas un portefeuille)
- **Gradient One** relégué en attribution "via Gradient One" dans les fiches entités, plus de traitement featured/border-2/col-span-2 sur Versi Invest
- **Note Gradient One hero** : Thomas n'a pas tranché explicitement → hypothèse retenue **B retirer** (cohérent avec "personne ne connaît Gradient One")

**Phase 6d — Livrable /accompagnement refonte 9.5/10 (commit `01bd819`)** :
- `docs/strategy/accompagnement-refonte-10-10-session6.md` (551 lignes, 2 variantes A/C + auto-éval)
- Variante A "Duo opérationnel" 9.5/10 (recommandée)
- Variante C "Maison et héritier" 9.4/10 (alternative si Jean-Pierre pas opérationnel)
- Score 10/10 non atteint car décision business Thomas bloquante
- Faits biographiques respectés : 2J 2016 + Afrique du Sud

**Phase 6e — Brief favicon 3 directions (commit `d318aad`)** :
- `docs/design/favicon-brief-session6.md` (223 lignes)
- Diagnostic Direction A session 5 C3 : 5 défauts identifiés
- 3 directions proposées (Sceau / Cèdre / I monumental)
- Direction 1 Sceau recommandée
- **Pas d'implémentation graphique session 6** (reportée session 7 @design + @fullstack)

### ⏳ Ce qui reste à faire en session 7 (ordre d'attaque recommandé)

1. **Tranche des 2 décisions Thomas** (CHECKPOINT #5) : favicon direction + accompagnement variante A/C
2. **Phase 7 mega-passe @fullstack** (1 Task) :
   - Homepage stats-only strict (retirer texte éditorial Gradient One de la section refondue en Phase 3+5, garder uniquement stats 2020/6/3)
   - /mission implémenter RICHE v2 6 sections (Sonia gardée, 2J 2016, Afrique du Sud, coupes Florimont/Irvine/Sony/TEOS, JSON-LD alumniOf supprimé)
   - /participations implémenter Variante A 5 sections (Gradient One relégué en attribution)
   - /accompagnement implémenter variante retenue (A ou C)
   - Pipeline G28 + 21 baselines régénérées
3. **Phase favicon** (2 Tasks) :
   - @design produit 8 SVG + binaires + apple-touch-icon selon direction retenue
   - @fullstack propage public/ + app/layout.tsx + références
4. **Phase 4 QA finale** (2 Tasks) :
   - @qa tests E2E sur toutes les pages refondues
   - @testeur-karim ré-évaluation gates GP1-GP10

### Contraintes cross-session (rappel inchangé)

- **Principe directeur #0** : VITRINE pas conversion. Zéro CTA agressif.
- **Règle absolue** : Simplicité > Démonstration > Élégance (P0 verrouillée).
- **Identité** : jamais "famille française", jamais "famille libanaise" (retour Jean-Pierre session 9). Autorisé : "racines libanaises", "d'origine libanaise", "famille Issa".
- **Caractères UTF-8 réels** dans le code (é è à ç).
- **Mention TikTok / Adidas / Lego / Sony AUTORISÉE** (exception explicite Q2 session 5).
- **Zéro mention du nom de l'agence Thomas** (commence par S, finit par i, 6 lettres) → "Une agence de communication internationale".
- **Q3 "d'une famille libanaise, établie en France"** : verrouillée.
- **Q1 Option B typo** (display 52px / h2 32px / h3 26px) : verrouillée.
- **Faits biographiques verrouillés session 6** :
  - 2J Impression rachat = **2016** (pas 1994)
  - Thomas jeunesse en **Afrique du Sud** (avant Inde et US)
- **Décisions Thomas verrouillées session 6** :
  - A1 fusion /mission + /a-propos = OUI (fait)
  - A2 Sonia Issa dans /mission = GARDÉE (1 phrase italique)
  - A3 prénoms+dates enfants dans /mission = GARDÉS (mais seront coupés en Phase 7 selon Version RICHE v2 — Thomas a tranché différemment par la suite avec le feedback "trop de détails")
  - Filtres : Filtre 1 = B principiel, Filtre 2 = A pragmatique
  - Gradient One Bloc 1 titre = Prop 1 "co-fondée par Thomas Issa et deux associés"
  - Homepage "Participation phare" = stats-only strict (PAS de texte éditorial, retirer Prop 1 + sous-titre + description en Phase 7)
  - Gradient One écosystème : "Holding intermédiaire" GARDÉ + "et financières" ajouté
  - Versi Invest écosystème : description simplifiée (1 phrase)
  - Gradient One hero /participations : B retirer (hypothèse)

### Compteur session 7 disponible

**Budget Tasks producteurs session 7** : 18 (seuil ALERTE ROUGE).

**Estimation Phase 7 + favicon + QA = ~5 Tasks** → marge 13 restante pour d'autres chantiers (ex : démarrage agent secrétariat ISSA Capital, propagation cross-projets des learnings, etc.)

### Branche pour session 7

**Créée en début session 7** : `claude/resume-issa-session-7-1SjaO` (imposée par la configuration git du harness) à partir de `claude/resume-issa-session-6-UDiOS`. Mise à jour effectuée en Phase 0 session 7 : seuls `project-context.md` et `docs/orchestration-plan.md` contiennent l'ancien nom de branche. Pas d'`index.html` / `INSTALL.md` / `install.sh` / `update.sh` dans ce repo projet (règle 12 CLAUDE.md respectée).

---
## Mémo de reprise — Session 9 (clôture sessions 7-8 le 2026-04-09)

### État à la clôture session 8
- **Branche active session 7-8** : `claude/resume-issa-session-7-1SjaO` (HEAD commit `2efe806`)
- **Site vitrine** : Pipeline G28 vert (tsc 0 / lint 0 / vitest 7/7 / build 15/15 / Playwright 21/21)
- **Secrétariat ISSA** : Pipeline vert (tsc 0 / 254/254 tests / build OK). Toutes les Phases code livrées (1-7). Deployment guide dans `secrétariat/DEPLOYMENT.md`.
- **Compteur producteurs session 7-8** : 18/18 Tasks (ALERTE ROUGE atteinte)

### Chantiers livrés session 7-8

**Site vitrine** :
- Phase 7 mega-passe : homepage stats-only, /mission RICHE v2, /participations Variante A, /accompagnement Variante A flexible
- Favicon Variante A (sans-serif géométrique Futura-like) centrée dans sceau circulaire (ink-950 + parchment-100 + levant-500)
- Bio Thomas /mission V1+++ : "TEOS bâtie de zéro en moins d'un an, déployée dans sept régions du monde" + "agence internationale de quarante experts"
- /participations : Gradient One en encart dédié, Calendrier Tempo ajouté (2026), grille 3 colonnes section tech
- /opportunités : section S2 fantôme supprimée (fusionnée Hero), tone S4 elevated, tone S7 subtle
- Menu : ordre Opportunités → Accompagnement inversé
- Délais réponse : "dans la journée" → "sous 72h"
- Formulaire contact : "Thomas Issa" → "l'un des membres de la famille", placeholder "Antoine Vasseur"
- TEOS /accompagnement : "ROI 6000%" → "0 à 8 M€ de CA en 4 ans"
- Formation Thomas : quadrilingue → bilingue
- Paragraphe agence : "Depuis 2018... 35 experts" → "Depuis 2020... 40 experts"
- "Depuis 2020, il co-fonde ISSA Capital" → "Depuis 2026"
- Parenthèse "— 2J Impression, l'écosystème ISSA Capital —" retirée

**Secrétariat ISSA (sous-dossier `secrétariat/`)** :
- Phase 1 : Express + SQLite 8 tables + env.ts Zod + logger Pino + health endpoint (20 tests)
- Phase 2 : WhatsApp Cloud API — webhooks + HMAC + whitelist + sessions 24h + dispatcher (36 tests)
- Phase 3 : Anthropic SDK + prompt caching + routes draft/drafts + validation Zod (32 tests)
- Phase 4 : Craft API + mapper CR→Markdown + routes publish/published + référence IC-CR-YYYY-XXXX (46 tests)
- Phase 5 : Admin web /admin — auth JWT bcrypt + 5 modules CRUD + UI vanilla HTML/CSS/JS (66 tests)
- Phase 6 : SQLCipher prep + 2FA TOTP speakeasy + Universign RFC 3161 + helmet CSP + accessLogger + backup cron + rate-limit WhatsApp (49 tests)
- Phase 7 : 5 tests E2E full-flow (happy path + cancel + non-whitelist + rate-limit + HTTP publish)

### Phase 8 — Actions Thomas (NON DÉMARRÉES)

Toutes les actions sont documentées step-by-step dans `secrétariat/DEPLOYMENT.md` :
1. DPA Anthropic + DPA Replit + vérification DPF
2. Email RGPD Art. 13 → Carl + Maxime
3. NDA + mandat Carl + Maxime
4. Compte Universign + clé API
5. Numéro WhatsApp Business pro + vérification Meta (24-48h)
6. Adresse contact@issa-capital.com
7. Déploiement Replit (Secrets, volume persistant, migrations, seed)
8. Webhook Meta configuré
9. Activation 2FA admin + changement mot de passe allezpsg
10. Crons (backup quotidien + RFC3161 backfill hebdo)
11. UptimeRobot + alerte coût Anthropic

### ✅ PROPAGATION P1/P2 — DONE (session 9 Phase 0, 2026-04-09)

8 learnings session 7-8 propagés dans 10 fichiers agents (CLAUDE.md, orchestrator.md, fullstack.md, infrastructure.md, creative-strategy.md, copywriter.md, design.md, ia.md, legal.md, product-manager.md). Statut propagation mis à jour dans `docs/lessons-learned.md`.

### Décisions Thomas verrouillées session 7-8

- Favicon : Variante A sans-serif géométrique centrée (retenue après Direction A rejeté session 5 + Sceau sérif rejeté session 7)
- /accompagnement : Variante A flexible ("l'un, l'autre ou les deux selon la mission")
- Bio Thomas /mission V1+++ (pas de chiffre financier sur /mission, réservé à /accompagnement)
- Calendrier Tempo : date 2026, rôle Actionnaire
- Placeholder ContactForm : "Antoine Vasseur" (pas de Dupont/Lemoine)
- Délais réponse : sous 72h (pas dans la journée)

---

## Mémo de reprise — Session 10 (clôture session 9 le 2026-05-10)

### Numéro de session : 10

### Date de clôture : 2026-05-10


### Branche active : `claude/issa-capital-s10-obsidian-restructure-HFevS`

### Résumé de la session 10 (en cours)

**Vault Obsidian restructuré** — session 10 a peuplé le vault avec du contenu réel :
- 8 fiches Projets (ISSA Capital, Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, Immobilier Direct, 2J Impression)
- 14 fiches Contacts (11 complets + 3 partiels famille)
- 6 README dans les dossiers vides (Réunions, Journal, Notes/Idées, Notes/Learnings, Notes/Cuisine, Notes/Voyages)
- Dashboard.md avec requêtes Dataview
- SETUP-ASANA.md + SETUP-CRAFT.md (60 secondes chacun, via directory connectors natifs Claude)
- Alignement docs/product/secrétariat-contacts-database.md (Carl, Maxime, Martin, Emmanuel)
- Renommage ASCII des dossiers/fichiers (Reunions, Taches, Idées, Darre, Guerin) — règle CLAUDE.md n°20

**Asana + Craft = connectors natifs Claude** : claude.ai/customize/connectors -> 1 clic OAuth, tous plans Claude. Ne JAMAIS proposer de setup MCP technique custom (Node.js, PAT, config JSON) avant d'avoir vérifié le directory natif. Règle CLAUDE.md n19 ajoutée.

**Clarification Claude Code vs Claude.ai (session 10)** : les connectors natifs (Craft, Asana, Google Drive) vivent dans l'interface Claude.ai/Desktop et sont lies au compte utilisateur de Thomas. Claude Code (Replit sandbox) n'y a PAS acces. Workflow valide : Thomas utilise Claude.ai pour l'extraction (connectors), Claude Code pour le formatage et la redistribution dans le repo/vault. SETUP-DRIVE.md documente comment connecter le vault Obsidian a Google Drive pour que Claude.ai puisse y écrire directement à terme.

### Actions Thomas session 10

1. **Ouvrir le vault dans Obsidian** — pointer vers le dossier `second-cerveau/`
2. **Installer les plugins Dataview + Homepage** — suivre SETUP.md section 7
3. **Compléter les champs `[à compléter par Thomas]`** dans les fiches Projets et Contacts
4. **~~Asana + Craft~~** — déjà connectes par Thomas via les connectors natifs claude.ai/customize/connectors
5. **Audit Craft + Asana via Claude.ai** — copier le super-prompt (fourni par Claude Code session 10) dans une conversation Claude.ai/Desktop (avec connectors Craft + Asana actifs). Claude.ai produit un fichier IMPORT-PLAN.md. Thomas copie le résultat et le donne a Claude Code pour redistribution dans le vault. IMPORTANT : Claude Code (Replit) n'a PAS acces aux connectors Craft/Asana/Drive — seul Claude.ai/Desktop les voit.
6. **Setup Google Drive pour le vault** — suivre `second-cerveau/SETUP-DRIVE.md` (Option A recommandée : vault dans dossier Google Drive synchronise localement). Cela permettra a Claude.ai d'écrire directement dans le vault via le connector Drive.
7. **Donner le résultat IMPORT-PLAN.md a Claude Code** — une fois que Claude.ai a produit l'inventaire, le transmettre a Claude Code pour redistribution automatique dans les bonnes fiches du vault

### Résumé de la session 9

Session massive couvrant 91 commits. Travaux majeurs :

1. **Propagation learnings sessions 7-8** — 8 learnings propagés dans 10 fichiers agents
2. **Site vitrine converti en monopage** — nav vidé, sections empilées, 2 CTAs #contact, FAQ JSON-LD
3. **Bot Telegram "Anya"** — secrétariat IA complet (webhook Next.js API route, Claude API avec web search, photos, PDFKit A4, Google Drive OAuth2 upload, contacts récurrents, historique CR, compteur IC-CR-YYYY-XXXX). 68 tests (4 suites) tous PASS
4. **SEO/GEO optimisés 10/10** — JSON-LD enrichi (Organization + subOrganization + FAQPage), robots.ts opt-in 11 bots IA, llms.txt, sitemap nettoyé, canonical unifié
5. **Claude Profile** — 9 fichiers réutilisables (red-lines, voice, work, content-templates, brand-identity, technical, about-me, lifestyle, CLAUDE.md). Score @ia 9.96/10
6. **Second cerveau Obsidian** — vault complet (Profil, Projets, Contacts, Réunions, Tâches, Journal, Idées, Cuisine, Learnings, Ressources) + 7 templates + SETUP.md + sync Obsidian Sync
7. **LinkedIn post testing** — pipeline triple audit >= 9/10 établi, v4 à 8.5/10
8. **Umami Analytics** — Plausible retiré, Umami intégré (préférence fondateur)

### Travaux en cours

- **MCP Gmail/Calendar** : ANNULÉ — Claude Desktop a une intégration Google native (Settings > Integrations). Thomas doit simplement connecter son compte Google dans l'interface.
- **Anya v2** (actions auto-trackées, préparation réunion, suivi hebdo) — Thomas "garde l'idée" mais pas prioritaire
- **robots.ts** : vérifié intact (opt-in 11 bots IA présent)

### Décisions Thomas verrouillées session 9

- **Zéro MVP** : le mot "MVP" est banni. Tout livrable = brief complet
- **"famille libanaise" interdit** (retour Jean-Pierre) → "racines libanaises", "d'origine libanaise", "famille Issa"
- **Umami uniquement** — jamais Plausible ni GA4
- **Storytelling-first** pour tout contenu
- **Triple audit >= 9/10** avant soumission à Thomas
- **"Si on n'a rien à dire, on ne dit rien"** — Claude n'invente pas de contenu
- **Humilité confiante** — "sûr de mes forces" mais pas de superlatifs

### Prochaines actions recommandées

1. **Déploiement Anya** (@infrastructure) — suivre `src/app/api/telegram/webhook/` (webhook déjà intégré dans le site Next.js). Configurer le webhook Telegram Bot API vers `https://issa-capital.com/api/telegram/webhook`. Secrets à ajouter dans Replit : `TELEGRAM_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Priorité : Thomas attend ce bot pour ses CR de réunion.
2. **Phase 8 actions Thomas** (non-agent) — DPA Anthropic/Replit, email RGPD Carl/Maxime, mandat NDA, signature PNG. Documenté dans le mémo session 9 ci-dessus (section Phase 8).
3. **Connexion Gmail/Calendar Claude Desktop** — Thomas doit aller dans Settings > Integrations de Claude Desktop et connecter son compte Google. Aucune action technique requise.

### Blockers

- Aucun blocker technique
- Actions Thomas (Phase 8) non démarrées — nécessitent des démarches juridiques/administratives

---

## Historique des interventions agents — Sessions 1-9

> Archivé depuis project-context.md en session 14 (2026-05-13). Les entrées ci-dessous couvrent toutes les interventions agents des sessions 1 à 9.

| Agent | Date | Fichiers produits | Décisions clés | Pourquoi / Alternatives écartées |
|-------|------|-------------------|----------------|----------------------------------|
| creative-strategy | 2026-04-07 | brand-platform.md, personas.md, competitive-benchmark.md | Positionnement holding familiale lisible. Archétype Ruler/Caregiver puis Ruler/Outlaw. Personas : Karim (principal), Leila (secondaire), Marc (journaliste). | Golden Circle + Prisme Kapferer. Espace libre identifié par WebSearch. |
| creative-strategy (révision) | 2026-04-07 | personas.md, brand-platform.md | Suppression Hélène+Sophie (scope invalide), création Karim+Leila. Baseline "Racines libanaises. Exigences sans exception." | Scope business recadré par Thomas : immo + participations, pas cession PME. |
| légal | 2026-04-07 | légal-audit.md, rgpd-checklist.md | Risque L.411-1 CMF maîtrisé. Plausible cookieless = pas de bandeau. DPA Resend obligatoire. | Consentement > intérêt légitime pour formulaire. |
| product-manager | 2026-04-07 | product-vision.md, functional-specs.md, execution-plan.md | Site vitrine pur, 10 anti-features, KPI = demandes qualifiées/mois, formulaire 7 champs. | Formulaire qualifiant > générique. |
| design | 2026-04-07 | design-system.md, design-tokens.json, component-library.md, page-compositions.md | Palette noir-crème-ocre, EB Garamond + Inter, tokens 3 tiers, WCAG 2.2 AA. | Ocre levantin > bleu corporate. Typo as hero (budget 0€). |
| copywriter (×5) | 2026-04-07 | brand-voice.md, landing-page-copy.md, page-mission.md, page-accompagnement.md, page-opportunites.md, page-participations.md, page-contact.md, page-legal.md | Vouvoiement universel, 2 CTAs Karim/Leila, filiation Jean-Pierre Issa, anti-L.411-1 CMF. | Frameworks BAB/PAS/FAB par page. |
| ux | 2026-04-07 | user-flows.md, wireframes.md, ux-audit.md | 2 pages /accompagnement + /opportunités (parcours incompatibles). Formulaire 4 vs 7 champs. | Split parcours Karim/Leila. |
| design (WCAG) | 2026-04-07 | design-tokens.json, page-compositions.md, component-library.md, design-system.md | levant-600 pour text-accent (4.6:1 PASS). levant-500 interdit texte normal fond clair. | levant-600 > levant-700 (visuellement plus proche charte). |
| product-manager (personas) | 2026-04-07 | functional-specs.md | Remplacement Hélène/Sophie par Karim/Leila dans toutes les US. 3 nouvelles US ajoutées. | Formulaire immo recalé sur Leila. |
| seo | 2026-04-07 | seo-strategy.md, keyword-map.md, metadata-templates.md, structured-data.md | SEO défensif marque, 12 requêtes, Schema JSON-LD, robots.ts AI crawlers autorisés. | Défensif > offensif (vitrine, pas funnel). |
| design (assets) | 2026-04-07 | SVG logos/favicons, og-image-source.svg, site.webmanifest, assets-handoff.md | Monogramme IC, palette verrouillée, manifest PWA. | Direction A IC choisie (silhouette 16px). |
| creative-strategy (S6-8) | 2026-04-08 | gradient-one-angle-options.md, mission-vs-apropos-audit.md, favicon-brief-session6.md, mission-refonte-10-10.md, participations-refonte-10-10.md, accompagnement-refonte-10-10.md | Refontes 10/10 des 3 pages. Fusion /a-propos dans /mission. Favicon IC Direction A. | Variantes RICHE/A/A recommandées. |
| fullstack (×10+) | 2026-04-07→09 | Code TSX complet 6 pages, formulaires, JSON-LD, sitemap, favicon binaires, logo SVG fill, monopage S9, bot Anya, vault Obsidian | Implémentation de tous les retours Thomas, pipeline G28 PASS systématique. | Edits chirurgicaux, idempotence vérifiée. |
| reviewer (×3) | 2026-04-07→08 | cross-review-report.md, cross-review-session4.md, cross-review-session5.md | GO CONDITIONNEL systématique, score 9.4-9.5/10. | Audit par gate (fail-fast) > par livrable. |
| qa | 2026-04-08 | qa-bloc4-final-review.md, qa-session5-report.md | Pipeline 5/5 PASS, 154/156 Playwright, 11/11 US couvertes. | Vérification indépendante du pipeline @fullstack. |
| ia | 2026-04-08→09 | secrétariat-architecture.md, secrétariat-system-prompt.md, secrétariat-implementation-plan.md, claude-profile (9 fichiers) | Architecture Anya 14 endpoints, RBAC, compteur IC-CR, Claude Profile cross-projets. | SQLite > JSON (transactions exclusives). 1 prompt unique > 7 templates. |
| infrastructure | 2026-04-07 | REPLIT_ACTIONS.md, infrastructure.md | Procédure déploiement 9 étapes, Autoscale, apex sans www, rollback 1 clic. | Autoscale > Reserved VM (vitrine faible trafic). |
| copywriter (S4-6) | 2026-04-08 | hero-tagline-alternatives.md, simplification-audit.md, copy-audit-antifiller.md, about-page-copy.md | Règle "Simple > Démonstratif", purge antithèses, about-page copy. | Simplicité > Démonstration promue en P0. |
| main thread (S9 clôture) | 2026-05-10 | founder-preferences.md, lessons-learned.md, project-context-archive.md | Propagation P0 "Zéro MVP", archivage, création founder-preferences.md. | Guide MCP supprimé (Claude Desktop intégrations natives). |

### Nom de branche recommandé session 10

`claude/issa-capital-s10-deploy-anya-`

### Commande de reprise suggérée

```
reprise ISSA Capital session 10 — Branche : claude/issa-capital-s10-deploy-anya-[suffix]. Priorités : (1) déploiement bot Anya — configurer webhook Telegram + Secrets Replit, (2) si Thomas a fait les actions Phase 8 → activer le bot en production. Lire project-context.md + docs/lessons-learned.md avant toute action. Branche précédente : claude/resume-issa-session-9-Y9WBK.
```

---

## Mémo de reprise — Session 11 (clôture session 10 le 2026-05-12)

### Numéro de session : 11

### Date de clôture : 2026-05-12

### Branche active : `claude/issa-capital-s10-obsidian-restructure-HFevS` (à renommer pour session 11)

### Nom de branche recommandé pour session 11
`claude/issa-capital-s11-anya-phase2-quittances-[suffix]`
(ou autre slug selon priorité — voir prochaines actions ci-dessous)

### Résumé de la session 10

Session dense couvrant vault Obsidian + extension Anya. Travaux majeurs :
1. **Vault Obsidian peuplé** : 8 fiches Projets + 14 fiches Contacts (zéro invention, sources citées) + Dashboard Dataview + alignement contacts-database.md
2. **Correction MCP P1 RÉCIDIVE** : Asana et Craft sont des connectors natifs Claude (claude.ai/customize/connectors), pas besoin de MCP technique. SETUP-ASANA-MCP/CRAFT-MCP supprimés, réécrits en SETUP-ASANA/CRAFT (5 lignes chacun)
3. **Noms ASCII** : tous les dossiers/fichiers avec accents renommés (Reunions, Taches, Idées, Darre, Guerin)
4. **2 nouvelles règles framework** : CLAUDE.md n°19 (connectors natifs avant MCP) + n°20 (noms ASCII pur)
5. **SETUP-DRIVE.md** : stratégie Drive Desktop sync + Obsidian Sync mobile
6. **Super-prompt Claude.ai** : pour audit Craft+Asana via connectors et import dans vault
7. **Architecture Anya multi-workflows** : Mode (inbox) vs Workflow (CR/quittance/bail). Phase 1 implémentée : workflows/ directory + inbox.ts + router 3 niveaux. 102/102 tests, 0 erreur TS, zéro casse flow CR existant

### Travaux en cours

- **Phase 2 Anya (quittances/baux)** : architecture prête, à implémenter en session future. Pattern : 1 fichier `workflows/quittance.ts` + 1 ligne `workflowRegistry`.
- **Import Craft+Asana → vault** : Thomas doit exécuter le super-prompt dans Claude.ai, récupérer IMPORT-PLAN.md, le redéposer dans Claude Code pour distribution dans le vault.
- **Drive ↔ Obsidian sync mobile** : décision Obsidian Sync (8 €/mois) ou iCloud à prendre quand Thomas voudra l'usage mobile.
- **Favicon session 8** : 3 variantes typographiques toujours en attente décision Thomas (variante A sans-serif / B Didone / C humaniste).

### Prochaines actions recommandées

1. **Activation Anya inbox en prod** (Thomas, ~5 min) :
   - Révoquer token Telegram exposé en chat (@BotFather)
   - Créer nouveau token, ajouter en Replit Secrets `TELEGRAM_BOT_TOKEN`
   - ~~Ajouter en Replit Secrets : `DRIVE_INBOX_FOLDER_ID=18m0Vq_Y1rbdnJ-SfTcoRKWCi0GJ0iCuJ`~~ — **Corrigé session 11** : la bonne valeur Replit Secrets est `DRIVE_INBOX_FOLDER_ID=1Q8FJkcU9X06QsBDGPsHXV8y64QBpv0Fp` (test live upload, Thomas a vu les photos dans le sous-dossier `Photos` de ce dossier). L'ID `18m0Vq...` documenté à la clôture S10 était erroné — déjà configuré dans Replit à ce moment-là.
   - Redéployer et tester (photo, texte, voix, doc, album, /cr, /status)
2. **Phase 2 workflow quittance** (`@fullstack` quand Thomas voudra) — création de `workflows/quittance.ts` + template PDF + tests. ~1 session.
3. **Import Craft → vault** (Thomas dans Claude.ai puis Claude Code) — quand Thomas voudra rapatrier ses notes Craft.

### Blockers

- Aucun blocker technique
- Token Telegram : à révoquer/recréer par Thomas (exposé dans une conversation chat session 10)
- Décision favicon : 3 variantes en attente Thomas depuis session 8

### Décisions Thomas verrouillées session 10

- **Architecture Anya** : Mode `inbox` par défaut (0 API Claude) + Workflows structurés (CR + futurs quittance/bail) sur API Sonnet 4.6
- **Connectors natifs** : toujours préférer claude.ai/customize/connectors aux setups MCP custom (règle n°19)
- **ASCII pour fichiers/dossiers** : accents OK dans le contenu, pas dans les chemins (règle n°20)
- **Pas de dichotomie Pro/Perso** dans vault : un contact reste un contact (préférence fondateur)
- **Qualité > coût** : "ne gâchons ni l'usage ni la qualité, optimisons ce qui doit l'être tant que pas d'impact négatif"

### Commande de reprise suggérée

```
@orchestrator Mode reprise de session pour ISSA Capital session 11. Lis project-context.md (mémo session 11) + docs/lessons-learned.md. Vérifie les caps (CLAUDE.md, lessons-learned, founder-preferences, project-context). Si Phase 2 Anya prioritaire → délègue à @fullstack pour implémenter workflow quittance (pattern documenté : workflows/quittance.ts + entrée registry + template PDF + tests). Sinon : suis les 3 prochaines actions du mémo dans l'ordre.
```

---

