#!/usr/bin/env bash
set -euo pipefail

# Copy site nginx config + maintenance snippet from repo on EC2, then reload nginx.
# Usage (on EC2):
#   sudo APP_DIR=/home/ec2-user/apps/taxima-uat \
#     NGINX_SITE_CONF=deploy/nginx/taxima.hkcodai.space.conf \
#     NGINX_TARGET=/etc/nginx/conf.d/0-000-taxima.hkcodai.space.conf \
#     bash deploy/scripts/ec2-nginx-sync.sh

APP_DIR="${APP_DIR:?Set APP_DIR}"
NGINX_SITE_CONF="${NGINX_SITE_CONF:?Set NGINX_SITE_CONF e.g. deploy/nginx/taxima.hkcodai.space.conf}"
NGINX_TARGET="${NGINX_TARGET:-/etc/nginx/conf.d/$(basename "$NGINX_SITE_CONF")}"

SRC="${APP_DIR}/${NGINX_SITE_CONF}"
INC_SRC="${APP_DIR}/deploy/nginx/taxima-maintenance.inc"

if [[ ! -f "$SRC" ]]; then
  echo "Missing ${SRC}" >&2
  exit 1
fi
if [[ ! -f "$INC_SRC" ]]; then
  echo "Missing ${INC_SRC}" >&2
  exit 1
fi

sudo mkdir -p /etc/nginx/snippets /var/www/taxima-maintenance
sudo cp "$INC_SRC" /etc/nginx/snippets/taxima-maintenance.inc
sudo cp "$SRC" "$NGINX_TARGET"
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx synced → ${NGINX_TARGET}"
