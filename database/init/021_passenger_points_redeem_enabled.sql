-- CRM 開關：關閉時乘客 App 不可使用積分抵扣車資
SET NAMES utf8mb4;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('passenger_points_redeem_enabled', '1')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
