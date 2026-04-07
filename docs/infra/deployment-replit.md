# Déploiement Replit — ISSA Capital

> Procédure complète de déploiement.
> Produit par @orchestrator — 2026-04-07

---

## Prérequis

- Compte Replit actif (plan Core minimum recommandé pour domaine custom + Deployments)
- Repo GitHub `thomasissa-png/issa-capital` accessible
- Compte Resend actif + API key générée
- Compte Plausible actif + domaine `issa-capital.com` ajouté
- DNS du domaine `issa-capital.com` géré (OVH, Gandi, Cloudflare, etc.)
- DPA Resend signé (Thomas)

---

## Étapes de déploiement

### 1. Import du projet depuis GitHub
1. Dans Replit → New Repl → Import from GitHub
2. URL : `https://github.com/thomasissa-png/issa-capital`
3. Branch : `main` (ou `claude/setup-gradient-agents-UH4b6` pour preview)
4. Nom du Repl : `issa-capital`

### 2. Configuration des Secrets Replit
Dans l'onglet **Tools → Secrets**, ajouter :

| Nom | Valeur |
|---|---|
| `RESEND_API_KEY` | re_xxxxx (depuis dashboard Resend) |
| `RESEND_FROM_EMAIL` | `ISSA Capital <contact@issa-capital.com>` |
| `RESEND_TO_EMAIL` | `contact@issa-capital.com` |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `issa-capital.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://issa-capital.com` |
| `RATE_LIMIT_MAX` | `5` |
| `RATE_LIMIT_WINDOW_MS` | `600000` |
| `TURNSTILE_SECRET_KEY` | (optionnel, seulement si activé) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | (optionnel) |

### 3. Configuration du `.replit`
Fichier `.replit` à la racine :
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

### 4. Build & run local (vérification avant deploy)
```bash
npm install
npm run build
npm start
```
Vérifier que le site tourne localement sur le port par défaut Replit.

### 5. Deployment Replit
1. Onglet **Deployments** → **New deployment**
2. Type : **Autoscale** (site statique, faible trafic prévu)
3. Build command : `npm run build`
4. Run command : `npm run start`
5. Deploy

### 6. Configuration du domaine custom
1. Dans **Deployments → Settings → Custom domain**
2. Ajouter `issa-capital.com` (et `www.issa-capital.com` pour la redirection)
3. Replit fournit des **DNS records** à configurer chez le registrar :
   - `A` record `@` → IP Replit fournie
   - `CNAME` record `www` → `issa-capital.com` ou alias Replit fourni
   - `TXT` record de vérification fourni par Replit

### 7. DNS (à faire chez le registrar)
Exemple (à adapter selon l'info fournie par Replit) :
```
Type    Nom     Valeur                              TTL
A       @       <IP fournie par Replit>             3600
CNAME   www     <alias fourni par Replit>           3600
TXT     @       replit-verify=<token>               3600
```
⏱ Propagation DNS : 1-48h (typiquement 1-4h).

### 8. HTTPS (Let's Encrypt automatique)
Une fois le DNS propagé, Replit provisionne automatiquement un certificat Let's Encrypt. Vérifier que `https://issa-capital.com` charge sans warning.

### 9. Vérifications post-déploiement
- [ ] `https://issa-capital.com` charge (200)
- [ ] `https://www.issa-capital.com` redirige vers la version sans www (ou inverse selon préférence)
- [ ] Toutes les 7 pages répondent (test manuel)
- [ ] Formulaire de test sur `/contact` → email bien reçu sur `contact@issa-capital.com`
- [ ] Headers de sécurité présents : `curl -I https://issa-capital.com`
- [ ] Robots.txt accessible : `https://issa-capital.com/robots.txt`
- [ ] Sitemap.xml accessible : `https://issa-capital.com/sitemap.xml`
- [ ] og-image visible en partageant l'URL sur LinkedIn (Debug Tool : https://www.linkedin.com/post-inspector/)
- [ ] Plausible : première visite enregistrée dans le dashboard
- [ ] Lighthouse mobile : score ≥ 95 sur les 4 axes
- [ ] UptimeRobot configuré et actif

---

## Rollback procedure

En cas de déploiement cassé :
1. Dans **Deployments → History**, identifier la version précédente fonctionnelle
2. Cliquer **Rollback** sur cette version
3. Si Rollback indisponible : revert le commit fautif sur GitHub + redéployer
```bash
git revert <commit-hash>
git push origin main
# Replit redéploie automatiquement
```

---

## Liste d'actions Replit humaines (cf. REPLIT_ACTIONS.md)

Voir le fichier `REPLIT_ACTIONS.md` à la racine pour la liste exhaustive des actions à effectuer dans l'UI Replit post-code (règle 15 CLAUDE.md).

## Handoff → Thomas (actions humaines post-code)

Après que @fullstack ait terminé le code :
1. Merger la PR sur `main`
2. Suivre ce document step-by-step
3. Valider chaque item de la checklist post-déploiement
4. Communiquer l'URL finale à l'équipe
