# 搭的 — 司機版（Expo / React Native）

## 重要：路徑

| ❌ 唔好 | ✅ 要 |
|--------|------|
| `apps/` 入面 `pod install`（會用到 `~/Podfile`） | `apps/driver/ios` 入面 `pod install` |
| repo 根目錄 `npx expo run:ios` | `apps/driver` 入面 `npx expo run:ios` |
| `apps/driver` 跑完再 `cd ..` 用 expo | 全程留喺 `apps/driver` |

根目錄只係 API/CRM workspace。請喺 **本目錄** 操作：

```bash
cd apps/driver
npm install --no-workspaces   # 首次或加依賴後（含 react-native-webview、patch-package）
npm start                     # Metro（固定 port **8082**）
npm run ios                   # 本機編譯 iOS（`expo run:ios --port 8082`）
```

或由 repo 根目錄：

```bash
npm run dev:driver
npm run ios:driver
```

## iOS CocoaPods

加 native 依賴（例如 Firebase OTP）後：

```bash
cd ios && pod install && cd ..   # 加 native 依賴（webview 等）後必跑

iOS 27+ / Xcode 新 SDK 需要 **UIScene**（`Info.plist` → `EXExpoAppSceneDelegate` + `AppDelegate` 實作 `ExpoReactNativeFactoryProvider`）。若見 “UIScene lifecycle is required”，請重新 `npx expo run:ios`。
```

若 Xcode 報 `Module 'FirebaseCore' not found`（Firebase OTP），Podfile 已為 Firebase 相關 pod 開 `modular_headers`；改動後請再跑 `pod install` 並重新 build。

`expo-firebase-core@6` 與 Expo SDK 57 唔相容（`EXLogWarn`）。iOS Pod 會編譯 **repo 根** `node_modules/expo-firebase-core`，請在 **monorepo 根** 跑過 `npm install`（`postinstall` → `patches/expo-firebase-core+6.0.0.patch`）。喺 `apps/driver` 跑 `npm run ios` 亦會先 `patch-package`。

Bundle ID：`online.hktaketaxi.driverapp`（見 `app.config.ts`）。

## 上線／行程狀態

- **上線**會寫入 AsyncStorage；kill app 重開仍保持上線，直至手動「收工」或登出。
- **進行中柯打**重開後會 call `GET /driver/orders/active`，按 API 狀態還原行程畫面；API 不可用時用本地快照。
- 「我已到達／開始行程／完成」需要 **`PATCH /driver/orders/:id/status`**（UAT 必須 deploy 最新 `@taxima/api`，否則 404）。
- 開發時頂部藍色 **Refreshing…** 係 Metro Fast Refresh（bundle 重載），唔係接單 WS；若不停出現，多因 socket effect 重連，已盡量穩定 `useLiveDispatch` 依賴。

## Metro 連錯 bundle

司機 **native** 載入咗 **乘客** Metro bundle（8081）時，會出現類似：

- `TurboModuleRegistry ... RNMapsAirModule could not be found`（司機 JS 唔用 `react-native-maps`）
- `TurboModuleRegistry ... OneSignal could not be found`（乘客 bundle 有 OneSignal，司機 binary 無）

請確保：

1. 乘客 Metro 只喺 **8081**（`apps/passenger`），司機 Metro 只喺 **8082**（`apps/driver`）。
2. 用 `npm run ios` 或 `npx expo run:ios --port 8082` 開司機 app（`Info.plist` `RCTMetroPort` = 8082）。
3. 真機：`REACT_NATIVE_PACKAGER_HOSTNAME` / `Info.plist` `RCTMetroHost` 指向 Mac IP，且 **8082** 有司機 Metro 在跑。
4. 改 native 後要重新 build，唔係只按 Reload。
5. 仍錯：停晒 Metro → `cd apps/driver && npx expo start -c --port 8082` → Xcode 再 run 司機 scheme。

## 直／橫屏

App 允許旋轉（`orientation: default`）。橫屏時接單／行程頁為 **地圖 + 右側可捲動側欄**，避免底部 sheet 遮住必要資訊；新柯打彈窗、登入、收入頁均可捲動顯示完整內容。

**行車 UI**：`useDrivingUi` 依螢幕短邊放大字體同按鈕（主 CTA 約 64pt 高、快捷鍵 ≥56pt），行程頁以「當前路段地址 + 大按鈕」為主，減少細字同重複操作。

**接單範圍**：底部 Tab「設定」可選 2／4／6 公里或不限；上線後經 WebSocket `maxPickupRadiusKm` 同 HTTP `GET .../available?maxPickupRadiusKm=` 過濾。**已設公里數時**：未有 GPS、或柯打缺上車點座標 → **唔會**當「不限」而顯示公海單；需定位成功且 API 返 `pickupLat/Lng` 先會入列表／彈窗。上線後首頁地圖會以橙色圓圈標示接單半徑，並自動縮放至可睇清整個範圍（橫屏會預留右側 panel）。地圖右下 **定位**（`locate`）會移回你嘅位置／接單圓；**聲音**掣切換導航語音播報（行程導航 UI 顯示時會讀出路口提示，偏好會記住）。

## API

預設 PROD：`EXPO_PUBLIC_API_BASE_URL=https://app.hktaketaxi.online/api/v1`

**接單大廳**：上線後經 **WebSocket**（`driver:orders:subscribe` + `driver:order:snapshot` / `driver:order:event`）同步待派柯打；Socket 斷線時每 30 秒 HTTP 對帳 `GET /driver/orders/available`。`public` 司機要等落單後約數秒先見到單（Admin 預覽時段，server 會定時 re-push）。若底部仍顯示「行程進行中」但無行程，按 **離開行程／返回接單** 清除本地原型狀態。

**若登入出現 `Cannot POST .../driver/auth/check-phone`**：UAT 尚未部署司機 auth 模組。要嘛 deploy 最新 `apps/api`（含 migration `014`），要嘛本地：

```bash
# 終端 A：repo 根目錄
npm run dev:api

# apps/driver/.env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/api/v1

# 重新 npx expo start -c
```

真機請把 `127.0.0.1` 換成 Mac 嘅 LAN IP（同 Metro 嗰個網段）。

登入：CRM 司機電話 + Firebase OTP（Firebase **taketaxionlinemain**）。

- **iOS**：`ios/app/GoogleService-Info.plist`（`online.hktaketaxi.driverapp`）
- **Android**：根目錄 `google-services.json`（含乘客／司機兩個 client；Gradle 按 `online.hktaketaxi.driverapp` 揀）
- **JS OTP**：`src/firebase/config.ts`；建議 Console 加 **Web App** 並設 `EXPO_PUBLIC_FIREBASE_APP_ID`
