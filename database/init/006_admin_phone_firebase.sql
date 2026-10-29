-- CRM login by phone (Firebase OTP) — map to admin_users.phone
ALTER TABLE admin_users
  ADD COLUMN phone VARCHAR(32) NULL UNIQUE AFTER email;

-- UAT default admin phone (Firebase OTP must match E.164):
UPDATE admin_users SET phone = '+85270712526' WHERE email = 'admin@taxima.hk' AND phone IS NULL;

-- CRM login: admin-tier driver for same phone
INSERT INTO drivers (phone, display_name, is_active, driver_tier, verification_status, points_balance)
VALUES ('70712526', 'System Admin', 1, 'admin', 'approved', 0)
ON DUPLICATE KEY UPDATE driver_tier = 'admin', is_active = 1, verification_status = 'approved';
