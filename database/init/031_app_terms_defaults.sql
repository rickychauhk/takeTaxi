SET NAMES utf8mb4;

INSERT INTO system_settings (setting_key, setting_value, updated_by_admin_id)
SELECT
  'terms_driver_html',
  '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;line-height:1.6;margin:0;color:#222;}img{max-width:100%;height:auto;}</style></head><body><h1>搭的 · 司機版使用條款</h1><p>使用本 App 即表示你同意以下條款。</p><ol><li>你須為 CRM 登記之有效司機，並保持帳戶及車輛資料正確。</li><li>接單後須依平台流程完成行程；已接柯打不可由司機自行取消。</li><li>接單、懸賞及繁忙時段等積分規則以後台設定為準。</li></ol></body></html>',
  NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'terms_driver_html');

INSERT INTO system_settings (setting_key, setting_value, updated_by_admin_id)
SELECT
  'terms_passenger_html',
  '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;line-height:1.6;margin:0;color:#222;}img{max-width:100%;height:auto;}</style></head><body><h1>搭的 · 乘客版使用條款</h1><p>使用本 App 即表示你同意以下條款。</p><ol><li>你須提供真實聯絡電話以完成叫車及帳戶驗證。</li><li>請準時於上車點等候；惡意取消或濫用平台可能導致帳戶受限。</li><li>行程費用、積分抵扣及優惠以 App 及後台設定為準。</li></ol></body></html>',
  NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'terms_passenger_html');
