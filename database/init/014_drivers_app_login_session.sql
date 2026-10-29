-- 司機 App：Firebase OTP 登入 session（同裝置 re-OTP 不踢線；logout／換機 bump version）
ALTER TABLE drivers
  ADD COLUMN session_version INT NOT NULL DEFAULT 0 AFTER is_online,
  ADD COLUMN last_login_device_id VARCHAR(64) NULL AFTER session_version;
