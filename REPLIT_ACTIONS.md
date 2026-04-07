# REPLIT_ACTIONS.md — ISSA Capital

> Liste des actions humaines à effectuer DANS l'UI Replit (non automatisables par les agents).
> Règle 15 CLAUDE.md.
> Produit par @orchestrator — 2026-04-07

---

## 🛠️ Actions obligatoires — à faire une seule fois à la configuration initiale

### 1. Import du Repl
- [ ] Créer un Repl à partir du repo GitHub `thomasissa-png/issa-capital`
- [ ] Choisir la branche `main` (ou `claude/setup-gradient-agents-UH4b6` pour preview)
- [ ] Nommer le Repl `issa-capital`

### 2. Configuration des Secrets
Dans **Tools → Secrets**, ajouter (voir `docs/infra/infrastructure.md` pour les valeurs détaillées) :
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL`
- [ ] `RESEND_TO_EMAIL`
- [ ] `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `RATE_LIMIT_MAX`
- [ ] `RATE_LIMIT_WINDOW_MS`
- [ ] `TURNSTILE_SECRET_KEY` (optionnel)
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optionnel)

### 3. Déploiement
- [ ] Aller dans **Deployments**
- [ ] Cliquer **New deployment**
- [ ] Type : **Autoscale** (site statique vitrine, faible trafic attendu)
- [ ] Build command : `npm run build`
- [ ] Run command : `npm run start`
- [ ] Cliquer **Deploy**

### 4. Domaine custom
- [ ] Dans **Deployments → Settings → Custom domain**
- [ ] Ajouter `issa-capital.com`
- [ ] Ajouter `www.issa-capital.com` (redirection vers non-www)
- [ ] Récupérer les DNS records fournis par Replit
- [ ] **Chez le registrar (OVH / Gandi / Cloudflare)** :
  - [ ] Créer A record `@` → IP Replit fournie
  - [ ] Créer CNAME record `www` → alias Replit fourni
  - [ ] Créer TXT record de vérification
- [ ] Attendre propagation DNS (1-4h typiquement)
- [ ] Vérifier certificat HTTPS Let's Encrypt (automatique une fois DNS propagé)

### 5. Monitoring
- [ ] Créer un compte UptimeRobot (gratuit, 50 monitors)
- [ ] Ajouter un monitor HTTPS sur `https://issa-capital.com/`
- [ ] Intervalle : 5 minutes
- [ ] Alerte email vers `contact@issa-capital.com` si downtime > 2 min
- [ ] (Optionnel) Alerte SMS si plan payant

### 6. Analytics Plausible
- [ ] Créer un compte Plausible (payant, ~9€/mois pour le plan Growth)
- [ ] Ajouter le site `issa-capital.com`
- [ ] Configurer les Goals dans l'UI Plausible (cf. `docs/analytics/tracking-plan.md`) :
  - [ ] `contact_form_submit` (avec propriété `type_demande`)
  - [ ] `cta_primary_click`
  - [ ] `external_link_click`
- [ ] Partager le lien du dashboard avec Thomas (public ou privé selon préférence)

### 7. Resend (email transactionnel)
- [ ] Créer un compte Resend (gratuit jusqu'à 3 000 emails/mois)
- [ ] Ajouter le domaine `issa-capital.com` dans Resend
- [ ] Configurer les records DNS fournis par Resend (DKIM, SPF, DMARC)
- [ ] Vérifier le domaine
- [ ] Générer une API key pour production
- [ ] Copier la clé dans `RESEND_API_KEY` côté Replit
- [ ] **SIGNER LE DPA RESEND** (obligation RGPD art. 28 — cf. `docs/legal/legal-audit.md`)
- [ ] Tester un envoi d'email depuis le dashboard Resend

### 8. GitHub → Replit sync
- [ ] Vérifier que Replit suit bien la branche configurée
- [ ] Activer le redéploiement automatique à chaque push sur `main` (si disponible)

---

## 🔁 Actions récurrentes post-launch

### Quotidien (Thomas — via email)
- [ ] Vérifier les nouvelles soumissions via les emails Resend reçus sur `contact@issa-capital.com`
- [ ] Répondre aux dossiers qualifiés dans la journée (engagement public du site)

### Hebdomadaire
- [ ] Consulter le dashboard Plausible (5 min) — trafic, pages vues, sources
- [ ] Vérifier UptimeRobot — aucun incident, uptime ≥ 99.9%

### Mensuel
- [ ] `npm audit --audit-level=moderate` sur le repo → déployer patches si critical/high
- [ ] Vérifier les dépendances à jour (`npm outdated`) — update mineures OK
- [ ] Revue KPI (cf. `docs/analytics/kpi-framework.md`)

### Trimestriel
- [ ] Audit Lighthouse complet (scores ≥ 95 sur les 4 axes)
- [ ] Audit accessibilité manuel (WCAG 2.2 AA)
- [ ] Revue @legal (changements réglementaires RGPD / L.411-1 CMF)

---

## ⚠️ Actions d'urgence

### Si le site tombe (UptimeRobot alerte)
1. Vérifier le status Replit : https://status.replit.com
2. Consulter les logs du Deployment Replit
3. Si bug applicatif : rollback via `Deployments → History`
4. Si problème infra Replit : attendre résolution côté Replit, prévenir Thomas
5. Si problème DNS : vérifier chez le registrar

### Si spam massif sur formulaires
1. Augmenter la rate limit (`RATE_LIMIT_MAX=2` / `RATE_LIMIT_WINDOW_MS=3600000`)
2. Activer Cloudflare Turnstile (nécessite code + secret `TURNSTILE_SECRET_KEY`)
3. Si besoin : bloquer temporairement `/api/contact` via feature flag

### Si faille sécurité identifiée
1. Patcher immédiatement (ne pas attendre le créneau mensuel)
2. Rollback si la faille est en production
3. Notifier Thomas + consigner dans `docs/lessons-learned.md`

---

## Handoff

Ce fichier doit être maintenu à jour à chaque ajout de service tiers ou changement d'infra.
