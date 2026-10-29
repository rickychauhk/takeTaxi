#!/usr/bin/env bash
# 司機 iOS Release（內嵌 JS，唔使 Metro；需本機 Xcode 簽名）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/apps/driver"
OUT="$ROOT/dist/ios"
ARCHIVE="$OUT/TakeTaxiDriver.xcarchive"
IPA="$OUT/taxima-driver-prod.ipa"
mkdir -p "$OUT"
export LANG=en_US.UTF-8

cd "$APP"
echo "==> pod install (preios)"
npm run preios

cd "$APP/ios"
SCHEME="TakeTaxiDriver"
WORKSPACE="TakeTaxiDriver.xcworkspace"

echo "==> xcodebuild archive (Release — bundles main.jsbundle, no dev server)"
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

EXPORT_PLIST="$OUT/ExportOptions-driver.plist"
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
  -exportPath "$OUT/export-driver" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  | xcbeautify 2>/dev/null || cat

if compgen -G "$OUT/export-driver/"'*.ipa' > /dev/null; then
  cp "$OUT/export-driver/"*.ipa "$IPA"
  echo "-> $IPA"
else
  echo "Archive OK: $ARCHIVE (export IPA 需 Xcode 簽名 / APPLE_TEAM_ID)"
  ls -la "$OUT/export-driver" 2>/dev/null || true
fi
