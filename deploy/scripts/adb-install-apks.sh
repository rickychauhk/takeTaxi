#!/usr/bin/env bash
# 經 USB 安裝 dist/apk 內測包到已連接 Android 機（小米等）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:/opt/homebrew/bin:/usr/local/bin:$PATH"

PASSENGER_APK="$ROOT/dist/apk/taxima-passenger-prod-arm64.apk"
DRIVER_APK="$ROOT/dist/apk/taxima-driver-prod-arm64.apk"

usage() {
  cat <<'EOF'
用法:
  adb-install-apks.sh              # 乘客 + 司機（若存在）
  adb-install-apks.sh passenger      # 只裝乘客
  adb-install-apks.sh driver         # 只裝司機
  adb-install-apks.sh --devices      # 列出已連接裝置

小米 MIUI：開發者選項 → USB 調試 + 「USB 調試（安全設置）」；
首次連 Mac 要在手機上按「允許 USB 調試」。
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--devices" ]]; then
  adb devices -l
  exit 0
fi

if ! command -v adb >/dev/null; then
  echo "找不到 adb。請在 Android Studio → SDK Manager 安裝 Android SDK Platform-Tools，"
  echo "或: brew install --cask android-platform-tools"
  exit 1
fi

echo "==> 等待 adb 裝置（請確認 USB 調試已開、線材為傳資料）..."
adb wait-for-device
sleep 1
STATE="$(adb get-state 2>/dev/null || true)"
if [[ "$STATE" != "device" ]]; then
  echo "裝置狀態: ${STATE:-unknown}（若為 unauthorized，請在手機上允許 USB 調試）"
  adb devices -l
  exit 1
fi

echo "==> 已連接:"
adb devices -l

install_one() {
  local label="$1"
  local apk="$2"
  if [[ ! -f "$apk" ]]; then
    echo "略過 $label：找不到 $apk（先跑 deploy/scripts/build-android-apks.sh）"
    return 0
  fi
  echo "==> 安裝 $label ..."
  # -r 覆蓋；簽名唔同時要先卸載舊版
  if ! adb install -r "$apk"; then
    echo ""
    echo "若出現 INSTALL_FAILED_UPDATE_INCOMPATIBLE：請在手機卸載舊版 $label 後再試。"
    return 1
  fi
  echo "    OK: $apk"
}

TARGET="${1:-all}"
case "$TARGET" in
  passenger) install_one "HKTakeTaxi（乘客）" "$PASSENGER_APK" ;;
  driver) install_one "HKTakeTaxi司機版" "$DRIVER_APK" ;;
  all)
    install_one "HKTakeTaxi（乘客）" "$PASSENGER_APK"
    install_one "HKTakeTaxi司機版" "$DRIVER_APK"
    ;;
  *)
    echo "未知參數: $TARGET"
    usage
    exit 1
    ;;
esac

echo "Done."
