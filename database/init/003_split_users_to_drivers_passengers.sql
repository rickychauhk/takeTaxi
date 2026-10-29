-- Run once on existing UAT DB that still has `users` + `driver_profiles`
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(128) NULL,
  password_hash VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_internal_member TINYINT(1) NOT NULL DEFAULT 0,
  driver_tier ENUM('admin','partner','public') NOT NULL DEFAULT 'public',
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  license_number VARCHAR(64) NULL,
  vehicle_plate VARCHAR(32) NULL,
  points_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_drivers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS passengers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(128) NULL,
  password_hash VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_passengers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO drivers (
  id, phone, email, display_name, password_hash, is_active, is_internal_member, driver_tier,
  verification_status, created_at, updated_at
)
SELECT
  u.id, u.phone, u.email, u.display_name, u.password_hash, u.is_active, u.is_internal_member,
  u.driver_tier, COALESCE(u.verification_status, 'pending'), u.created_at, u.updated_at
FROM users u
WHERE u.role = 'driver';

INSERT IGNORE INTO passengers (
  id, phone, email, display_name, password_hash, is_active, created_at, updated_at
)
SELECT u.id, u.phone, u.email, u.display_name, u.password_hash, u.is_active, u.created_at, u.updated_at
FROM users u
WHERE u.role = 'passenger';

UPDATE drivers d
INNER JOIN driver_profiles p ON p.user_id = d.id
SET
  d.license_number = p.license_number,
  d.vehicle_plate = p.vehicle_plate,
  d.points_balance = p.points_balance,
  d.is_online = p.is_online;

-- document_uploads: user_id -> driver_id (documents are driver-only)
ALTER TABLE document_uploads CHANGE COLUMN user_id driver_id BIGINT NOT NULL;

-- live_locations: split user_id + role into driver_id / passenger_id
CREATE TABLE IF NOT EXISTS live_locations_new (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  driver_id BIGINT NULL,
  passenger_id BIGINT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  location POINT NOT NULL SRID 4326,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_live_location_point (location),
  UNIQUE KEY uk_live_driver (driver_id),
  UNIQUE KEY uk_live_passenger (passenger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO live_locations_new (driver_id, passenger_id, lat, lng, location, updated_at)
SELECT
  CASE WHEN ll.role = 'driver' THEN ll.user_id ELSE NULL END,
  CASE WHEN ll.role = 'passenger' THEN ll.user_id ELSE NULL END,
  ll.lat, ll.lng, ll.location, ll.updated_at
FROM live_locations ll;

DROP TABLE live_locations;
RENAME TABLE live_locations_new TO live_locations;

ALTER TABLE live_locations
  ADD CONSTRAINT fk_live_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_live_passenger FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE;

DROP TABLE IF EXISTS driver_profiles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;
