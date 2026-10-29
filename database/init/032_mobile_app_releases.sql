SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS mobile_app_releases (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  app ENUM('passenger', 'driver') NOT NULL,
  version VARCHAR(64) NOT NULL,
  release_notes TEXT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_by_admin_id INT NULL,
  is_active_uat TINYINT(1) NOT NULL DEFAULT 0,
  is_active_prod TINYINT(1) NOT NULL DEFAULT 0,
  deployed_uat_at DATETIME(6) NULL,
  deployed_prod_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_mobile_app_releases_app_created (app, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
