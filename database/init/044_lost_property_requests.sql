-- 乘客失物協助（大廳走馬燈 20 分鐘）
CREATE TABLE IF NOT EXISTS lost_property_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  passenger_id VARCHAR(36) NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  lost_at DATETIME NOT NULL,
  image_paths JSON NULL,
  contact_phone VARCHAR(32) NOT NULL,
  contact_name VARCHAR(80) NOT NULL,
  status ENUM('active', 'expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  expired_notified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lost_property_active (status, expires_at),
  INDEX idx_lost_property_passenger (passenger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
