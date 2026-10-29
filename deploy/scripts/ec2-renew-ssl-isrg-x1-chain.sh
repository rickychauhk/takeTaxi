#!/usr/bin/env bash
# 在 PROD EC2 上執行：將 Let's Encrypt 換成 ISRG Root X1 兼容鏈（修 Android 13 / 舊機 SSLHandshakeException YE1）
set -euo pipefail
DOMAIN="${1:-app.hktaketaxi.online}"
EMAIL="${CERTBOT_EMAIL:-admin@hktaketaxi.online}"

echo "==> Renew $DOMAIN (RSA/YR* 鏈；ECDSA/YE* 的 P-384 中繼會令 Android SSLHandshakeException YE2) ..."
sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
  --cert-name "$DOMAIN" \
  --key-type rsa \
  --rsa-key-size 2048 \
  --preferred-chain "ISRG Root X1" \
  --force-renewal \
  --agree-tos --non-interactive -m "$EMAIL"

echo "==> Ensure renewal keeps X1 chain"
RENEW="/etc/letsencrypt/renewal/${DOMAIN}.conf"
if [[ -f "$RENEW" ]] && ! grep -q 'preferred_chain = ISRG Root X1' "$RENEW" 2>/dev/null; then
  echo "preferred_chain = ISRG Root X1" | sudo tee -a "$RENEW" >/dev/null
fi

sudo nginx -t
sudo systemctl reload nginx
echo "OK https://${DOMAIN} (reload nginx)"
