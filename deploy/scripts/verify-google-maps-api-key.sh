#!/usr/bin/env bash
# 快速檢查 Maps Platform API 金鑰是否有效（本機 HTTP；Android 限制 key 可能仍顯示 invalid）
set -euo pipefail
KEY="${1:-${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:-}}"
if [[ -z "$KEY" ]]; then
  echo "用法: $0 <AIzaSy...>  或  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=... $0"
  exit 1
fi
echo "==> Geocoding API"
curl -sS "https://maps.googleapis.com/maps/api/geocode/json?address=Hong+Kong&key=${KEY}" | head -c 300
echo
echo "==> Static Map (HTTP status)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://maps.googleapis.com/maps/api/staticmap?center=22.3,114.2&zoom=10&size=200x200&key=${KEY}"
