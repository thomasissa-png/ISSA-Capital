# `deploy/systemd/` — overrides systemd versionnés

Drop-in overrides pour les units systemd du VPS — versionnés ici, **appliqués
manuellement en SSH une fois** (cf. la philosophie du `deploy/` principal :
le runtime maître reste sur le VPS pour ne jamais s'auto-casser).

## Fichiers

| Fichier | Cible VPS | Rôle |
|---|---|---|
| `anya-shutdown.conf` | `/etc/systemd/system/anya.service.d/anya-shutdown.conf` | `TimeoutStopSec=30s` + `KillMode=mixed` — raccourcit le shutdown anya de 90s → 30s (S26). |

## Procédure d'install — `anya-shutdown.conf` (1 fois SSH)

```bash
# 1. Backup du `systemctl cat` actuel (pour rollback)
systemctl cat anya | sudo tee /home/thomas/anya.service.before-s26.bak >/dev/null

# 2. Créer le dossier drop-in et copier l'override depuis le dépôt
sudo mkdir -p /etc/systemd/system/anya.service.d
sudo cp /home/thomas/ISSA-Capital/deploy/systemd/anya-shutdown.conf \
        /etc/systemd/system/anya.service.d/anya-shutdown.conf

# 3. Recharger systemd (lit le drop-in, n'arrête pas le service)
sudo systemctl daemon-reload

# 4. Vérifier que les directives sont bien prises en compte
systemctl cat anya | tail -10
# Doit afficher :
#   # /etc/systemd/system/anya.service.d/anya-shutdown.conf
#   [Service]
#   TimeoutStopSec=30s
#   KillMode=mixed

# 5. (Optionnel) Vérifier la valeur runtime
systemctl show anya -p TimeoutStopUSec -p KillMode
# Doit afficher : TimeoutStopUSec=30s, KillMode=mixed
```

Le prochain `systemctl restart anya` (post-merge auto via `anya-autoupdate.sh`)
respectera le nouveau timeout. **Pas besoin de redémarrer manuellement** —
le drop-in s'applique au prochain stop/start.

## Vérification empirique (post-deploy)

Après quelques merges sur `main` (qui déclenchent un restart auto via
l'autoupdate cron), vérifier le journal :

```bash
journalctl -u anya --since "1 hour ago" | grep -E "stop-sigterm|Stopped anya|Started anya"
```

Le pattern attendu :
- `Stopping anya.service`
- `Stopped anya.service` (≤ 30 sec après — pas 90 sec)
- `Started anya.service` immédiatement après

Pas de `stop-sigterm timed out. Killing.` (= SIGTERM honoré dans les temps),
ou si Next.js continue d'ignorer SIGTERM, le timeout SIGKILL passe de 90s → 30s.

## Rollback

```bash
sudo rm /etc/systemd/system/anya.service.d/anya-shutdown.conf
sudo systemctl daemon-reload
# (le dossier `anya.service.d/` peut rester vide, c'est sans effet)
```

## Pourquoi pas auto-appliqué

Même raison que `anya-autoupdate.sh` (cf. `deploy/README.md` § « Pourquoi
`anya-autoupdate.sh` n'est pas auto-appliqué ») : un drop-in cassé pourrait
empêcher anya de démarrer après un `daemon-reload`. On garde le contrôle
manuel pour ces fichiers à fort impact (le service ne tourne pas sans
systemd qui l'aime).
