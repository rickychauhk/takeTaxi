# Mobile apps

| 目錄 | 說明 |
|------|------|
| `passenger/` | 乘客 Expo App（主畫面 **Taxi Ma**，bundle `online.hktaketaxi.app`） |
| `driver/` | 司機 Expo App（**搭的(司機版)**，bundle `online.hktaketaxi.driverapp`） |

兩個係 **唔同 icon、唔同 native 工程**；唔好只裝司機再 expect 乘客 UI。Metro 亦要分開：

| App | Metro port（預設） | `npm start` 目錄 |
|-----|------------------|------------------|
| Taxi Ma 乘客 | **8081** | `apps/passenger` |
| 搭的 司機 | **8082** | `apps/driver` |

若 **Taxi Ma 顯示「搭的 · 司機版」** 或 `RNCSafeAreaView` unimplemented：代表 Taxi Ma native 殼連咗 **司機 Metro**（通常 8081 上跑緊 `apps/driver`）。停司機 Metro，只喺 `apps/passenger` 起 8081，再 `npx expo run:ios` 開乘客 app。

若 **司機版** 出現 `RNMapsAirModule could not be found`：通常係 **司機 app 誤載乘客 JS**（乘客用 `react-native-maps`，司機 native 未 link）。請停 8081 乘客 Metro，只喺 `apps/driver` 起 **8082**（`npm start` / `npm run ios`），並重新 `npx expo run:ios --port 8082`。

**唔好喺呢一層 `apps/` 跑 `pod install` 或 `expo run:ios`**（會指錯 Podfile / 專案）。

乘客版 iOS（monorepo 根目錄 `npm install` 後，Pod 會指向 **repo 根** `node_modules`）：

```bash
cd passenger
npm run ios
# 或：cd ios && pod install && cd .. && npx expo run:ios --port 8081
```

若出現 `PrivacyInfo.xcprivacy: No such file` 或 OneSignal `[CP] Copy XCFrameworks` 失敗，多數係 **舊 Pod 仍指向 `apps/passenger/node_modules`**。請在 `apps/passenger` 跑 **`npm run preios`**（或 `cd ios && pod install`）後再 build。

若 build 成功但 `simctl openurl … code=60`（Operation timed out）：App 通常 **已裝上 Simulator**，可直接點 **Taxi Ma** 圖示；另開 terminal 先 `npm start`（8081），再 `npm run ios` 或只開 App。Simulator 卡頓時可重開 Simulator 或 `xcrun simctl shutdown booted` 後再 boot。

或由 repo 根目錄：`npm run ios:passenger` / `npm run dev:passenger`

司機版 iOS：

```bash
cd driver
npm install --no-workspaces
cd ios && pod install && cd ..
npx expo run:ios
```

或由 repo 根目錄：`npm run ios:driver`

### 司機版裝上 **真 iPhone**（Xcode / Debug）

Debug 包要連 **Mac 上嘅 Metro（8082）**；錯誤 `Could not connect to development server` + `localhost:8082` 係因為 **真機上 localhost 唔係你部 Mac**。

1. iPhone 同 Mac **同一 Wi‑Fi**；Mac 防火牆允許 Node/Metro。
2. 開 Metro（LAN）：
   ```bash
   cd apps/driver
   npx expo start --port 8082 --host lan
   ```
3. 記低終端機顯示嘅 **Mac IP**（例如 `192.168.1.23`），擇一：
   - **建議**：`npx expo run:ios --device --port 8082`（會幫你設 packager host）
   - 或 Xcode → Scheme → Run → **Environment Variables** 加  
     `REACT_NATIVE_PACKAGER_HOSTNAME` = `192.168.x.x`（你 Mac 嘅 IP）
   - 或在 `apps/driver/ios/app/Info.plist` 設 `RCTMetroHost` = 該 IP（僅本機開發）
4. 再喺 Xcode Run 到真機；紅屏可撳 **Reload JS**。

**唔使 Metro**（離線測 UAT API）：用 **Release** build，或先 `npx expo export` 再 embed bundle（正式上架流程）。
