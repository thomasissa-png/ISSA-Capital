#!/usr/bin/env bash
# deploy/sync-crons.sh
#
# Synchronise les tâches planifiées d'Anya depuis le dépôt (deploy/crontab.anya)
# vers la crontab de l'utilisateur courant (compte `thomas` sur le VPS).
# Appelé par anya-autoupdate.sh, APRÈS un build + restart réussi.
#
# SÛRETÉ — ne JAMAIS casser la boucle de déploiement :
#  - Réécrit uniquement le bloc délimité par les marqueurs ANYA-MANAGED.
#  - Retire EN PLUS toute ligne pré-existante invoquant anya-cron.sh (transition
#    propre au 1er run : l'ancienne crontab manuelle n'a pas de marqueurs ; sans
#    ça on aurait des crons en double → double traitement).
#  - La ligne du cron anya-autoupdate.sh n'invoque pas anya-cron.sh → jamais
#    retirée. Garde-fou explicite : refuse d'installer si elle disparaissait.
#  - No-op si le fichier de définitions manque. Backup horodaté avant install.
#
# Idempotent : relancé, il reconstruit le même bloc managé.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFS_FILE="$SCRIPT_DIR/crontab.anya"
BEGIN_MARK='# >>> ANYA-MANAGED (deploy/crontab.anya) — ne pas éditer à la main >>>'
END_MARK='# <<< ANYA-MANAGED <<<'
AUTOUPDATE_PATTERN='anya-autoupdate\.sh'
CALLER_PATTERN='anya-cron\.sh'

log() { echo "[sync-crons $(date -Is)] $*"; }

if [[ ! -f "$DEFS_FILE" ]]; then
  log "ERREUR: $DEFS_FILE introuvable — crontab inchangée."
  exit 1
fi

current="$(crontab -l 2>/dev/null || true)"

# Reste = crontab actuelle MOINS l'ancien bloc managé MOINS les lignes anya-cron.sh
# résiduelles (état manuel pré-marqueurs). La ligne autoupdate (anya-autoupdate.sh)
# n'est pas concernée par le filtre et reste intacte.
remainder="$(printf '%s\n' "$current" \
  | awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
      $0==b {skip=1; next}
      $0==e {skip=0; next}
      skip==1 {next}
      {print}
    ' \
  | grep -vE "$CALLER_PATTERN" || true)"

managed_block="$(printf '%s\n%s\n%s' "$BEGIN_MARK" "$(cat "$DEFS_FILE")" "$END_MARK")"
new="$(printf '%s\n%s\n' "$remainder" "$managed_block")"

# Garde-fou anti-casse : si la crontab actuelle avait la ligne autoupdate, la
# nouvelle DOIT l'avoir aussi — sinon on abandonne sans rien installer.
if printf '%s\n' "$current" | grep -qE "$AUTOUPDATE_PATTERN"; then
  if ! printf '%s\n' "$new" | grep -qE "$AUTOUPDATE_PATTERN"; then
    log "ERREUR: la nouvelle crontab perdrait anya-autoupdate — ABANDON, crontab inchangée."
    exit 1
  fi
fi

backup="${HOME}/anya-crontab.$(date +%Y%m%d-%H%M%S).bak"
printf '%s\n' "$current" > "$backup" 2>/dev/null || true

printf '%s\n' "$new" | crontab -
log "crontab synchronisée depuis le dépôt (backup: $backup)."
