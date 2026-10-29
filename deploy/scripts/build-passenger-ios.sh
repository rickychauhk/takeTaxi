#!/usr/bin/env bash
# 乘客 iOS Release（需本機 Xcode 簽名；產物 dist/ios/）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/apps/passenger"
OUT="$ROOT/dist/ios"
ARCHIVE="$OUT/TakeTaxi.xcarchive"
IPA="$OUT/taxima-passenger-prod.ipa"
mkdir -p "$OUT"
export LANG=en_US.UTF-8

cd "$APP"
export EXPO_PUBLIC_ONESIGNAL_APP_ID="${EXPO_PUBLIC_ONESIGNAL_APP_ID:-971c34e0-e863-4735-b474-d83dc3b63263}"

echo "==> expo prebuild (iOS — OneSignal NSE + App Group)"
npx expo prebuild --platform ios --no-install
node ./scripts/patch-ios-podfile.mjs
node ./scripts/patch-ios-app-delegate.mjs

echo "==> pod install (preios)"
npm run preios

cd "$APP/ios"
SCHEME="TakeTaxi"
WORKSPACE="TakeTaxi.xcworkspace"

echo "==> xcodebuild archive"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID:-}" \
  -allowProvisioningUpdates \
  | xcbeautify 2>/dev/null || cat

EXPORT_PLIST="$OUT/ExportOptions.plist"
cat > "$EXPORT_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>development</string>
  <key>signingStyle</key>
  <string>automatic</string>
</dict>
</plist>
PLIST

echo "==> export IPA"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$OUT/export" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  | xcbeautify 2>/dev/null || cat

if [[ -f "$OUT/export/TakeTaxi.ipa" ]]; then
  cp "$OUT/export/TakeTaxi.ipa" "$IPA"
  echo "-> $IPA"
elif [[ -f "$OUT/export/taxima-passenger.ipa" ]]; then
  cp "$OUT/export/"*.ipa "$IPA"
  echo "-> $IPA"
else
  echo "Archive OK: $ARCHIVE (export IPA 需 Xcode 簽名 / APPLE_TEAM_ID)"
  ls -la "$OUT/export" 2>/dev/null || true
fi
