-- 司機 App：每次更換車牌時保留以往車牌，供設定頁快速選回
CREATE TABLE IF NOT EXISTS driver_vehicle_plate_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  driver_id BIGINT NOT NULL,
  vehicle_plate VARCHAR(32) NOT NULL,
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_driver_vehicle_plate_history_driver (driver_id),
  KEY idx_driver_vehicle_plate_history_driver_plate (driver_id, vehicle_plate),
  CONSTRAINT fk_driver_vehicle_plate_history_driver
    FOREIGN KEY (driver_id) REFERENCES drivers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
