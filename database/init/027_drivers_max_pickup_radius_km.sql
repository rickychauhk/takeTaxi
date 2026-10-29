-- 司機 App 接單範圍（3 / 6 / 10 km；NULL = 不限），供背景 OneSignal 派單
ALTER TABLE drivers
  ADD COLUMN max_pickup_radius_km DECIMAL(4, 1) NULL AFTER is_online;
