# Taxima 端口規劃（避免與 EC2 現有服務衝突）

掃描日期：2026-10-10（`52.63.249.152`）

## 已被佔用（勿用）

| 端口 | 用途 |
|------|------|
| 80 / 443 | 主機 Nginx（全站 HTTPS 入口） |
| 22 / 2222 | SSH |
| 3003 | Node（/var/www/a…） |
| 3306 | 主機 MariaDB |
| 3307 | clawmaster-mysql |
| 3310 | mahjong-mysql-uat |
| 4000 | ai-sales-bot-backend |
| 5173 | ai-sales-bot-frontend |
| 6333 | clawmaster-qdrant |
| 8080 | clawmaster-nginx |
| 3088–3092 | accounting / booking / mahjong prod |
| 3190–3191 | mahjong UAT |

## Taxima 分配

| 環境 | 服務 | 主機綁定 | 容器端口 |
|------|------|----------|----------|
| UAT | API + WebSocket | `127.0.0.1:3200` | 3000 |
| UAT | CRM (Nginx 靜態) | `127.0.0.1:3201` | 80 |
| UAT | MySQL | `127.0.0.1:3311` | 3306 |
| PROD（預留） | API + WebSocket | `127.0.0.1:3210` | 3000 |
| PROD（預留） | CRM | `127.0.0.1:3211` | 80 |
| PROD（預留） | MySQL | `127.0.0.1:3312` | 3306 |

對外域名：

- **UAT**：`https://taxima.hkcodai.space` → CRM；`/api/`、`/socket.io/` → API
- **PROD**：`https://app.hktaketaxi.online` → CRM；`/api/`、`/socket.io/` → API（主機 **3.104.225.159**，Nginx：`deploy/nginx/app.hktaketaxi.online.conf`）

## CRM 電話 OTP（Firebase）

- **UAT CRM**：Firebase **singkee-driver**（本地 build 預設）
- **PROD CRM**：Firebase **taketaxionlinemain**（`.env.prod` 嘅 `VITE_FIREBASE_*`，docker build CRM 注入）

API 驗 OTP token 用 **`FIREBASE_WEB_API_KEY`**（須同 CRM 該環境 Web `apiKey` 一致）。

**新 PROD 域名必須加入 Firebase 授權網域**，否則瀏覽器會 `auth/unauthorized-domain`、無法發 SMS OTP：

1. [Firebase Console](https://console.firebase.google.com/) → **taketaxionlinemain**（PROD CRM）或 **singkee-driver**（UAT）→ **Authentication** → **Settings** → **Authorized domains**
2. **Add domain**：`app.hktaketaxi.online`
3. 無需 redeploy API/CRM（改 Console 後幾分鐘內生效）

UAT 已有 `taxima.hkcodai.space`；PROD 上線時常漏加 `app.hktaketaxi.online`。

### `auth/operation-not-allowed` — SMS region

若 CRM／App 出現 **「SMS unable to be sent until this region enabled by the app developer」**：

1. Firebase Console → 對應專案（PROD CRM：**taketaxionlinemain**）→ **Authentication**
2. **Sign-in method**：啟用 **Phone**
3. **Settings** → **SMS region policy** → 選 **Allow**（allowlist）→ 加入 **`HK`**（+852 香港；CLDR 兩字母區碼）
4. **`auth/billing-not-enabled`**：專案仍係 Spark → 必須 **Upgrade to Blaze**（Firebase Console → ⚙️ Project settings → **Usage and billing** → Modify plan → Blaze，並連結 GCP 帳單）。Phone SMS 自 2024 年起唔再包含在免費 Spark 方案。

乘客 App 用 **taketaxionlinemain**（`google-services.json` / `GoogleService-Info.plist`），同一專案亦要開 **HK** 與 Phone 登入；API 設 **`PASSENGER_FIREBASE_WEB_API_KEY`** 同 JS **`EXPO_PUBLIC_FIREBASE_API_KEY`**（Web apiKey）。
