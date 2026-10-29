#!/usr/bin/env bash
# 只 build 乘客 release APK
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [[ -x /usr/libexec/java_home ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
fi
export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
(cd "$ROOT" && npm run postinstall --silent 2>/dev/null || true)
OUT="$ROOT/dist/apk"
mkdir -p "$OUT"
ARCH="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}"
FIREBASE_WEB_API_KEY="${EXPO_PUBLIC_FIREBASE_API_KEY:-AIzaSyAaWN6QBOFU9JQ198OoV9yiZ-oBS0CvfoI}"
PROD_API="${EXPO_PUBLIC_API_BASE_URL:-https://app.hktaketaxi.online/api/v1}"
DIR="$ROOT/apps/passenger"
NAME="taxima-passenger-prod-arm64"
ANDROID_APP_ID="1:38342370957:android:1899e7fbe8d12395cf64c4"
ONESIGNAL="971c34e0-e863-4735-b474-d83dc3b63263"

[[ -f "$DIR/google-services.json" ]] && mkdir -p "$DIR/android/app" && cp "$DIR/google-services.json" "$DIR/android/app/google-services.json"
if [[ -f "$DIR/.env" ]]; then set -a; source "$DIR/.env"; set +a; fi
(
  cd "$DIR/android"
  export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-$PROD_API}"
  export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
  export EXPO_PUBLIC_FIREBASE_API_KEY="${EXPO_PUBLIC_FIREBASE_API_KEY:-$FIREBASE_WEB_API_KEY}"
  export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="${EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:-taketaxionlinemain.firebaseapp.com}"
  export EXPO_PUBLIC_FIREBASE_PROJECT_ID="${EXPO_PUBLIC_FIREBASE_PROJECT_ID:-taketaxionlinemain}"
  export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="${EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:-taketaxionlinemain.firebasestorage.app}"
  export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-38342370957}"
  export EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID="$ANDROID_APP_ID"
  export EXPO_PUBLIC_ONESIGNAL_APP_ID="$ONESIGNAL"
  ./gradlew assembleRelease -PreactNativeArchitectures="$ARCH" -x lintVitalRelease --no-daemon
)
apk="$(find "$DIR/android/app/build/outputs/apk/release" -name '*.apk' | head -1)"
cp "$apk" "$OUT/$NAME.apk"
echo "-> $OUT/$NAME.apk"
