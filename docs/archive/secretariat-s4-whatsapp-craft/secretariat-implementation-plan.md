# Plan d'implémentation V1 — Agent Secrétariat ISSA Capital

> Produit par @ia le 2026-04-08, session 4.
> Mission : plan d'exécution V1 pour @fullstack — 8 phases séquencées par dépendances strictes.
> Sources amont : `docs/ia/secretariat-architecture.md`, `docs/ia/secretariat-system-prompt.md`, `docs/legal/secretariat-agent-legal-audit.md` (Bloc 7).

---

## 0. Mode "vélocité IA"

Conformément à la règle CLAUDE.md n°5, ce plan ne mesure PAS en jours-homme mais en heures de travail @fullstack. La séquence est dictée par les dépendances de livrable, pas par la disponibilité d'une équipe humaine.

**Phases parallélisables** : repérées par le marqueur `[PARALLELE]`. L'orchestrateur peut lancer plusieurs sous-tâches @fullstack en parallèle si elles n'ont pas de dépendance commune.

**Estimation totale V1** : 12-18 heures de travail @fullstack effectif (hors actions Thomas Phase 8).

---

## Phase 1 — Setup Replit + DB + endpoints fondation

**Objectif** : créer le squelette serveur Express, initialiser la base SQLite, exposer les endpoints CRUD de base.

**Livrables techniques** :
- `src/server/index.ts` : serveur Express avec middleware (cors, helmet, body-parser, rate-limit)
- `src/server/db/connection.ts` : initialisation SQLite (mode SQLCipher si possible) + gestion volume Replit persistant
- `src/server/db/schema.sql` : DDL complet des 7 tables (cf architecture Section 2)
- `src/server/db/migrations/` : système de migration simple (script Node)
- `src/server/db/seed.ts` : import initial des contacts depuis `docs/product/secretariat-contacts-database.md`
- `src/server/routes/health.ts` : endpoint `GET /api/health` pour UptimeRobot
- Variables Replit Secrets configurées (squelette — sans valeurs sensibles)
- `package.json` avec dépendances : `express`, `better-sqlite3` (ou `@journeyapps/sqlcipher`), `zod`, `pino` (logger)

**Dépendances** : aucune (phase d'amorçage).

**Points de validation Thomas** : aucun (phase technique).

**Effort estimé** : 2-3h.

---

## Phase 2 — Intégration WhatsApp Cloud API

**Objectif** : recevoir et envoyer des messages WhatsApp via l'API officielle Meta.

**Livrables techniques** :
- `src/server/services/whatsapp.ts` : wrapper Meta Cloud API (send + parse webhook payload)
- `src/server/routes/whatsapp.ts` : 
  - `GET /api/whatsapp/webhook` : vérification token Meta
  - `POST /api/whatsapp/webhook` : réception messages, validation signature `X-Hub-Signature-256`
- Validation whitelist : middleware `whitelistGuard` qui vérifie `phone_e164`
- Système de session : création/lecture/update de `whatsapp_sessions` avec TTL 24h
- Test manuel : envoyer un message au numéro pro depuis WhatsApp et vérifier la réception côté backend (echo simple)

**Dépendances** : Phase 1 terminée. Numéro WhatsApp pro acquis et vérifié dans Meta Business Manager (action Thomas Phase 8 — peut être anticipée).

**Points de validation Thomas** :
- Confirmer le numéro WhatsApp pro acquis
- Tester l'envoi/réception d'un message simple

**Effort estimé** : 2-3h. Peut être bloqué par la vérification Meta du numéro pro (24-48h côté Meta, action externe).

---

## Phase 3 — Intégration Anthropic API + system prompt `[PARALLELE Phase 2]`

**Objectif** : appeler Claude Sonnet 4 avec le system prompt et obtenir un JSON CR validé.

**Livrables techniques** :
- `src/lib/ai/claude-client.ts` : wrapper `@anthropic-ai/sdk` avec :
  - Activation prompt caching (`cache_control: ephemeral`)
  - Retry exponentiel sur 429/5xx
  - Self-correction sur erreur Zod (max 2 retries)
  - Logging dans `generation_logs`
- `src/lib/ai/system-prompt.ts` : export de la constante du system prompt (cf Livrable 2 Section 2)
- `src/lib/ai/cr-schema.ts` : schémas Zod (cf Livrable 2 Section 3)
- `src/lib/ai/cr-renderer.ts` : helpers de rendu markdown post-LLM (cf Livrable 2 Section 4)
- `src/lib/ai/contacts-injector.ts` : fonction qui charge la database contacts depuis SQLite et la formate pour injection dans le prompt (avec filtrage RBAC)
- Test unitaire : appeler `generateCR` avec un input fictif et vérifier la validation Zod

**Dépendances** : Phase 1 terminée. Variable `ANTHROPIC_API_KEY` configurée.

**Points de validation Thomas** : aucun (phase technique).

**Effort estimé** : 2-3h.

**Parallélisable avec Phase 2** : oui — pas de dépendance entre l'intégration WhatsApp et l'intégration Anthropic.

---

## Phase 4 — Intégration Craft API + publication

**Objectif** : publier un CR finalisé dans le bon dossier Craft avec la convention de nommage et le tag CONFIDENTIEL.

**Livrables techniques** :
- `src/server/services/craft.ts` : wrapper Craft API avec :
  - `createDocument(workspace, folderId, title, content, tags)`
  - `listDocuments(workspace, folderId, options)` (pour la sidebar admin)
  - `ensureYearFolder(workspace, year)` : créer `/CR/2026/` si absent
  - Sélection workspace selon entité (IC vs autre)
  - Retry sur erreurs réseau, mise en file d'attente sur erreur persistante
- `src/server/services/cr-publisher.ts` : orchestrateur de publication :
  1. Génération référence `IC-CR-2026-XXXX` (transaction exclusive)
  2. Génération filename selon convention nommage @moi
  3. Rendu markdown final (header + body LLM + footer)
  4. Hash SHA-256
  5. Appel Universign (Phase 6) — si Universign non encore implémenté, publication SANS token RFC 3161 (fallback documenté)
  6. Création document Craft
  7. Insertion `cr_published`
  8. Log `access_logs`
- `src/server/routes/cr.ts` : endpoint `POST /api/cr/publish`
- Tests : publication d'un CR de test dans un workspace Craft sandbox

**Dépendances** : Phase 3 terminée (le markdown final dépend du JSON validé). Documentation officielle Craft API consultée et validée par @fullstack (action préalable critique — cf [À VALIDER] #1 Architecture).

**Points de validation Thomas** :
- Confirmer la création du dossier `/CR/` dans les 2 workspaces Craft
- Confirmer les tokens d'API Craft

**Effort estimé** : 3-4h (incluant la lecture de la doc Craft).

---

## Phase 5 — Admin web `issa-capital.com/admin`

**Objectif** : interface web pour gérer contacts, voir historique CR, lire logs, configurer paramètres.

**Livrables techniques** :
- `src/admin/` : app React (ou Next.js si déjà la stack du site issa-capital.com) servie sous `/admin`
- **Module 1 — Gestion contacts (CRUD)** :
  - Liste paginée + recherche
  - Formulaire création/édition
  - Suppression soft (avec log)
  - Toggle `whatsapp_authorized`
- **Module 2 — Historique CR publiés (lecture seule)** :
  - Liste paginée par entité (filtrée RBAC)
  - Lien vers Craft pour chaque CR
  - Affichage du token RFC 3161
  - Onglet "Brouillons en cours" (lecture seule)
- **Module 3 — Logs (Thomas only)** :
  - `access_logs` : qui a lu/publié quoi, quand
  - `generation_logs` : prompts envoyés à Claude, latence, coût
  - Filtres par utilisateur, par date, par entité
- **Module 4 — Paramètres** :
  - Whitelist numéros WhatsApp (CRUD)
  - Upload signature PNG (input file → stockage volume Replit + URL servie en `/admin/static/signature.png`)
  - Switch entités actives
  - Configuration alerte coût mensuel (lecture du seuil 10 €)
- **Authentification** :
  - V1 : login mot de passe simple `allezpsg` (ADMIN_PASSWORD_HASH bcrypt)
  - Session JWT 24h cookie httpOnly
- Routing : middleware Express qui sert `/admin/*` après auth, redirige vers `/admin/login` sinon

**Dépendances** : Phase 1 (DB) + Phase 4 (publication) terminées. Domaine `issa-capital.com` configuré pour pointer vers Replit.

**Points de validation Thomas** :
- Tester le login admin avec le mot de passe `allezpsg`
- Tester la création d'un contact
- Tester l'upload de la signature PNG
- Valider le rendu visuel des 4 modules

**Effort estimé** : 4-5h.

---

## Phase 6 — Sécurité (whitelist, 2FA, logs, chiffrement, horodatage)

**Objectif** : durcir la sécurité avant la mise en production.

**Livrables techniques** :
- **2FA admin** : intégration `speakeasy` (TOTP) — Thomas active depuis le module 4
- **Chiffrement at rest** : SQLCipher activé (clé dans `SQLITE_ENCRYPTION_KEY` Replit Secret)
- **Horodatage RFC 3161** :
  - `src/server/services/universign.ts` : wrapper API Universign
  - Intégration dans le flow `cr-publisher.ts` (étape 5)
  - Cron quotidien : re-générer les tokens manquants pour les CR `WHERE rfc3161_token IS NULL`
  - Variable `UNIVERSIGN_API_KEY` configurée
- **Validation input anti-injection** : limite 5000 chars, filtres caractères contrôle, regex URL
- **Rate limiting whitelist** : 5 req/min, 20 req/h par numéro
- **Headers sécurité** : helmet.js avec CSP strict
- **Logs d'accès** : middleware Express qui insère dans `access_logs` à chaque requête API authentifiée
- **Backup SQLite** : cron quotidien export `.sqlite` vers bucket externe (B2/S3 — choix @infrastructure)

**Dépendances** : Phases 1-5 terminées. Compte Universign créé (action Thomas Phase 8). Bucket externe choisi (input @infrastructure).

**Points de validation Thomas** :
- Activer la 2FA depuis l'admin
- Confirmer le compte Universign

**Effort estimé** : 2-3h.

---

## Phase 7 — Tests bout en bout + 1 CR de test

**Objectif** : valider le flow complet sur une réunion réelle. (cf Q12.2 Thomas — "1 CR de test")

**Livrables techniques** :
- **Tests unitaires** :
  - Validation Zod sur les 5 test cases du Livrable 2 Section 5
  - Détection formules bannies B1-B12 (regex)
  - Présence formules F1-F15 dans les test cases nominaux
  - Génération référence (transaction exclusive, pas de doublons)
- **Tests d'intégration** :
  - Mock Anthropic API → vérifier que le wrapper retry fonctionne
  - Mock Craft API → vérifier que le file queue fonctionne sur erreur
  - Test RBAC : Carl essaie de lire un CR IC → 404
- **Pipeline d'éval** :
  - Promptfoo configuré avec les 5 test cases
  - Run automatique en CI à chaque commit sur `src/lib/ai/`
  - Métriques tracked : faithfulness, format compliance, registre passé composé, absence formules bannies
- **CR de test bout en bout** :
  - Thomas envoie un message WhatsApp réel ("Réunion test du jour, déjeuner avec [contact connu]...")
  - Vérification : preview dans WhatsApp, validation OK, publication Craft, présence dans admin, log généré
  - Validation Thomas : le rendu correspond à son standard de qualité

**Dépendances** : Phases 1-6 terminées.

**Points de validation Thomas** :
- Test du flow complet bout en bout
- Validation qualité du CR généré
- GO ou NO-GO pour la mise en production réelle

**Effort estimé** : 1-2h (hors validation Thomas).

---

## Phase 8 — Actions juridiques préalables Thomas (BLOQUANTES)

**Objectif** : accomplir les actions juridiques bloquantes documentées par @legal Bloc 7 Priorité 1.

**Ces actions sont 100% Thomas, pas @fullstack. @fullstack peut développer en parallèle (Phases 1-7) mais NE DOIT PAS activer la production tant que Phase 8 n'est pas COMPLETE.**

**Checklist Thomas** :

- [ ] **DPA Anthropic signé** : aller sur privacy.anthropic.com, signer le Data Processing Agreement, vérifier la clause de non-utilisation des données API pour l'entraînement. Conserver le PDF signé. *(15 min)*
- [ ] **DPA Replit signé** : vérifier les conditions Replit, signer DPA si disponible, ou noter inscription DPF. *(15 min)*
- [ ] **Email RGPD Carl + Maxime** : envoyer le document d'information Art. 13 RGPD AVANT whitelisting. Conserver l'accusé de réception. *(30 min — template fourni par @legal Bloc 5)*
- [ ] **Mandat + NDA Carl + Maxime** : rédiger et faire signer le mandat d'accès + clause de confidentialité (1-2 pages, signature électronique Yousign possible). *(30 min)*
- [ ] **Upload signature PNG** : scanner la signature manuscrite, exporter en PNG transparent, uploader via le module 4 admin. Vérifier le rendu dans un CR de test. *(10 min)*
- [ ] **Compte Universign créé** : créer un compte sur universign.com, récupérer l'API key, l'ajouter dans Replit Secrets. *(15 min)*
- [ ] **Numéro WhatsApp pro acquis** : acquérir un numéro pro dédié, le vérifier dans Meta Business Manager, créer la WABA. *(1-2h, peut prendre 24-48h pour la vérification Meta)*
- [ ] **Adresse `contact@issa-capital.com` créée** : créer une adresse email ou rediriger vers Thomas (action @infrastructure). *(15 min)*
- [ ] **Vérification DPF Anthropic** : vérifier l'inscription d'Anthropic sur dataprivacyframework.gov. *(5 min)*

**Total estimé Thomas** : ~3-4h cumulées + délais externes (Meta, signatures).

**Dépendances** : aucune (Thomas peut commencer dès maintenant en parallèle des phases techniques).

---

## Synthèse : ordre d'exécution recommandé

```
[Phase 8 — Thomas] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (en parallèle)

[Phase 1 — Setup] → [Phase 2 — WhatsApp] ━┓
                  → [Phase 3 — Anthropic] ━╋→ [Phase 4 — Craft] → [Phase 5 — Admin] → [Phase 6 — Sécu] → [Phase 7 — Tests] → GO
```

**Total effort @fullstack** : 12-18h de travail effectif sur 7 phases techniques + ~3-4h Thomas en parallèle pour Phase 8.

**Mode vélocité IA** : ce plan est exécutable en 1-2 sessions de travail (3-6h chacune), à condition que Phase 8 (actions Thomas) soit menée en parallèle dès le début.

---

## Critères de validation finale (avant mise en production)

- [ ] Les 5 test cases du Livrable 2 Section 5 passent à 100%
- [ ] Le CR de test Phase 7 est validé par Thomas (rendu, contenu, conformité @legal)
- [ ] Tous les items Phase 8 sont cochés
- [ ] La 2FA admin est activée
- [ ] L'horodatage Universign fonctionne sur le CR de test
- [ ] Les logs `access_logs` et `generation_logs` enregistrent correctement
- [ ] Le RBAC est testé (Carl ne peut PAS accéder à un CR IC)
- [ ] UptimeRobot est configuré sur `/api/health`
- [ ] L'alerte coût Anthropic est configurée (> 10 €/mois)
- [ ] Le mot de passe `allezpsg` est CHANGÉ en production

---

## Handoff

---
**Handoff → @orchestrator + @fullstack**

**Fichiers produits** :
- `/home/user/ISSA-Capital/docs/ia/secretariat-implementation-plan.md` (ce fichier)
- `/home/user/ISSA-Capital/docs/ia/secretariat-architecture.md` (Livrable 1)
- `/home/user/ISSA-Capital/docs/ia/secretariat-system-prompt.md` (Livrable 2)

**Décisions prises** :
- 8 phases séquencées par dépendances strictes
- Phases 2 et 3 parallélisables (WhatsApp et Anthropic indépendants)
- Phase 8 (Thomas) en parallèle dès le début
- Total effort @fullstack : 12-18h
- Validation finale : 10 critères binaires

**Points d'attention** :
- @fullstack DOIT lire la doc officielle Craft API avant de démarrer Phase 4 (point [À VALIDER] #1 Architecture)
- @fullstack ne peut PAS activer la production tant que Phase 8 (Thomas) n'est pas COMPLÈTE
- Les variables Replit Secrets (liste exhaustive Architecture Section 10.6) doivent être configurées AU FUR ET A MESURE des phases (pas tout d'un coup en début)
- La 2FA admin est en Phase 6, pas en Phase 1 — c'est volontaire (priorité fonctionnelle d'abord, durcissement après)
- Le mot de passe `allezpsg` est temporaire — checklist Phase 7 inclut "changer en production"

**Code structuré** :
- `src/lib/ai/` (périmètre @ia) : claude-client, system-prompt, cr-schema, cr-renderer, contacts-injector, evals
- `src/server/` (périmètre @fullstack) : routes, services, db, admin

---
