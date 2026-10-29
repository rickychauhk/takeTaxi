#!/usr/bin/env bash
set -euo pipefail

DOMAIN="app.hktaketaxi.online"
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FULL_CONF="${DIR}/deploy/nginx/app.hktaketaxi.online.conf"
INIT_CONF="${DIR}/deploy/nginx/app.hktaketaxi.online.init.conf"
TARGET="/etc/nginx/conf.d/${DOMAIN}.conf"

ensure_certbot_nginx_tls_files() {
  # webroot certonly does not create these; full site conf expects them (same as certbot --nginx).
  sudo mkdir -p /etc/letsencrypt
  if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    sudo curl -fsSL \
      "https://raw.githubusercontent.com/certbot/certbot/v2.6.0/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf" \
      -o /etc/letsencrypt/options-ssl-nginx.conf
  fi
  if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    sudo curl -fsSL \
      "https://raw.githubusercontent.com/certbot/certbot/v2.6.0/certbot/certbot/ssl-dhparams.pem" \
      -o /etc/letsencrypt/ssl-dhparams.pem
  fi
}

sudo mkdir -p /var/www/certbot

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "==> Stage 1: HTTP-only nginx for ACME"
  sudo cp "$INIT_CONF" "$TARGET"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "==> certbot webroot (DNS must point to this host)"
  # Android Conscrypt 會拒絕 YE* P-384 中繼；用 RSA/YR* + ISRG Root X1 交叉簽 Root YR。
  sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --cert-name "$DOMAIN" \ 
    --key-type rsa \
    --rsa-key-size 2048 \
    --preferred-chain "ISRG Root X1" \
    --agree-tos --non-interactive -m "${CERTBOT_EMAIL:-admin@hktaketaxi.online}" || {
    echo "Run interactively if needed: sudo certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
    exit 1
  }
fi

echo "==> Stage 2: Full HTTPS reverse proxy"
ensure_certbot_nginx_tls_files
sudo mkdir -p /etc/nginx/snippets /var/www/taxima-maintenance
sudo cp "${DIR}/deploy/nginx/taxima-maintenance.inc" /etc/nginx/snippets/taxima-maintenance.inc
sudo cp "$FULL_CONF" "$TARGET"
sudo nginx -t
sudo systemctl reload nginx
echo "OK https://${DOMAIN}"
