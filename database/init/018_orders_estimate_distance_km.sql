-- 乘客積分：以叫車時預估駕駛路程公里計算（非直線距離）
SET NAMES utf8mb4;

ALTER TABLE orders
  ADD COLUMN estimate_distance_km DECIMAL(10,3) NULL AFTER fare_estimate;
