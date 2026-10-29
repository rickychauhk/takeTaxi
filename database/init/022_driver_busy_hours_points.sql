-- 司機接單積分：繁忙時段（香港時間）額外加收
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN driver_points_cost_at_order DECIMAL(12,2) NULL COMMENT '落單時快照：接單所需積分',
  ADD COLUMN driver_points_busy_surcharge DECIMAL(12,2) NULL COMMENT '落單時快照：繁忙時段加收';

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('driver_points_per_order', '0'),
  ('driver_busy_extra_points_per_order', '0'),
  (
    'driver_busy_hours_json',
    '{"enabled":true,"weekdays":{"1":[],"2":[],"3":[],"4":[],"5":[],"6":[],"7":[]}}'
  )
ON DUPLICATE KEY UPDATE setting_key = setting_key;
