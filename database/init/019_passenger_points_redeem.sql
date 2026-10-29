-- 乘客落柯打使用積分抵扣車資（CRM 設定每積分兌換 HKD，預設 1）
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN passenger_points_redeemed DECIMAL(12,2) NULL AFTER passenger_points_awarded,
  ADD COLUMN passenger_points_discount_hkd DECIMAL(12,2) NULL AFTER passenger_points_redeemed;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('passenger_points_hkd_per_point', '1')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
