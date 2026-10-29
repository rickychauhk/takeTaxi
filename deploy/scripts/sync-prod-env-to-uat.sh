#!/usr/bin/env bash
# 從 PROD .env.prod 同步密鑰至 UAT .env.uat（保留 UAT MySQL 密碼與 port／域名）
set -euo pipefail

PROD_SSH_KEY="${PROD_SSH_KEY:-/Users/wingchau/taxi-ma/hktaketaxi.pem}"
PROD_HOST="${PROD_HOST:-3.104.225.159}"
UAT_SSH_KEY="${UAT_SSH_KEY:-/Users/wingchau/Documents/AWS KEY/ai-sales-bot-key.pem}"
UAT_HOST="${UAT_HOST:-52.63.249.152}"
UAT_APP="${UAT_APP_DIR:-/home/ec2-user/apps/taxima-uat}"
PROD_APP="${PROD_APP_DIR:-/home/ec2-user/apps/taxima-prod}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

ssh -i "$PROD_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${PROD_HOST}" "cat ${PROD_APP}/.env.prod" \
  | sed \
    -e 's/^COMPOSE_PROJECT_NAME=taxima-prod/COMPOSE_PROJECT_NAME=taxima-uat/' \
    -e 's/^TAXIMA_ENV=prod/TAXIMA_ENV=uat/' \
    -e 's/^API_HOST_PORT=3210/API_HOST_PORT=3200/' \
    -e 's/^CRM_HOST_PORT=3211/CRM_HOST_PORT=3201/' \
    -e 's/^MYSQL_HOST_PORT=3312/MYSQL_HOST_PORT=3311/' \
    -e 's/^MYSQL_DATABASE=taxima_prod/MYSQL_DATABASE=taxima_uat/' \
    -e 's|https://app.hktaketaxi.online|https://taxima.hkcodai.space|g' \
  >"$TMP"

for key in MYSQL_ROOT_PASSWORD MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD; do
  line="$(ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" "grep -E '^${key}=' ${UAT_APP}/.env.uat" || true)"
  if [[ -n "$line" ]]; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' "/^${key}=/d" "$TMP"
    else
      sed -i "/^${key}=/d" "$TMP"
    fi
    echo "$line" >>"$TMP"
  fi
done

ssh -i "$UAT_SSH_KEY" -o IdentitiesOnly=yes "ec2-user@${UAT_HOST}" \
  "cp ${UAT_APP}/.env.uat ${UAT_APP}/.env.uat.bak.\$(date +%Y%m%d%H%M%S) && cat > ${UAT_APP}/.env.uat && chmod 600 ${UAT_APP}/.env.uat" <"$TMP"

echo "Updated ${UAT_APP}/.env.uat from PROD (UAT MySQL credentials preserved)."
