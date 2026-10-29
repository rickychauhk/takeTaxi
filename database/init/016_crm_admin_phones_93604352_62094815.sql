-- CRM 最高管理員：93604352、62094815（drivers.admin + admin_users.super_admin）
SET NAMES utf8mb4;

INSERT INTO admin_users (email, phone, password_hash, display_name, role, is_active)
SELECT
  'crm93604352@taxima.hk',
  '+85293604352',
  '$2b$10$L1mKhuch6iAd7QTmDWqo.uhoi5SZRBCrOf5td.UeZba35jtLJCFIa',
  'CRM Super Admin',
  'super_admin',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE phone = '+85293604352' OR email = 'crm93604352@taxima.hk'
);

UPDATE admin_users
SET phone = '+85293604352', is_active = 1, role = 'super_admin', display_name = 'CRM Super Admin'
WHERE email = 'crm93604352@taxima.hk';

INSERT INTO admin_users (email, phone, password_hash, display_name, role, is_active)
SELECT
  'crm62094815@taxima.hk',
  '+85262094815',
  '$2b$10$L1mKhuch6iAd7QTmDWqo.uhoi5SZRBCrOf5td.UeZba35jtLJCFIa',
  'CRM Super Admin',
  'super_admin',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE phone = '+85262094815' OR email = 'crm62094815@taxima.hk'
);

UPDATE admin_users
SET phone = '+85262094815', is_active = 1, role = 'super_admin', display_name = 'CRM Super Admin'
WHERE email = 'crm62094815@taxima.hk';

INSERT INTO drivers (phone, display_name, is_active, driver_tier, verification_status, points_balance)
VALUES ('93604352', 'CRM Super Admin', 1, 'admin', 'approved', 0)
ON DUPLICATE KEY UPDATE
  driver_tier = 'admin',
  is_active = 1,
  verification_status = 'approved';

INSERT INTO drivers (phone, display_name, is_active, driver_tier, verification_status, points_balance)
VALUES ('62094815', 'CRM Super Admin', 1, 'admin', 'approved', 0)
ON DUPLICATE KEY UPDATE
  driver_tier = 'admin',
  is_active = 1,
  verification_status = 'approved';
