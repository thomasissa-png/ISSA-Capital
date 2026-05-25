#!/usr/bin/env bash
# deploy/anya-autoupdate.sh — COPIE DE RÉFÉRENCE (versionnée pour lisibilité et
# disaster-recovery). ⚠️ Ce n'est PAS ce fichier qui tourne : la version qui
# s'exécute est /home/thomas/anya-autoupdate.sh, installée À LA MAIN sur le VPS.
#
# POURQUOI elle reste maître sur le VPS et n'est pas auto-écrasée : le script de
# déploiement ne doit jamais pouvoir s'auto-casser. S'il se réécrivait depuis le
# dépôt et qu'un commit cassé arrivait, la boucle de déploiement mourrait et il
# faudrait du SSH pour réparer (contraire à l'objectif d'autonomie).
#
# Ce qui ÉVOLUE depuis le dépôt = les définitions de crons (deploy/crontab.anya)
# + la logique de sync (deploy/sync-crons.sh). La boucle, elle, reste minimale
# et stable sur le VPS.
#
# Pour câbler la sync : la SEULE modif côté VPS est d'ajouter l'appel à
# sync-crons.sh à la fin de la boucle existante (voir deploy/README.md §Bootstrap).
# Ce fichier montre à quoi ressemble la boucle complète, sync incluse.

set -euo pipefail

REPO_DIR="/home/thomas/ISSA-Capital"
BRANCH="main"
LOG="/home/thomas/anya-autoupdate.log"

log() { echo "[autoupdate $(date -Is)] $*" >> "$LOG"; }

cd "$REPO_DIR"

git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse "$BRANCH")"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL" == "$REMOTE" ]]; then
  exit 0   # rien de neuf
fi

log "nouveau code détecté ($LOCAL → $REMOTE) — déploiement"
git merge --ff-only "origin/$BRANCH" >> "$LOG" 2>&1
npm install >> "$LOG" 2>&1

# Garde-fou : si le build échoue, on s'arrête AVANT le restart. Anya continue
# sur l'ancienne version, l'échec est tracé. Un commit cassé ne met jamais Anya
# à terre.
if ! npm run build >> "$LOG" 2>&1; then
  log "BUILD ÉCHOUÉ — restart annulé, Anya reste sur la version précédente"
  exit 1
fi

sudo systemctl restart anya >> "$LOG" 2>&1
log "service anya redémarré"

# Sync des crons depuis le dépôt — APRÈS un déploiement réussi, et non bloquant
# (|| true) : une sync ratée ne doit jamais casser la boucle de déploiement.
bash "$REPO_DIR/deploy/sync-crons.sh" >> /home/thomas/anya-cron.log 2>&1 || \
  log "AVERTISSEMENT: sync-crons.sh a échoué (non bloquant)"

log "déploiement terminé"
