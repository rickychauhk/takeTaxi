-- Legacy DB: driver_id FK still pointed at dropped `users` after 003 migration.
-- Fixes driver document upload + promo code (自己人) redemption on register.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE document_uploads
  DROP FOREIGN KEY document_uploads_ibfk_1;

ALTER TABLE document_uploads
  ADD CONSTRAINT fk_document_uploads_driver
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;

ALTER TABLE promo_code_redemptions
  DROP FOREIGN KEY promo_code_redemptions_ibfk_2;

ALTER TABLE promo_code_redemptions
  ADD CONSTRAINT fk_promo_redemptions_driver
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
