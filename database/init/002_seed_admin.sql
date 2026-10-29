-- Default admin: admin@taxima.hk / ChangeMe123!  (bcrypt cost 10)
INSERT INTO admin_users (email, password_hash, display_name, role)
SELECT 'admin@taxima.hk', '$2b$10$L1mKhuch6iAd7QTmDWqo.uhoi5SZRBCrOf5td.UeZba35jtLJCFIa', 'System Admin', 'super_admin'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'admin@taxima.hk');
