INSERT INTO system_settings (setting_key, setting_value, updated_by_admin_id)
SELECT
  'passenger_company_price_notice_html',
  '<p><strong>公司價收費</strong></p><ul><li>預估 $94 或以上：85 折</li><li>預估 $80－$93：固定 $80</li><li>預估不足 $80：按 App 預估收費</li></ul><p>附加費（隧道費、行李等）及多站行程另計。請向司機索取收據。</p><p>落單後請致電司機確認價錢，多謝配合 🙏</p>',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'passenger_company_price_notice_html'
);
