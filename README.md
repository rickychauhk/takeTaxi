# Taxi MA（UAT）— API + CRM/CMS

Monorepo：`apps/api`（NestJS + Socket.io）、`apps/crm`（React 18 + Ant Design 5）、MySQL 8、Docker Compose。

## 端口（EC2 主機）

見 [docs/PORTS.md](./docs/PORTS.md)。UAT 使用 **3200**（API/WS）、**3201**（CRM）、**3311**（MySQL，僅本機）。

## 本地開發

```bash
cp .env.uat.example .env.uat
npm install
npm run build -w @taxima/shared
npm run dev:api   # :3000
npm run dev:crm   # :3201
```

預設管理員（首次 DB init）：

- Email：`admin@taxima.hk`
- 密碼：`ChangeMe123!`（上線前請立即修改）

## Docker UAT

```bash
cp .env.uat.example .env.uat
# 編輯密碼與 JWT_SECRET
npm run docker:uat:up
curl -s http://127.0.0.1:3200/api/v1/health
```

## EC2 + HTTPS（taxima.hkcodai.space）

1. SSH 用戶為 **`ec2-user`**（非 ubuntu）。
2. 部署程式碼至 `/home/ec2-user/apps/taxima-uat` 並啟動 Compose。
3. 安裝 Nginx 站點並申請憑證：

```bash
export SSH_KEY="/Users/wingchau/Documents/AWS KEY/ai-sales-bot-key.pem"
export EC2_HOST=52.63.249.152
bash deploy/scripts/ec2-deploy-uat.sh

# 在 EC2 上：
cd /home/ec2-user/apps/taxima-uat
sudo bash deploy/scripts/ec2-setup-ssl-uat.sh deploy/nginx/taxima.hkcodai.space.conf
```

## PROD

- **域名**：**https://app.hktaketaxi.online**（CRM 根路徑；API **`/api/v1`**；WebSocket **`/socket.io`**）
- 複製 `.env.prod.example` → `.env.prod`（`CORS_ORIGIN` 已預設上述域名），使用 `docker-compose.prod.yml`（端口 **3210/3211/3312**）
- Nginx：`deploy/nginx/app.hktaketaxi.online.conf`

**SSH / 部署（本機 repo 內 key，勿 commit）**

```bash
chmod 400 hktaketaxi.pem
export SSH_KEY="$PWD/hktaketaxi.pem"
export EC2_HOST=3.104.225.159
ssh -i "$SSH_KEY" ec2-user@"$EC2_HOST"

# 同步 + docker compose prod
bash deploy/scripts/ec2-deploy-prod.sh

# EC2 上（DNS A 記錄已指向 3.104.225.159 後）：
cd /home/ec2-user/apps/taxima-prod
sudo bash deploy/scripts/ec2-setup-ssl-prod.sh
```

- 用戶：`ec2-user`（Amazon Linux 2023）
- 目前實例（2026-10）：**t3.small**，**ap-southeast-2**，約 **2 GiB RAM**
- App 連 PROD API：`EXPO_PUBLIC_API_BASE_URL=https://app.hktaketaxi.online/api/v1`
- **CRM OTP**：Firebase **singkee-driver** 須把 **`app.hktaketaxi.online`** 加至 Authentication → Authorized domains（見 [docs/PORTS.md](./docs/PORTS.md)）

## 功能對照

| 模組 | API 路由前綴 | CRM 選單 |
|------|----------------|----------|
| 積分審批 | `/admin/point-topups` | 積分購買審批 |
| 聯絡我們 | `/admin/settings/contact_us_html` | 聯絡我們 HTML |
| 反饋 | `/admin/feedbacks` | 意見反饋 |
| 最新消息 | `/admin/settings/news_url` | 最新消息 URL |
| 訊息 | `/admin/messages` | 訊息中心 |
| 優惠碼 | `/admin/promos` | 優惠碼 |
| 廣告 | `/admin/ads` | 廣告管理 |
| 會員/審批 | `/admin/users` | 會員/司機 |
| 訂單 | `/admin/orders` | 訂單 |
| 評分 | `/admin/ratings` | 評分 |
| Audit | `/admin/audit-logs` | 系統日誌 |
| 實時 | `/socket.io` + `location:update` | — |

司機柯打 tier：`ORDER_ADMIN_PREVIEW_SECONDS`（預設 2 秒）→ partner → public。

Stripe/PayPal、OneSignal、完整 AI 模型為 stub，待接 ключ與業務規則後擴展。
