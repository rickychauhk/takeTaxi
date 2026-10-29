SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS driver_point_packages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  points INT NOT NULL,
  price_hkd DECIMAL(12, 2) NOT NULL,
  label VARCHAR(128) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT chk_driver_point_packages_points CHECK (points > 0),
  CONSTRAINT chk_driver_point_packages_price CHECK (price_hkd >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE point_topups
  ADD COLUMN package_id BIGINT NULL AFTER amount_points,
  ADD COLUMN price_hkd DECIMAL(12, 2) NULL AFTER package_id;

INSERT INTO driver_point_packages (points, price_hkd, label, sort_order, is_active)
SELECT 100, 100.00, '100 積分', 10, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM driver_point_packages LIMIT 1);

INSERT INTO driver_point_packages (points, price_hkd, label, sort_order, is_active)
SELECT 500, 450.00, '500 積分', 20, 1 FROM DUAL
WHERE (SELECT COUNT(*) FROM driver_point_packages) < 2;

INSERT INTO driver_point_packages (points, price_hkd, label, sort_order, is_active)
SELECT 1000, 850.00, '1000 積分', 30, 1 FROM DUAL
WHERE (SELECT COUNT(*) FROM driver_point_packages) < 3;
