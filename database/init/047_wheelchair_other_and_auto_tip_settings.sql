-- 「其他」分類加入輪椅；預設 CRM 自動貼士金額（可在 CRM 修改）
SET NAMES utf8mb4;

INSERT INTO booking_options (category_id, code, label_zh, label_en, icon_key, sort_order)
SELECT c.id, 'wheelchair_other', '輪椅', 'Wheelchair', NULL, 50
FROM booking_option_categories c
WHERE c.code = 'other'
ON DUPLICATE KEY UPDATE
  label_zh = VALUES(label_zh),
  label_en = VALUES(label_en),
  sort_order = VALUES(sort_order),
  is_active = 1;

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('passenger_tip_hkd_wheelchair', '10'),
  ('passenger_tip_hkd_six_seat', '10')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
