-- 擴展乘客自動貼士 CRM 設定（安全駕駛、五座、大行李）
SET NAMES utf8mb4;

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('passenger_tip_hkd_safe_driving', '10'),
  ('passenger_tip_hkd_five_seat', '10'),
  ('passenger_tip_hkd_large_luggage', '10')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
