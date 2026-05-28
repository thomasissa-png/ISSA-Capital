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

### Étape 4 — Cleanup (après 7 jours de stabilité)

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
