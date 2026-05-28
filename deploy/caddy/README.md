# `deploy/caddy/` — Reverse proxy Caddy du VPS

## Contexte

Caddy tourne sur le VPS (service systemd `caddy`, depuis la migration S21) et expose plusieurs sous-domaines via une configuration **monolithique** dans `/etc/caddy/Caddyfile` :

| Vhost | Backend | Rôle |
|---|---|---|
| `anya.issa-capital.com` | `localhost:3000` | Bot secrétariat Anya (Next.js) |
| `opencode.issa-capital.com` | `localhost:4096` | Outil de dev |
| `n8n.issa-capital.com` | `localhost:5678` | n8n (workflows MCP-Drive) |
| `vps-mcp.issa-capital.com` | `localhost:8765` | MCP debug VPS |
| **`issa-capital.com`** + `www.*` | `localhost:3000` | **Site vitrine** (S25, migration Replit → VPS) |
| **`agents.issa-capital.com`** | `file_server /home/thomas/Agent-Team` | **Landing page Gradient Agents** (S25.1, migration GitHub Pages → VPS) |

Le service Anya sur le port 3000 sert le **même build Next.js** pour les deux hostnames `anya.issa-capital.com` et `issa-capital.com`. C'est Caddy qui :

- route les 2 hostnames vers le même backend ;
- **filtre** côté entrée les routes admin/Anya pour `issa-capital.com` (le site public n'expose QUE `/api/contact` + les pages, pas `/api/secretariat/*` ni `/api/telegram/*`).

Cf. `issa-capital.caddy` (le snippet versionné, source de vérité du bloc à appender).

## Pourquoi un seul service backend

Le repo est un mono-repo : `src/app/` (site) et `src/lib/secretariat/` (Anya) sont buildés ensemble par `next build`. Lancer 2 processus Next.js séparés pour les 2 hosts doublerait la RAM (~360 Mo de plus) sans gain d'isolation réel (Next.js sert toutes les routes dans un seul process). Caddy fait le filtrage au bon endroit : à l'entrée.

## Installation du vhost site (1ère fois — manuel SSH)

```bash
# (1) Backup du Caddyfile actuel (toujours)
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%F-%H%M)

# (2) Append le snippet versionné
echo "" | sudo tee -a /etc/caddy/Caddyfile
sudo cat /home/thomas/ISSA-Capital/deploy/caddy/issa-capital.caddy | sudo tee -a /etc/caddy/Caddyfile

# (3) Vérifier la syntaxe AVANT reload (Caddy refuse de démarrer si KO)
sudo caddy validate --config /etc/caddy/Caddyfile

# (4) Recharger Caddy (zero-downtime, pas de restart)
sudo systemctl reload caddy

# (5) Vérifier que Caddy a bien pris la conf
sudo systemctl status caddy --no-pager | head -10
```

## Tests internes (AVANT bascule DNS)

Tant que le DNS `issa-capital.com` pointe encore sur Replit, on teste en simulant le bon Host depuis le VPS :

```bash
# (a) Le site répond bien (homepage)
curl -s -H "Host: issa-capital.com" http://127.0.0.1 -k -o /dev/null -w "%{http_code}\n"
# attendu : 200

# (b) Routes admin bloquées
curl -s -H "Host: issa-capital.com" http://127.0.0.1/api/secretariat/cron-email-ingest -k -o /dev/null -w "%{http_code}\n"
curl -s -H "Host: issa-capital.com" http://127.0.0.1/api/telegram/webhook -k -o /dev/null -w "%{http_code}\n"
curl -s -H "Host: issa-capital.com" http://127.0.0.1/api/drive-auth -k -o /dev/null -w "%{http_code}\n"
# attendu pour les 3 : 404

# (c) /api/contact reste accessible (formulaire vitrine)
curl -s -H "Host: issa-capital.com" http://127.0.0.1/api/contact -k -o /dev/null -w "%{http_code}\n"
# attendu : 405 (GET non autorisé, mais la route existe — c'est ce qu'on veut)
#         OU 200 selon l'implémentation, JAMAIS 404

# (d) Le vhost anya continue de tout exposer normalement (régression check)
curl -s -H "Host: anya.issa-capital.com" http://127.0.0.1/api/secretariat/cron-health-check -k -o /dev/null -w "%{http_code}\n"
# attendu : 200 ou code applicatif, JAMAIS 404 (sinon on a cassé anya)
```

Si **un seul** de ces tests ne donne pas le code attendu : ne pas basculer le DNS. Investiguer.

## Bascule DNS chez IONOS

DNS du domaine `issa-capital.com` géré chez IONOS.

### Étape 1 — Préparer (24h avant)

Dans le dashboard IONOS → Domaines → `issa-capital.com` → DNS :

1. Identifier le **A record actuel** (pointe vers une IP Replit, à noter pour rollback éventuel).
2. **Abaisser le TTL** du A record à `60` secondes (1 minute). Sauvegarder.
3. Faire pareil sur le record `www` (CNAME ou A selon la conf actuelle).

Pourquoi : un TTL bas permet une bascule rapide. Avec le TTL Replit par défaut (souvent 3600 = 1h), une erreur post-bascule prend 1h à corriger. 60s = correction quasi-instantanée.

### Étape 2 — Bascule (J-day)

Toujours dans IONOS → DNS :

1. **A record** `@` (ou `issa-capital.com`) : modifier la valeur → `82.165.168.92`
2. **A record** `www` (ou CNAME `www` → `issa-capital.com`) : pointer vers le même IP, ou laisser CNAME → `issa-capital.com`
3. Sauvegarder. Propagation < 5 min avec TTL 60s.

### Étape 3 — Vérification post-bascule

```bash
# Depuis ta machine locale (pas le VPS)
dig issa-capital.com +short
# attendu : 82.165.168.92

curl -I https://issa-capital.com
# attendu : HTTP/2 200 + headers de sécurité

curl -I https://www.issa-capital.com
# attendu : HTTP/2 301 → https://issa-capital.com (redirect)
```

Vérifier dans un navigateur :
- Cadenas vert (TLS auto-renouvelé par Caddy via Let's Encrypt) ;
- Pages site OK ;
- Formulaire contact fonctionne (POST `/api/contact`).

### Étape 4 — Retirer `tls internal` (juste après la bascule DNS)

Le snippet contient `tls internal` pour permettre les tests pré-bascule (cert autosigné, sinon Let's Encrypt échoue tant que le DNS pointe sur Replit). Une fois le DNS basculé, **Caddy doit récupérer un vrai cert Let's Encrypt** sinon les visiteurs auront un warning "cert invalide".

```bash
# (a) Éditer le Caddyfile et retirer la ligne `tls internal` du bloc issa-capital
sudo nano /etc/caddy/Caddyfile
# OU plus rapide via sed :
sudo sed -i '/^    tls internal$/d' /etc/caddy/Caddyfile

# (b) Valider + reload
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy

# (c) Caddy va automatiquement tenter le challenge ACME Let's Encrypt
#     (~30 sec à 2 min). Vérifier dans les logs :
sudo journalctl -u caddy -f -o cat | grep -E "issa-capital|acme|certificate"

# (d) Quand un log "certificate obtained successfully" apparaît, le cert est OK.
#     Tester :
curl -I https://issa-capital.com
# attendu : HTTP/2 200, PAS de warning cert
```

### Étape 5 — Cleanup (après 7 jours de stabilité)

- Désactiver le projet Replit (économie ~$20-25/mois).
- Retirer toute référence Replit du dépôt (`REPLIT_ACTIONS.md`, `.replit` si présent, conf next.config.js spécifique Replit).
- Remettre le TTL DNS à une valeur normale (3600 ou 86400).

## Rollback en cas d'incident

Si une régression sévère est détectée après la bascule :

```bash
# (a) DNS : remettre l'A record sur l'IP Replit (notée à l'étape 1).
#     Propagation < 5 min avec TTL 60.

# (b) Caddy : si on veut désactiver complètement le nouveau vhost
sudo cp /etc/caddy/Caddyfile.bak.<dernier> /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Limites connues

- **Coupling process** : si le service `anya.service` plante, le site vitrine tombe aussi (même backend port 3000). Trade-off accepté pour éviter le doublon RAM. Mitigation : `systemd` redémarre `anya` automatiquement en cas de crash (`Restart=on-failure` à vérifier dans l'unit).
- **Logs partagés** : pas vraiment, en fait. Caddy log séparément (`/var/log/caddy/issa-capital.com.log`) et Anya log dans son propre `journalctl`. Le filtre Caddy bloque les routes admin AVANT que Next.js ne les voie.
- **Pas de WAF/rate-limit côté site vitrine** : pas nécessaire en V1 (vitrine basse intensité, pas de surface critique exposée). À ajouter si on observe du scraping/spam sur `/api/contact`.

## Fichiers de référence

- `issa-capital.caddy` — Source de vérité du bloc vhost à appender (versionné).
- Backup Caddyfile pré-modification : `/etc/caddy/Caddyfile.bak.<date>` (généré par l'étape 1 de l'install).
- Cert TLS : géré par Caddy, stocké dans `/var/lib/caddy/.local/share/caddy/`.

## Logs

Caddy log dans `journalctl -u caddy` (pas de fichier dédié — évite la galère de droits sur `/var/log/caddy/`). Pour filtrer par domaine :

```bash
# Site uniquement (issa-capital.com + www.*)
sudo journalctl -u caddy -f -o cat | grep '"server_name":"issa-capital.com"\|"server_name":"www.issa-capital.com"'

# Anya uniquement
sudo journalctl -u caddy -f -o cat | grep '"server_name":"anya.issa-capital.com"'

# Toutes les erreurs (toutes serveurs confondus)
sudo journalctl -u caddy -f -o cat | grep '"level":"error"'
```

## Erratum (S25.1)

La v1 du snippet contenait une directive `log { output file /var/log/caddy/issa-capital.com.log }`. Le `caddy validate` la passait (syntaxe OK) mais le `systemctl reload` échouait au runtime sur `permission denied` (Caddy ne pouvait pas créer le fichier). Retirée en S25.1 — Caddy log toujours dans `journalctl`, c'est suffisant pour ce projet.

**Learning à propager** : `caddy validate` ne teste pas les permissions filesystem. Toujours **`systemctl reload`** sur un test environnement avant de pousser une conf qui touche aux fichiers (logs, sockets, etc.).

---

# Migration `agents.issa-capital.com` (S25.1, Gradient Agents — GitHub Pages → VPS)

## Objectif

Servir la landing page du framework Gradient Agents (`thomasissa-png/Agent-Team`) depuis le VPS au lieu de GitHub Pages. Domaine custom `agents.issa-capital.com` au lieu de `thomasissa-png.github.io/Agent-Team/`.

Le repo est **public**, l'`index.html` est un single-file 4372 lignes self-contained (CSS inline, favicon SVG base64) — aucun build, aucun process, juste du `file_server` Caddy.

## Installation (1ère fois — manuel SSH)

```bash
# (1) Cloner le repo sur le VPS sous l'user `thomas` (cohérent avec rclone-vault.service)
sudo -u thomas git clone --branch master https://github.com/thomasissa-png/Agent-Team.git /home/thomas/Agent-Team

# (2) Vérifier le clone
sudo -u thomas ls -la /home/thomas/Agent-Team/index.html

# (3) Backup du Caddyfile
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%F-%H%M)

# (4) Append le snippet versionné
echo "" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
sudo tee -a /etc/caddy/Caddyfile < /home/thomas/ISSA-Capital/deploy/caddy/agents.caddy > /dev/null

# (5) Validate + reload
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy && echo "✅ Caddy reloaded"
```

## Mise à jour automatique

Le cron `0 2 * * * cd /home/thomas/Agent-Team && git pull --quiet origin master` (déjà dans `deploy/crontab.anya`, pris en compte automatiquement par `sync-crons.sh`) tire `master` chaque nuit à 4h Paris. Toute push sur `master` côté GitHub publié sous 24h. Logs : `/home/thomas/agent-team-update.log`.

Pas de redémarrage Caddy nécessaire — `file_server` lit le filesystem à chaque requête, pas de cache process.

## Bascule DNS chez IONOS

Dashboard IONOS → Domaines → `issa-capital.com` → DNS :

1. Ajouter un **A record** : `agents` → `82.165.168.92`, TTL `60` (ou un **CNAME** `agents` → `issa-capital.com` qui héritera du resolve)
2. Sauvegarder

## Tests post-bascule

```bash
# Depuis n'importe où (VPS ou ton laptop)
dig agents.issa-capital.com +short
# attendu : 82.165.168.92 (ou alias CNAME → IP via résolution récursive)

# Cert + landing
curl -I https://agents.issa-capital.com
# attendu : HTTP/2 200, content-type: text/html

# Vérifier que c'est bien notre landing (titre "Gradient Agents")
curl -s https://agents.issa-capital.com | grep -o '<title>[^<]*</title>'
# attendu : <title>Gradient Agents — Dashboard</title>
```

## Mise à jour manuelle (si besoin avant le cron)

```bash
sudo -u thomas bash -c "cd /home/thomas/Agent-Team && git pull origin master"
```

Pas de reload Caddy requis.

## Désinstallation

Si on veut revenir à GitHub Pages :

1. DNS IONOS : retirer le A record `agents`.
2. Caddyfile : retirer le bloc `agents.issa-capital.com { ... }`, reload.
3. (Optionnel) `rm -rf /home/thomas/Agent-Team` côté VPS.
