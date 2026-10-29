#!/usr/bin/env node
/**
 * 在 hkcodai.space（/var/www/ai-training-website）新增「搭的」的士平台服務卡片 + 詳情。
 * 於 EC2 執行：cd /var/www/ai-training-website && node /path/to/hkcodai-add-taxima-service.js
 */
const fs = require('fs');
const path = require('path');

const appRoot = process.env.HKCODAI_APP_ROOT || '/var/www/ai-training-website';
process.chdir(appRoot);
require('dotenv').config({ path: path.join(appRoot, '.env') });
const { pool } = require(path.join(appRoot, 'config/database'));

const SERVICE_ID = 10;
const SLUG_TITLE = '飛的同級 · 的士平台 SaaS';
const LEGACY_TITLES = ['搭的 · 的士平台 SaaS', SLUG_TITLE];
const IMAGE_DEST = '/uploads/taxima-taxi-saas-banner.jpg';
const BANNER_FILENAME = path.basename(IMAGE_DEST);

const detailContent = `
<div class="taxima-saas-intro">

<section style="margin-bottom:2.5rem;padding:2rem;background:linear-gradient(135deg,#1e3a5f 0%,#7c3aed 100%);border-radius:1rem;color:#fff;text-align:center;">
  <p style="font-size:0.95rem;letter-spacing:0.08em;opacity:0.9;margin-bottom:0.5rem;">SaaS 訂閱 · 含雲端部署支援</p>
  <h2 style="font-size:2rem;font-weight:800;margin:0 0 1rem;">每月 HK$ 6,800</h2>
  <p style="max-width:640px;margin:0 auto;line-height:1.85;font-size:1.05rem;opacity:0.95;">
    一套方案包含<strong>乘客 App</strong>、<strong>司機 App</strong>與<strong>CRM 後台</strong>，
    以訂閱形式交付予的士／客運營運商使用；CODAI 負責 AWS 架構、上線與持續維運支援。
  </p>
</section>

<section style="margin-bottom:2.5rem;padding:1.75rem 2rem;background:#fffbeb;border-radius:1rem;border:1px solid #fcd34d;">
  <h2 style="font-size:1.5rem;color:#92400e;margin:0 0 0.75rem;font-weight:800;">界面與功能｜與「飛的」App 同級</h2>
  <p style="margin:0 0 1rem;line-height:1.85;color:#78350f;font-size:1.05rem;">
    本方案<strong>乘客 App、司機 App 的界面布局與核心功能，與香港「飛的」的士 App 同類一致</strong>——營運商無需從零摸索，司機與乘客可沿用已熟悉的叫車習慣；CRM 後台則提供與上述 App 配套的全套營運管理。
  </p>
  <p style="margin:0 0 0.75rem;color:#92400e;font-weight:700;font-size:0.95rem;">對標「飛的」的主要能力包括（不限於）：</p>
  <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:#44403c;font-size:0.98rem;">
    <li><strong>乘客端</strong>：地圖起訖點、隧道／停站／車型等叫車選項、即時與預約落柯打、估價、附近司機、積分抵扣、訂單狀態、評分、推播通知</li>
    <li><strong>司機端</strong>：上線接單、柯打列表、接單範圍、導航地圖、放柯打／懸賞、積分制度、充值與後台審批、新柯打推播</li>
    <li><strong>後台 CRM</strong>：即時監控柯打、手動派車、司機／乘客檔案、叫車選項配置、繁忙時段積分、落柯打紀錄、廣告與條款等</li>
  </ul>
  <p style="margin:1rem 0 0;font-size:0.875rem;color:#78716c;line-height:1.6;">
    * 「飛的」為香港第三方的士平台商標；本方案為 CODAI 獨立開發之 SaaS 產品，界面與功能對齊同類市場標準，並可因應客戶品牌（如「搭的」）客製域名、Logo 與文案。
  </p>
</section>

<section style="margin-bottom:2.5rem;">
  <h2 style="font-size:1.5rem;color:#111827;margin-bottom:1rem;font-weight:700;">三端產品</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;">
    <div style="background:#fff;padding:1.25rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <strong style="color:#7c3aed;display:block;margin-bottom:0.5rem;">乘客 App（Android / iOS）</strong>
      <p style="margin:0;color:#4b5563;line-height:1.7;font-size:0.95rem;">地圖叫車、起訖點、隧道／選項、積分抵扣、即時柯打、評分、使用條款 WebView、OneSignal 推播等。</p>
    </div>
    <div style="background:#fff;padding:1.25rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <strong style="color:#7c3aed;display:block;margin-bottom:0.5rem;">司機 App（Android）</strong>
      <p style="margin:0;color:#4b5563;line-height:1.7;font-size:0.95rem;">接單／放柯打、接單範圍、積分充值、後台審批入帳、Google 地圖、柯打推播、文件上傳等。</p>
    </div>
    <div style="background:#fff;padding:1.25rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <strong style="color:#7c3aed;display:block;margin-bottom:0.5rem;">CRM 後台（Web）</strong>
      <p style="margin:0;color:#4b5563;line-height:1.7;font-size:0.95rem;">即時柯打、司機／乘客管理、積分套餐與充值審批、廣告、條款、APK 發佈、叫車選項、系統設定等。</p>
    </div>
  </div>
</section>

<section style="margin-bottom:2.5rem;">
  <h2 style="font-size:1.5rem;color:#111827;margin-bottom:0.5rem;font-weight:700;">CRM 後台界面預覽</h2>
  <p style="color:#6b7280;margin-bottom:1.5rem;line-height:1.7;font-size:1rem;">實際營運後台（Web）：即時柯打、繁忙時段積分、叫車選項、乘客落柯打紀錄等模組，管理員以瀏覽器登入即可操作。</p>
  <div style="display:flex;flex-direction:column;gap:2rem;">
    <figure style="margin:0;background:#fff;padding:1rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <img src="/uploads/taxima-crm-live-orders.png" alt="CRM 即時柯打" style="width:100%;height:auto;border-radius:0.5rem;display:block;" loading="lazy" />
      <figcaption style="margin-top:0.75rem;color:#374151;font-size:0.95rem;font-weight:600;">即時柯打 — WebSocket 連線、待配對訂單、手動指派司機</figcaption>
    </figure>
    <figure style="margin:0;background:#fff;padding:1rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <img src="/uploads/taxima-crm-busy-hours.png" alt="CRM 司機繁忙時段" style="width:100%;height:auto;border-radius:0.5rem;display:block;" loading="lazy" />
      <figcaption style="margin-top:0.75rem;color:#374151;font-size:0.95rem;font-weight:600;">司機繁忙時段 — 基本／獎賞積分、每週時段、分區獎賞設定</figcaption>
    </figure>
    <figure style="margin:0;background:#fff;padding:1rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <img src="/uploads/taxima-crm-booking-options.png" alt="CRM 叫車選項" style="width:100%;height:auto;border-radius:0.5rem;display:block;" loading="lazy" />
      <figcaption style="margin-top:0.75rem;color:#374151;font-size:0.95rem;font-weight:600;">叫車選項 — 隧道、停站、座位、車類、預約時間等中英雙語配置</figcaption>
    </figure>
    <figure style="margin:0;background:#fff;padding:1rem;border-radius:0.75rem;border:1px solid #e5e7eb;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <img src="/uploads/taxima-crm-passenger-orders.png" alt="CRM 乘客落柯打紀錄" style="width:100%;height:auto;border-radius:0.5rem;display:block;" loading="lazy" />
      <figcaption style="margin-top:0.75rem;color:#374151;font-size:0.95rem;font-weight:600;">乘客落柯打紀錄 — 訂單狀態、估價、司機車牌、篩選搜尋</figcaption>
    </figure>
  </div>
</section>

<section style="margin-bottom:2.5rem;padding:2rem;background:#f0fdf4;border-radius:1rem;border:1px solid #bbf7d0;">
  <h2 style="font-size:1.5rem;color:#166534;margin-bottom:1rem;font-weight:700;">AWS 及基礎設施（方案包含）</h2>
  <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:#374151;font-size:1rem;">
    <li><strong>Amazon EC2</strong>：應用主機（API、CRM、Nginx 反向代理）</li>
    <li><strong>Docker Compose</strong>：API（NestJS）、CRM、MySQL 容器化部署</li>
    <li><strong>TLS / 域名</strong>：Let's Encrypt 憑證、HTTPS 強制跳轉</li>
    <li><strong>物件儲存路徑</strong>：上傳檔（APK、廣告圖、充值憑證等）持久化 volume</li>
    <li><strong>Google Maps Platform</strong>：地圖與路線（API Key 限制 package／SHA-1 設定指引）</li>
    <li><strong>Firebase Authentication</strong>：管理員／App OTP 登入整合</li>
    <li><strong>OneSignal</strong>：乘客／司機推播（可選設定）</li>
    <li><strong>UAT / PROD</strong>：分環境部署流程與資料庫 migration 支援</li>
  </ul>
  <p style="margin-top:1rem;color:#4b5563;font-size:0.95rem;">* AWS 資源用量超出基本套餐範圍時，可按實際帳單另議；首次上線含架構建議與部署代辦。</p>
</section>

<section style="margin-bottom:2.5rem;">
  <h2 style="font-size:1.5rem;color:#111827;margin-bottom:1rem;font-weight:700;">月費包含</h2>
  <ul style="line-height:1.85;color:#374151;font-size:1rem;">
    <li>三端軟件使用權（訂閱制，非買斷原始碼）</li>
    <li>雲端主機維運、安全更新與備份建議</li>
    <li>功能迭代與缺陷修復（合理需求範圍內）</li>
    <li>技術支援與上線協助</li>
  </ul>
</section>

<section style="text-align:center;padding:2rem;background:#fff;border-radius:1rem;border:2px solid #7c3aed;">
  <p style="font-size:1.125rem;color:#374151;margin-bottom:1.25rem;">想了解示範環境或安排試用？</p>
  <a href="/contact" style="display:inline-block;background:#7c3aed;color:#fff;padding:0.875rem 2rem;border-radius:0.5rem;font-weight:700;text-decoration:none;">聯絡 CODAI</a>
</section>

</div>
`.trim();

const description =
  '界面與功能對標「飛的」同級；乘客／司機 App + CRM 按月 HK$6,800，含 AWS 部署、地圖推播與維運支援';

const descriptionEn =
  'Passenger & driver apps plus CRM — monthly SaaS (HKD 6,800/mo) with AWS hosting, deployment and ops support';

async function main() {
  const uploadsDir = path.join(appRoot, 'uploads');
  const destFile = path.join(uploadsDir, BANNER_FILENAME);
  const bundledBanner = path.join(appRoot, 'scripts', 'assets', BANNER_FILENAME);
  if (fs.existsSync(bundledBanner)) {
    fs.copyFileSync(bundledBanner, destFile);
    console.log('Installed banner →', IMAGE_DEST);
  } else if (!fs.existsSync(destFile)) {
    console.warn('Banner missing:', bundledBanner, 'and', destFile);
  }

  const conn = await pool.getConnection();
  await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

  const [existing] = await conn.query(
    `SELECT id FROM homepage_items WHERE section = ? AND (id = ? OR title IN (?, ?)) ORDER BY id DESC LIMIT 1`,
    ['services', SERVICE_ID, LEGACY_TITLES[0], LEGACY_TITLES[1]],
  );

  const payload = {
    title: SLUG_TITLE,
    title_en: 'Fly-Tier Taxi Platform SaaS',
    description,
    description_en: descriptionEn,
    icon: null,
    detail_content: detailContent,
    detail_content_en: detailContent,
    image_url: IMAGE_DEST,
    order_index: 6,
  };

  if (existing.length > 0) {
    const id = existing[0].id;
    await conn.query(
      `UPDATE homepage_items SET title=?, title_en=?, description=?, description_en=?,
       detail_content=?, detail_content_en=?, image_url=?, order_index=? WHERE id=?`,
      [
        payload.title,
        payload.title_en,
        payload.description,
        payload.description_en,
        payload.detail_content,
        payload.detail_content_en,
        payload.image_url,
        payload.order_index,
        id,
      ],
    );
    console.log('Updated service id', id, '→', `https://hkcodai.space/service/${id}`);
  } else {
    const [result] = await conn.query(
      `INSERT INTO homepage_items (section, title, title_en, description, description_en, icon, detail_content, detail_content_en, image_url, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'services',
        payload.title,
        payload.title_en,
        payload.description,
        payload.description_en,
        payload.icon,
        payload.detail_content,
        payload.detail_content_en,
        payload.image_url,
        payload.order_index,
      ],
    );
    console.log('Created service id', result.insertId, '→', `https://hkcodai.space/service/${result.insertId}`);
  }

  conn.release();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
