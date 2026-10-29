#!/usr/bin/env bash
# 更新 hkcodai.space 服務項目：搭的的士平台 SaaS
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_KEY="${SSH_KEY:-/Users/wingchau/Documents/AWS KEY/ai-sales-bot-key.pem}"
EC2_HOST="${EC2_HOST:-52.63.249.152}"
APP_DIR="/var/www/ai-training-website"
REMOTE_SCRIPT="${APP_DIR}/scripts/hkcodai-add-taxima-service.js"

echo "==> Upload CRM screenshots + taxi SaaS banner"
ASSET_DIR="${REPO_DIR}/deploy/assets/hkcodai-crm"
ssh -i "${SSH_KEY}" "ec2-user@${EC2_HOST}" "mkdir -p ${APP_DIR}/uploads ${APP_DIR}/scripts/assets"
if [[ -d "${ASSET_DIR}" ]]; then
  scp -i "${SSH_KEY}" "${ASSET_DIR}"/*.png "ec2-user@${EC2_HOST}:${APP_DIR}/uploads/"
  if [[ -f "${ASSET_DIR}/taxima-taxi-saas-banner.jpg" ]]; then
    scp -i "${SSH_KEY}" "${ASSET_DIR}/taxima-taxi-saas-banner.jpg" "ec2-user@${EC2_HOST}:${APP_DIR}/scripts/assets/"
    scp -i "${SSH_KEY}" "${ASSET_DIR}/taxima-taxi-saas-banner.jpg" "ec2-user@${EC2_HOST}:${APP_DIR}/uploads/"
  fi
fi

echo "==> Upload script"
scp -i "${SSH_KEY}" "${REPO_DIR}/deploy/scripts/hkcodai-add-taxima-service.js" "ec2-user@${EC2_HOST}:${REMOTE_SCRIPT}"

echo "==> Insert / update DB row"
ssh -i "${SSH_KEY}" "ec2-user@${EC2_HOST}" "cd ${APP_DIR} && node ${REMOTE_SCRIPT}"

echo "==> Done. Check https://hkcodai.space/#services"
