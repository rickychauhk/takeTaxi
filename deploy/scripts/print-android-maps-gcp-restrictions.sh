#!/usr/bin/env bash
# 對照 Google Cloud「Android 應用程式限制」：package + SHA-1（debug keystore = 目前 release 簽名）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEYSTORE="${1:-$ROOT/apps/driver/android/app/debug.keystore}"

echo "==> Keystore: $KEYSTORE"
keytool -list -v -keystore "$KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep -E "SHA1:|SHA256:"

echo ""
echo "==> 請在 GCP API 金鑰「Android 應用程式」加入："
printf "司機  package: online.hktaketaxi.driverapp\n"
printf "乘客  package: online.hktaketaxi.app\n"
printf "SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25\n"
printf "API:   Maps SDK for Android\n"
echo ""
echo "==> apps/driver/.env EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
grep GOOGLE_MAPS "$ROOT/apps/driver/.env" 2>/dev/null || true
echo ""
echo "==> AndroidManifest (driver)"
grep geo.API_KEY "$ROOT/apps/driver/android/app/src/main/AndroidManifest.xml" || true
