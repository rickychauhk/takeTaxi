ALTER TABLE admin_users
  ADD COLUMN last_login_device_id VARCHAR(64) NULL AFTER session_version;
