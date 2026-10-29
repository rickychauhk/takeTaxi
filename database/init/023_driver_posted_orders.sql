-- 司機射柯打：發單司機、懸賞積分
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN posted_by_driver_id BIGINT NULL COMMENT '射柯打發單司機' AFTER driver_id,
  ADD COLUMN driver_post_bounty_points DECIMAL(12,2) NULL COMMENT '射柯打懸賞積分(0/3/5/8/12)' AFTER driver_points_busy_surcharge;

ALTER TABLE orders
  ADD INDEX idx_orders_posted_by (posted_by_driver_id);
