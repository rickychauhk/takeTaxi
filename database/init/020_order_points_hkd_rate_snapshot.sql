-- 落單時鎖定積分兌換 HKD 比率（供紀錄顯示）
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN passenger_points_hkd_per_point_at_order DECIMAL(12,2) NULL AFTER passenger_points_discount_hkd;
