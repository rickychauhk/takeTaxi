-- CRM 停用司機：限期（suspended_until）或永久（suspended_permanent）
ALTER TABLE drivers
  ADD COLUMN suspended_permanent TINYINT(1) NOT NULL DEFAULT 0 AFTER is_online,
  ADD COLUMN suspended_until DATETIME NULL AFTER suspended_permanent,
  ADD COLUMN suspended_reason VARCHAR(255) NULL AFTER suspended_until,
  ADD INDEX idx_drivers_suspended_until (suspended_until);
