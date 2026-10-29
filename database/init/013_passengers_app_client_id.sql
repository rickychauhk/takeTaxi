-- 乘客 App 以裝置 client ID 識別，電話改為可選（CRM 不再必填）
ALTER TABLE passengers
  ADD COLUMN app_client_id VARCHAR(64) NULL AFTER id,
  ADD UNIQUE KEY uk_passengers_app_client_id (app_client_id);

ALTER TABLE passengers
  MODIFY phone VARCHAR(32) NULL;
