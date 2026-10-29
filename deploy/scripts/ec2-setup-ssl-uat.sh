#!/usr/bin/env bash
set -euo pipefail

DOMAIN="taxima.hkcodai.space"
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FULL_CONF="${DIR}/deploy/nginx/taxima.hkcodai.space.conf"
INIT_CONF="${DIR}/deploy/nginx/taxima.hkcodai.space.init.conf"
TARGET="/etc/nginx/conf.d/${DOMAIN}.conf"

sudo mkdir -p /var/www/certbot

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "==> Stage 1: HTTP-only nginx for ACME"
  sudo cp "$INIT_CONF" "$TARGET"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "==> certbot webroot"
  sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --agree-tos --non-interactive -m "${CERTBOT_EMAIL:-admin@taxima.hk}" || {
    echo "Run interactively if needed: sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
    exit 1
  }
fi

echo "==> Stage 2: Full HTTPS reverse proxy"
sudo mkdir -p /etc/nginx/snippets /var/www/taxima-maintenance
sudo cp "${DIR}/deploy/nginx/taxima-maintenance.inc" /etc/nginx/snippets/taxima-maintenance.inc
sudo cp "$FULL_CONF" "/etc/nginx/conf.d/0-000-taxima.hkcodai.space.conf"
if ! grep -q "0-000-taxima.hkcodai.space.conf" /etc/nginx/nginx.conf; then
  echo "==> Register site in /etc/nginx/nginx.conf (explicit include list on this host)"
  sudo sed -i "/include \\/etc\\/nginx\\/conf.d\\/0-stocksai.conf/i\\    include /etc/nginx/conf.d/0-000-taxima.hkcodai.space.conf;" /etc/nginx/nginx.conf
fi
sudo nginx -t
sudo systemctl reload nginx
echo "OK https://${DOMAIN}"
