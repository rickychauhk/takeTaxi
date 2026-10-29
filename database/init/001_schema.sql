-- Taxima core schema (MySQL 8.0+)
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(128) NOT NULL UNIQUE,
  setting_value LONGTEXT NULL,
  updated_by_admin_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role ENUM('super_admin','operator','finance','support') NOT NULL DEFAULT 'operator',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  session_version INT NOT NULL DEFAULT 0,
  last_login_device_id VARCHAR(64) NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_type ENUM('admin','system','driver','passenger') NOT NULL,
  actor_id INT NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NULL,
  resource_id VARCHAR(64) NULL,
  payload JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_type, actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(128) NULL,
  password_hash VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_internal_member TINYINT(1) NOT NULL DEFAULT 0 COMMENT '自己人',
  driver_tier ENUM('admin','partner','public') NOT NULL DEFAULT 'public',
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  license_number VARCHAR(64) NULL,
  vehicle_plate VARCHAR(32) NULL,
  points_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_drivers_phone (phone),
  INDEX idx_drivers_internal (is_internal_member)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS passengers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_client_id VARCHAR(64) NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(128) NULL,
  password_hash VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_passengers_app_client_id (app_client_id),
  UNIQUE KEY uk_passengers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS device_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NULL,
  passenger_id BIGINT NULL,
  platform ENUM('ios','android','web') NOT NULL,
  push_token VARCHAR(512) NULL,
  auth_token_hash VARCHAR(255) NULL COMMENT 'single device login binding',
  last_seen_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_device_driver_platform (driver_id, platform),
  UNIQUE KEY uk_device_passenger_platform (passenger_id, platform),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_uploads (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NOT NULL,
  doc_type ENUM('driving_license','driver_id','vehicle_registration','other') NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id INT NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS passenger_habit_locations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  passenger_id BIGINT NOT NULL,
  label VARCHAR(128) NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  usage_count INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP NULL,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
  INDEX idx_habit_passenger (passenger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS live_locations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NULL,
  passenger_id BIGINT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  heading DECIMAL(6,2) NULL,
  speed_kmh DECIMAL(6,2) NULL,
  location POINT NOT NULL SRID 4326,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_live_location_point (location),
  UNIQUE KEY uk_live_driver (driver_id),
  UNIQUE KEY uk_live_passenger (passenger_id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS point_topups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NOT NULL,
  amount_points DECIMAL(12,2) NOT NULL,
  receipt_image_path VARCHAR(512) NOT NULL,
  bank_name VARCHAR(128) NULL,
  transfer_at DATETIME NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id INT NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS driver_point_ledger (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NOT NULL,
  delta_points DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  ref_type VARCHAR(64) NULL,
  ref_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_ledger_driver (driver_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedbacks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sender_name VARCHAR(128) NOT NULL,
  sender_phone VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  user_id BIGINT NULL,
  status ENUM('new','in_progress','closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scope ENUM('broadcast','direct') NOT NULL,
  target_user_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  sent_by_admin_id INT NULL,
  delivery_status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_scope (scope, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promo_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  marks_internal_member TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  valid_from DATETIME NULL,
  valid_to DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  promo_code_id INT NOT NULL,
  driver_id BIGINT NOT NULL,
  redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_promo_driver (promo_code_id, driver_id),
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS advertisements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  target_app ENUM('passenger','driver','both') NOT NULL,
  placement ENUM('splash','banner') NOT NULL DEFAULT 'splash',
  image_path VARCHAR(512) NULL,
  html_content LONGTEXT NULL COMMENT 'App WebView when user taps ad',
  link_url VARCHAR(512) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  max_concurrent_driver INT NOT NULL DEFAULT 3,
  status ENUM('active','paused','removed') NOT NULL DEFAULT 'active',
  impression_count BIGINT NOT NULL DEFAULT 0,
  click_count BIGINT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_type ENUM('instant','scheduled','multi_stop','blind_box','driver_posted') NOT NULL DEFAULT 'instant',
  passenger_id BIGINT NULL,
  driver_id BIGINT NULL,
  status ENUM('pending','matching','accepted','en_route','in_trip','completed','cancelled') NOT NULL DEFAULT 'pending',
  blind_destination_hidden TINYINT(1) NOT NULL DEFAULT 0,
  fare_estimate DECIMAL(12,2) NULL,
  fare_final DECIMAL(12,2) NULL,
  scheduled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_stops (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  seq INT NOT NULL,
  address_text VARCHAR(512) NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE KEY uk_order_seq (order_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_status_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  actor_type ENUM('admin','driver','passenger','system') NOT NULL,
  actor_id BIGINT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_events (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ratings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  direction ENUM('passenger_to_driver', 'driver_to_passenger') NOT NULL,
  passenger_id BIGINT NOT NULL,
  driver_id BIGINT NOT NULL,
  score DECIMAL(2,1) NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rating_order_direction (order_id, direction),
  CONSTRAINT chk_rating_score CHECK (score >= 1.0 AND score <= 5.0),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_ratings_order (order_id),
  INDEX idx_ratings_driver (driver_id),
  INDEX idx_ratings_passenger (passenger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NULL,
  provider ENUM('stripe','paypal','manual') NOT NULL,
  provider_ref VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'HKD',
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_provider (provider, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('contact_us_html', '<h1>聯絡我們</h1><p>請電郵 support@taxima.hk</p>'),
  ('news_url', 'https://taxima.hkcodai.space/news')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
