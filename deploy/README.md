# `deploy/` — crons du VPS pilotés par le dépôt

Objectif : la configuration des tâches planifiées d'Anya vit dans le dépôt et
s'applique seule au déploiement. **Modifier un cron = éditer un fichier + push
sur `main`** → appliqué sur le VPS sous ~5 min, sans aucun accès SSH.

## Contexte VPS (résumé)

Anya = l'appli Next.js du dépôt, lancée par systemd (`anya`) sur un VPS IONOS
(Ubuntu 24.04), sous le compte `thomas`, code dans `/home/thomas/ISSA-Capital`,
branche `main`. Un cron de `thomas` lance `/home/thomas/anya-autoupdate.sh`
toutes les 5 min : `git merge main` + `npm install` + `npm run build` +
`systemctl restart anya`. SOT infra complète : fiche vault
`Anya v2.0 - Infrastructure VPS.md` + `docs/infra/infrastructure.md`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `crontab.anya` | **Source de vérité** des tâches planifiées (lignes cron). À éditer. |
| `anya-cron.sh` | Caller d'endpoint (`curl localhost:3000` + `CRON_SECRET`). Versionné, référencé par chemin absolu dans `crontab.anya`. |
| `sync-crons.sh` | Applicateur : réécrit le bloc managé de la crontab de `thomas`. |
| `anya-autoupdate.sh` | **Copie de référence** de la boucle de déploiement (NON auto-appliquée — voir plus bas). |
| `backup-vault.sh` | Snapshot quotidien du vault Drive vers le VPS (cron `0 1 * * *`, rétention 90j, archive différentielle). |
| `caddy/` | Snippets vhost Caddy (sous-domaines servis par le VPS). Procédure dans `caddy/README.md`. |
| `systemd/` | Drop-in overrides pour les units systemd (anya, etc.). Procédure dans `systemd/README.md`. |

## Comment ça marche

`sync-crons.sh` (lancé en tant que `thomas` par `anya-autoupdate.sh` après un
build réussi) reconstruit la crontab ainsi :

1. retire l'ancien **bloc managé** (entre `# >>> ANYA-MANAGED >>>` et `# <<< ANYA-MANAGED <<<`) ;
2. retire **toute ligne résiduelle invoquant `anya-cron.sh`** (transition propre
   au 1er run, où la crontab manuelle n'a pas encore de marqueurs — évite les
   doublons) ;
3. réinjecte un bloc managé frais depuis `crontab.anya` ;
4. **garde-fou** : si le résultat ne contient plus la ligne `anya-autoupdate.sh`,
   il **abandonne sans rien installer** (la boucle de déploiement ne peut pas
   être perdue) ;
5. backup horodaté (`~/anya-crontab.<date>.bak`) avant chaque install.

La ligne du cron `anya-autoupdate.sh` vit **hors** du bloc managé et n'invoque
pas `anya-cron.sh` → elle n'est jamais touchée.

## Pourquoi `anya-autoupdate.sh` n'est pas auto-appliqué

Le script de déploiement ne doit jamais pouvoir s'auto-casser. S'il se réécrivait
depuis le dépôt et qu'un commit cassé arrivait, la boucle mourrait → réparation
SSH obligatoire (contraire à l'objectif). On garde donc le runtime maître sur le
VPS (stable, minimal) ; seules les parties évolutives (`crontab.anya` +
`sync-crons.sh`) viennent du dépôt. La copie de référence sert à la lisibilité et
au disaster-recovery.

## Bootstrap VPS — la SEULE modif manuelle (une fois)

En SSH (`ssh root@<vps>`, puis agir sur le compte `thomas`) :

```bash
# 1. S'assurer que les scripts du dépôt sont exécutables (déjà committés +x)
chmod +x /home/thomas/ISSA-Capital/deploy/*.sh

# 2. Câbler la sync dans la boucle de déploiement existante : ajouter, à la FIN
#    de /home/thomas/anya-autoupdate.sh (APRÈS le restart réussi), la ligne :
#
#      bash /home/thomas/ISSA-Capital/deploy/sync-crons.sh >> /home/thomas/anya-cron.log 2>&1 || true
#
#    (le `|| true` garantit qu'une sync ratée ne casse jamais le déploiement.)

# 3. Premier passage manuel pour valider (en tant que thomas) :
sudo -u thomas bash /home/thomas/ISSA-Capital/deploy/sync-crons.sh

# 4. Vérifier le résultat
crontab -u thomas -l
```

Après l'étape 4, la crontab doit contenir : la ligne `anya-autoupdate` (intacte,
hors bloc) + le bloc `ANYA-MANAGED` avec les tâches. Les anciennes lignes
`anya-cron.sh` manuelles ont été retirées automatiquement (pas de doublon).

> Tester un endpoint isolément avant de se fier au caller versionné :
> `sudo -u thomas bash /home/thomas/ISSA-Capital/deploy/anya-cron.sh /api/secretariat/cron-health-check`

## Usage courant (autonome, sans SSH)

- **Changer une fréquence / un endpoint** : éditer `deploy/crontab.anya`, commit, push `main`. Appliqué <5 min.
- **Réactiver hot-context-scan** : décommenter sa ligne dans `crontab.anya`, push.
- **Désactiver une tâche** : commenter sa ligne, push.

## Rollback

Restaurer la crontab précédente depuis un backup :
```bash
crontab -u thomas - < /home/thomas/anya-crontab.<date>.bak
```
