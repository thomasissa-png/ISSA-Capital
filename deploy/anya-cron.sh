#!/usr/bin/env bash
# deploy/anya-cron.sh <endpoint-path>
#
# Appelle un endpoint cron d'Anya en local, authentifié par CRON_SECRET lu dans
# .env.local. Invoqué par les lignes de deploy/crontab.anya.
#
# Le cron tourne avec un environnement minimal → tous les chemins sont ABSOLUS.

set -euo pipefail

ENDPOINT="${1:?usage: anya-cron.sh <endpoint-path>}"
ENV_FILE="/home/thomas/ISSA-Capital/.env.local"
BASE_URL="http://localhost:3000"

stamp() { date -Is; }

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[anya-cron $(stamp)] ERREUR: $ENV_FILE introuvable" >&2
  exit 1
fi

# Extraire CRON_SECRET (tolère les guillemets simples ou doubles éventuels).
line="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -n1 || true)"
val="${line#CRON_SECRET=}"
val="${val%\"}"; val="${val#\"}"
val="${val%\'}"; val="${val#\'}"
CRON_SECRET="$val"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "[anya-cron $(stamp)] ERREUR: CRON_SECRET absent de $ENV_FILE" >&2
  exit 1
fi

echo "[anya-cron $(stamp)] GET ${ENDPOINT}"
curl -fsS -m 120 -X GET \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}${ENDPOINT}"
echo
