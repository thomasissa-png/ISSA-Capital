#!/usr/bin/env bash
# deploy/backup-vault.sh
#
# Backup quotidien du vault Drive (remote rclone `vault:`) vers le VPS, avec
# rotation 90 jours et archive incrémentale des versions remplacées.
#
# Tourne sous le user `thomas` via la crontab managée (deploy/crontab.anya).
# Aucun accès SSH requis pour le modifier : éditer ce fichier + push `main`.
#
# Mécanique :
#  - `rclone copy` (jamais destructif côté dest) + `--backup-dir` daté.
#    `current/` = miroir frais du Vault après le run.
#    `2026-MM-JJ/` = uniquement les fichiers remplacés/supprimés ce jour-là.
#  - flock anti-double-exécution (cron qui rattrape un run raté).
#  - Suppression des dossiers datés > 90 jours (rotation simple par date).
#  - Suppression du dossier daté si vide après le run (aucune modif détectée).
#
# Restauration :
#  - 1 fichier : `cp $BACKUP_ROOT/<date>/<chemin>  /home/thomas/vault/<chemin>`
#  - Sinistre : `rclone copy $BACKUP_ROOT/current vault:` (re-pousse tout)
#  - Détail dans docs/dev-decisions.md (« Backup vault »).

set -euo pipefail

VAULT_REMOTE="${VAULT_REMOTE:-vault:}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/thomas/vault-backup}"
LOG="${VAULT_BACKUP_LOG:-/home/thomas/vault-backup.log}"
LOCK="${VAULT_BACKUP_LOCK:-/tmp/vault-backup.lock}"
RETENTION_DAYS="${VAULT_BACKUP_RETENTION_DAYS:-90}"

TODAY="$(date +%F)"
TS="$(date -Iseconds)"

log() { echo "[backup-vault $TS] $*" >> "$LOG"; }

# Verrou : si un run précédent est encore en cours, on sort sans bruit.
exec 200>"$LOCK"
if ! flock -n 200; then
  log "déjà en cours, skip"
  exit 0
fi

mkdir -p "$BACKUP_ROOT/current" "$BACKUP_ROOT/$TODAY"

log "début — remote=$VAULT_REMOTE dest=$BACKUP_ROOT rétention=${RETENTION_DAYS}j"

# rclone copy = jamais destructif sur la destination. Les fichiers retirés du
# vault restent dans current/ jusqu'au cleanup explicite ci-dessous (cf. --max-age
# n/a ici car on veut justement préserver les supprimés). Le --backup-dir reçoit
# les ANCIENNES versions des fichiers modifiés (= snapshot différentiel).
#
# --max-delete 100 = filet de sécurité au cas où rclone interpréterait mal le
# vide (ex. quota Drive atteint, network blip) : refuse de supprimer >100
# fichiers en une passe.
if ! rclone copy "$VAULT_REMOTE" "$BACKUP_ROOT/current" \
    --backup-dir "$BACKUP_ROOT/$TODAY" \
    --max-delete 100 \
    --log-file "$LOG" \
    --log-level INFO \
    --stats=0; then
  log "ERREUR rclone — code $?"
  exit 1
fi

# Si aucune modif aujourd'hui, on supprime le dossier daté vide (évite la pollution).
if [[ -d "$BACKUP_ROOT/$TODAY" ]] && [[ -z "$(ls -A "$BACKUP_ROOT/$TODAY")" ]]; then
  rmdir "$BACKUP_ROOT/$TODAY"
  log "aucune modif détectée — dossier $TODAY supprimé"
fi

# Rotation : suppression des snapshots datés > RETENTION_DAYS jours.
# `current/` n'est jamais touché.
find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*-*-*" -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null || true

# Métriques pour vérification rapide.
CURRENT_SIZE="$(du -sh "$BACKUP_ROOT/current" 2>/dev/null | cut -f1 || echo '?')"
TOTAL_SIZE="$(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1 || echo '?')"
SNAPSHOT_COUNT="$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*-*-*" | wc -l)"

log "OK — current=$CURRENT_SIZE total=$TOTAL_SIZE snapshots=$SNAPSHOT_COUNT"
