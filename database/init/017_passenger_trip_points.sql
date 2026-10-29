-- 乘客完成行程：依公里數賺積分（CRM 設定每公里積分，預設 0）
SET NAMES utf8mb4;

ALTER TABLE passengers
  ADD COLUMN points_balance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE orders
  ADD COLUMN trip_distance_km DECIMAL(10,3) NULL AFTER fare_final,
  ADD COLUMN passenger_points_awarded DECIMAL(12,2) NULL AFTER trip_distance_km;

CREATE TABLE IF NOT EXISTS passenger_point_ledger (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  passenger_id BIGINT NOT NULL,
  delta_points DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  ref_type VARCHAR(64) NULL,
  ref_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
  UNIQUE KEY uk_passenger_ledger_order_trip (ref_type, ref_id),
  INDEX idx_passenger_ledger (passenger_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('passenger_points_per_km', '0')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
