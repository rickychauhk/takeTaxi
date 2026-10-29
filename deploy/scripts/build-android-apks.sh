#!/usr/bin/env bash
# 本機導出乘客／司機 release APK（debug 簽名，方便內測 sideload）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [[ -x /usr/libexec/java_home ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
fi
export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

# 根目錄 postinstall 會套用 patches/expo-firebase-core（Expo 57 Android）
(cd "$ROOT" && npm run postinstall --silent 2>/dev/null || true)

OUT="$ROOT/dist/apk"
mkdir -p "$OUT"
ARCH="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}"

# taketaxionlinemain — JS OTP Web key + 各 App Android appId（bundle 時 embed）
FIREBASE_WEB_API_KEY="${EXPO_PUBLIC_FIREBASE_API_KEY:-AIzaSyAaWN6QBOFU9JQ198OoV9yiZ-oBS0CvfoI}"
PROD_API="${EXPO_PUBLIC_API_BASE_URL:-https://app.hktaketaxi.online/api/v1}"

# prebuild 有時會留下只有 build/、無 package.json 的 expo stub，會令 autolinking 漏掉 ExpoFetchModule → 一開 App crash
clean_broken_expo_stub() {
  local dir="$1"
  if [[ -f "$dir/scripts/ensureExpoNativeLink.mjs" ]]; then
    node "$dir/scripts/ensureExpoNativeLink.mjs"
    return
  fi
  local stub="$dir/node_modules/expo"
  if [[ -d "$stub" && ! -f "$stub/package.json" ]]; then
    rm -rf "$stub"
    echo "    removed broken node_modules/expo stub (missing package.json)"
  fi
}

verify_expo_fetch_module() {
  local dir="$1"
  local list
  list="$(node -e "
    const path=require('path');
    const req=require('module').createRequire(path.join('${dir}','package.json'));
    const root=path.dirname(req.resolve('expo/package.json'));
    console.log(path.join(root,'android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt'));
  " 2>/dev/null)" || true
  if [[ -z "$list" || ! -f "$list" ]]; then
    echo "    WARN: ExpoModulesPackageList not generated yet (will run generatePackagesList)"
    return 0
  fi
  if ! grep -q 'ExpoFetchModule' "$list"; then
    echo "    ERROR: ExpoModulesPackageList missing ExpoFetchModule — aborting build (would crash at launch)"
    exit 1
  fi
  echo "    verified ExpoFetchModule in ExpoModulesPackageList"
}

sync_google_services() {
  local dir="$1"
  if [[ -f "$dir/google-services.json" ]]; then
    mkdir -p "$dir/android/app"
    cp "$dir/google-services.json" "$dir/android/app/google-services.json"
    echo "    synced google-services.json -> android/app/"
  fi
}

sync_maps_api_key_manifest() {
  local dir="$1"
  local key="$2"
  local manifest="$dir/android/app/src/main/AndroidManifest.xml"
  [[ -f "$manifest" && -n "$key" ]] || return 0
  if grep -q 'com.google.android.geo.API_KEY' "$manifest"; then
    sed -i '' "s|android:name=\"com.google.android.geo.API_KEY\" android:value=\"[^\"]*\"|android:name=\"com.google.android.geo.API_KEY\" android:value=\"${key}\"|" "$manifest"
    echo "    synced com.google.android.geo.API_KEY in AndroidManifest.xml"
  fi
}

load_app_dotenv() {
  local dir="$1"
  if [[ -f "$dir/.env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$dir/.env"
    set +a
  fi
}

build_one() {
  local name="$1"
  local dir="$2"
  local android_app_id="$3"
  local onesignal_app_id="${4:-}"
  echo "==> Building $name (release, $ARCH) ..."
  clean_broken_expo_stub "$dir"
  sync_google_services "$dir"
  load_app_dotenv "$dir"
  sync_maps_api_key_manifest "$dir" "${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
  (
    cd "$dir/android"
    ./gradlew :expo:generatePackagesList -PreactNativeArchitectures="$ARCH" --no-daemon -q || true
    verify_expo_fetch_module "$dir"
    export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-$PROD_API}"
    export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
    export EXPO_PUBLIC_FIREBASE_API_KEY="${EXPO_PUBLIC_FIREBASE_API_KEY:-$FIREBASE_WEB_API_KEY}"
    export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="${EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:-taketaxionlinemain.firebaseapp.com}"
    export EXPO_PUBLIC_FIREBASE_PROJECT_ID="${EXPO_PUBLIC_FIREBASE_PROJECT_ID:-taketaxionlinemain}"
    export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="${EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:-taketaxionlinemain.firebasestorage.app}"
    export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-38342370957}"
    export EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID="$android_app_id"
    if [[ -n "$onesignal_app_id" ]]; then
      export EXPO_PUBLIC_ONESIGNAL_APP_ID="$onesignal_app_id"
    fi
    ./gradlew assembleRelease -PreactNativeArchitectures="$ARCH" -x lintVitalRelease --no-daemon
  )
  local apk
  apk="$(find "$dir/android/app/build/outputs/apk/release" -name '*.apk' | head -1)"
  cp "$apk" "$OUT/$name.apk"
  echo "    -> $OUT/$name.apk"
}

build_one "taxima-passenger-prod-arm64" "$ROOT/apps/passenger" "1:38342370957:android:1899e7fbe8d12395cf64c4" "971c34e0-e863-4735-b474-d83dc3b63263"
build_one "taxima-driver-prod-arm64" "$ROOT/apps/driver" "1:38342370957:android:60422713614c2b91cf64c4" "89adb767-9f3c-4bb2-8151-8de2062877d2"
echo "Done. APKs in $OUT"
