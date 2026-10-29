#!/usr/bin/env bash
# 從 UAT EC2 讀 .env.uat，寫入 PROD EC2 的 .env.prod（本機執行）
set -euo pipefail

UAT_SSH_KEY="${UAT_SSH_KEY:?Set UAT_SSH_KEY}"
UAT_HOST="${UAT_HOST:-52.63.249.152}"
PROD_SSH_KEY="${SSH_KEY:?Set SSH_KEY (prod pem)}"
PROD_HOST="${EC2_HOST:?Set EC2_HOST}"
PROD_APP="${APP_DIR:-/home/ec2-user/apps/taxima-prod}"

ssh -i "$UAT_SSH_KEY" "ec2-user@${UAT_HOST}" 'cat /home/ec2-user/apps/taxima-uat/.env.uat' \
  | sed \
    -e 's/^COMPOSE_PROJECT_NAME=taxima-uat/COMPOSE_PROJECT_NAME=taxima-prod/' \
    -e 's/^TAXIMA_ENV=uat/TAXIMA_ENV=prod/' \
    -e 's/^API_HOST_PORT=3200/API_HOST_PORT=3210/' \
    -e 's/^CRM_HOST_PORT=3201/CRM_HOST_PORT=3211/' \
    -e 's/^MYSQL_HOST_PORT=3311/MYSQL_HOST_PORT=3312/' \
    -e 's/^MYSQL_DATABASE=taxima_uat/MYSQL_DATABASE=taxima_prod/' \
    -e 's|https://taxima.hkcodai.space|https://app.hktaketaxi.online|g' \
  | ssh -i "$PROD_SSH_KEY" "ec2-user@${PROD_HOST}" "mkdir -p ${PROD_APP} && cat > ${PROD_APP}/.env.prod && chmod 600 ${PROD_APP}/.env.prod"

echo "Wrote ${PROD_APP}/.env.prod on prod (from UAT secrets + prod ports/domain)."
echo "Note: PROD Firebase (taketaxionlinemain CRM) — set FIREBASE_WEB_API_KEY + VITE_FIREBASE_* on prod; sync from UAT overwrites them."
