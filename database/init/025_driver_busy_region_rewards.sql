-- 繁忙時段地區配對獎賞積分（接單時發放）
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN driver_busy_region_reward_points DECIMAL(12,2) NULL COMMENT '接單獎賞：地區配對積分' AFTER driver_post_bounty_points,
  ADD COLUMN driver_busy_region_from_area VARCHAR(64) NULL COMMENT '獎賞配對起點地區' AFTER driver_busy_region_reward_points,
  ADD COLUMN driver_busy_region_to_area VARCHAR(64) NULL COMMENT '獎賞配對終點地區' AFTER driver_busy_region_from_area;

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('driver_busy_region_rewards_json', '{"enabled":true,"rules":[]}')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
