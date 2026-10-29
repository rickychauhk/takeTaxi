-- CRM 訊息中心：受眾與 Push 結果
ALTER TABLE messages
  ADD COLUMN audience ENUM('all_drivers','all_passengers','all_members','phones') NOT NULL DEFAULT 'all_drivers' AFTER scope,
  ADD COLUMN target_phones TEXT NULL AFTER audience,
  ADD COLUMN phone_app_target ENUM('driver','passenger','both') NULL AFTER target_phones,
  ADD COLUMN push_recipient_count INT NULL AFTER delivery_status,
  ADD COLUMN push_detail TEXT NULL AFTER push_recipient_count;
