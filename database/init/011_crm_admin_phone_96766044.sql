-- CRM 可有多個 admin：每人 = drivers.driver_tier='admin' + admin_users.phone 綁定同一電話
SET NAMES utf8mb4;

-- 主帳 admin@taxima.hk → 70712526（還原若曾被改成其他號碼）
UPDATE admin_users
SET phone = '+85270712526', is_active = 1
WHERE email = 'admin@taxima.hk';

INSERT INTO admin_users (email, phone, password_hash, display_name, role, is_active)
SELECT
  'crm96766044@taxima.hk',
  '+85296766044',
  '$2b$10$L1mKhuch6iAd7QTmDWqo.uhoi5SZRBCrOf5td.UeZba35jtLJCFIa',
  'CRM Admin',
  'super_admin',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE phone = '+85296766044' OR email = 'crm96766044@taxima.hk'
);

UPDATE admin_users
SET phone = '+85296766044', is_active = 1, display_name = 'CRM Admin'
WHERE email = 'crm96766044@taxima.hk';

INSERT INTO drivers (phone, display_name, is_active, driver_tier, verification_status, points_balance)
VALUES ('70712526', 'System Admin', 1, 'admin', 'approved', 0)
ON DUPLICATE KEY UPDATE
  driver_tier = 'admin',
  is_active = 1,
  verification_status = 'approved';

INSERT INTO drivers (phone, display_name, is_active, driver_tier, verification_status, points_balance)
VALUES ('96766044', 'CRM Admin', 1, 'admin', 'approved', 0)
ON DUPLICATE KEY UPDATE
  driver_tier = 'admin',
  is_active = 1,
  verification_status = 'approved';
