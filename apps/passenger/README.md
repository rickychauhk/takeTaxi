# Taxi Ma — 乘客 App (React Native / Expo)

- 顯示名稱：**Taxi Ma**；畫面頂部品牌：**搭的**（繁）/ **Taxi Ma**（英）
- **語言**：跟系統（Intl / iOS `SettingsManager`）；英文系統 → 英文 UI，其餘預設繁中。可設 `EXPO_PUBLIC_APP_LOCALE=en` 或 `zh` 強制
- 若加咗 `expo-localization` 後出現 `Cannot find native module ExpoLocalization`，請 **`npx expo run:ios`** 重建 dev client（唔好只 reload JS）
- Bundle ID：**`online.hktaketaxi.app`**（iOS / Android；**不是** OneSignal App ID）

## 功能（首版）

- 深色地圖主畫面（對照設計稿）
- **起點**：GPS + 反向地理編碼
- **終點**：隨機香港 demo 地址（可「清空」換一個）
- **⇅** 一鍵對調起點／終點
- 地圖顯示 **附近司機**：`GET /realtime/nearby-drivers`（`live_locations` 內 **3 分鐘內**有上報 GPS 的司機；司機 App 上線後約每 4s 上報）
- **OneSignal** push（`EXPO_PUBLIC_ONESIGNAL_APP_ID`；**唔支援 Expo Go**，要 `expo run:ios` / dev build）
- **Firebase Crashlytics**（`@react-native-firebase/app` + `crashlytics`；要 `google-services.json` / `GoogleService-Info.plist`）

## 開發

```bash
cd apps/passenger
cp .env.example .env
npm install --no-workspaces
```

### Firebase Crashlytics（native 設定檔）

1. Firebase Console → 專案 **hktaketaxi-679f2** → **iOS** / **Android**（`online.hktaketaxi.app`）。
2. 下載設定檔，放到 **`apps/passenger/` 根目錄**（同 `app.config.ts`）：
   - `GoogleService-Info.plist`
   - `google-services.json`  
   可對照 `*.example` 檔格式；**勿用司機版** `GoogleService-Info.plist`（bundle 唔同）。
3. Console 內 **Crashlytics** 開啟。
4. **未有 plist 時**：`react-native.config.js` 會略過 RNFB native link，避免 `Could not get GOOGLE_APP_ID`；電話登入 recaptcha（expo-firebase-core）仍可 build。
5. 放好 **有效** plist 後（唔好只把 `.example` 改名）：
   ```bash
   npm run preios   # 同步 plist 至 ios/TaxiMa/、pod install、RNFB link
   npm run ios
   ```
6. iOS 有有效 plist 時，`app.config.ts` 會加入 `@react-native-firebase/*` 同 `expo-build-properties`（`useFrameworks: static`）。Android 仍要 `google-services.json`。
7. 若 build 仍出現 `[RNFB]` / `GOOGLE_APP_ID`：多數係舊 Pods — `rm -rf ios/Pods && npm run preios`，再 `npm run ios`（唔好跳過 `preios`）。

**iOS CocoaPods**：`expo-firebase-recaptcha`（Firebase **9**）同 `@react-native-firebase/*`（Firebase **12**）會衝突。Repo 已在 `ios/Podfile` 設 `$FirebaseSDKVersion = '12.10.0'`，並用 `patch-package` 更新 `expo-firebase-core` podspec。若仍見 `Firebase/CoreOnly` 版本錯：

```bash
cd apps/passenger/ios
rm -f Podfile.lock
EXPO_USE_PRECOMPILED_MODULES=0 pod install --repo-update
```

`filter_map` 警告表示 CocoaPods 用咗 Ruby 2.6 或更舊；請用 `ruby --version`（建議 2.7.6 或以上，見 `ios/.ruby-version`）再跑 `pod install`。

（終端 **唔好** 連 `# 註解` 一齊 paste，npm 會報 `EINVALIDTAGNAME`。）

與司機版 **分開**：Metro 唔好同時用 8081 跑 `apps/driver`；乘客請喺本目錄 `npx expo start`，司機用另一 port 或先停司機 Metro。

```bash
npx expo install react-native-maps expo-location expo-constants
npm run prebuild -- --clean   # 或 npx expo prebuild --clean；`withPassengerIosPodfile` 會喺 pod install 前修正 maps Pod
# iOS 27+ 須 UIScene：`app.config.ts` 已設 `EXExpoAppSceneDelegate`；`AppDelegate` 須 conform `ExpoReactNativeFactoryProvider` 且唔喺 launch 入面建 `UIWindow`（見 repo 內 `ios/TaxiMa/AppDelegate.swift`）
npm run preios && npm run ios   # 或 npx expo run:ios
```

若見 `No podspec found for react-native-google-maps`：`react-native-maps` 1.27+ 已無此 pod；請拉最新 code（含 `plugins/withPassengerIosPodfile.mjs`），再 `npm run postprebuild` 後 `cd ios && EXPO_USE_PRECOMPILED_MODULES=0 pod install`。

### 常見 log

| 訊息 | 處理 |
|------|------|
| `No script URL provided` / `unsanitizedScriptURLString = (null)` | **Metro 未開**。在 `apps/passenger` 跑 `npx expo start`（或 `npm run dev:passenger` 於 repo 根），再 Reload；勿只喺 Xcode 按 Run 而冇 packager |
| `[OneSignal] 略過初始化` | 在 `.env` 填 `EXPO_PUBLIC_ONESIGNAL_APP_ID`（見 `.env.example`）後 **重啟 Metro**（`npx expo start -c`）；native 未 link 時要重新 `npx expo run:ios` |
| OneSignal 整合完成彈窗 | 裝置取得 server subscription id 後會彈一次；撳 **Got it** 先會要求通知權限 |
| `[MapKit] kCLErrorDomain Code=1` | 定位被拒：Simulator **Features → Location** 選 Custom 或 Apple；或 iOS **設定 → Taxi Ma → 位置** |
| `[VectorKit] GEOErrorDomain -7` | Simulator 載入 Apple 地圖瓦片失敗（網絡/VPN），多數可忽略；真機通常正常 |
| `PrivacyInfo.xcprivacy: No such file` | `node_modules` 不完整（workspace 抽走依賴）。`rm -rf node_modules && npm install --no-workspaces`，再 `cd ios && pod install` |
| `No podspec for react-native-google-maps` | Expo 預設 Pod 名稱過時；跑 `npm run postprebuild` 或重新 `npm run prebuild -- --clean` |
| `[Expo-precompiled] filter_map` | CocoaPods 用 Ruby 2.6 或更舊時的警告；`Podfile.properties.json` 應為 `EXPO_USE_PRECOMPILED_MODULES: false`，並用 `EXPO_USE_PRECOMPILED_MODULES=0 pod install`（建議 Ruby 2.7.6+） |

Simulator 需允許定位；Android 地圖需 Google Maps API key（`app.config.ts` 可再加 `android.config.googleMaps.apiKey`）。

**行車路線**：起點與終點確定後會拉 **駕駛路線** 並畫喺地圖（唔再係直線）。有 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` 時用 **Google Directions**；否則 dev 用 OSRM 公開 router（正式上線請用 Google 或自建 OSRM）。

### iOS build 失敗（Copy XCFrameworks / ReactCodegen 找不到）

通常係 DerivedData 或 `ios/build` 同 Pods 狀態不一致。關 Xcode 後：

```bash
cd apps/passenger
rm -rf ios/build ios/Pods ios/Podfile.lock ~/Library/Developer/Xcode/DerivedData/TaxiMa-*
cd ios && pod install && cd ..
npx expo run:ios
```

`ios/Podfile.properties.json` 已設 `EXPO_USE_PRECOMPILED_MODULES: false`，避免 `ExpoModulesJSI` copy xcframework 失敗。

## 與 monorepo

根目錄可執行：`npm run dev:passenger`（見根 `package.json`）。
