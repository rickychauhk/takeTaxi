#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/apps/taxima-prod"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_SITE_CONF="deploy/nginx/app.hktaketaxi.online.conf"
NGINX_TARGET="/etc/nginx/conf.d/app.hktaketaxi.online.conf"

ssh_cmd() {
  ssh -i "${SSH_KEY:?Set SSH_KEY}" ec2-user@"${EC2_HOST:?Set EC2_HOST}" "$@"
}

maintenance_off() {
  ssh_cmd "sudo APP_DIR=${APP_DIR} bash ${APP_DIR}/deploy/scripts/nginx-maintenance.sh off" || true
}

echo "==> Sync to ${APP_DIR}"
ssh_cmd "mkdir -p ${APP_DIR}"
rsync -avz --delete \
  -e "ssh -i \"${SSH_KEY}\"" \
  --exclude node_modules --exclude .git --exclude dist \
  --exclude 'apps/passenger/ios/Pods' \
  --exclude 'apps/passenger/ios/build' \
  --exclude 'apps/passenger/android' \
  --exclude 'apps/passenger/.expo' \
  --exclude 'apps/driver/ios/Pods' \
  --exclude 'apps/driver/ios/build' \
  --exclude 'apps/driver/android' \
  --exclude 'apps/driver/.expo' \
  --exclude '.env.uat' \
  --exclude '.env.prod' \
  --exclude '*.pem' \
  "${REPO_DIR}/" "ec2-user@${EC2_HOST}:${APP_DIR}/"

echo "==> Nginx config + maintenance snippet"
ssh_cmd "sudo APP_DIR=${APP_DIR} NGINX_SITE_CONF=${NGINX_SITE_CONF} NGINX_TARGET=${NGINX_TARGET} bash ${APP_DIR}/deploy/scripts/ec2-nginx-sync.sh"

echo "==> Maintenance mode ON (users see deploy notice)"
ssh_cmd "sudo APP_DIR=${APP_DIR} bash ${APP_DIR}/deploy/scripts/nginx-maintenance.sh on"
trap maintenance_off EXIT

echo "==> Docker compose build + up (PROD, sequential — avoids OOM on t3.small)"
ssh_cmd "cd ${APP_DIR} && cp -n .env.prod.example .env.prod 2>/dev/null || true && \
  docker-compose -f docker-compose.prod.yml --env-file .env.prod build api && \
  docker-compose -f docker-compose.prod.yml --env-file .env.prod build crm && \
  docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d"

echo "==> Maintenance mode OFF"
maintenance_off
trap - EXIT

echo "==> Nginx + TLS (on EC2, after DNS → this host)"
echo "cd ${APP_DIR} && sudo bash deploy/scripts/ec2-setup-ssl-prod.sh"
