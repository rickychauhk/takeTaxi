-- 司機 App 自助登記欄位
ALTER TABLE drivers
  ADD COLUMN off_duty_phone VARCHAR(32) NULL AFTER phone,
  ADD COLUMN vehicle_plate_expiry DATE NULL AFTER vehicle_plate,
  ADD COLUMN vehicle_model VARCHAR(64) NULL AFTER vehicle_plate_expiry,
  ADD COLUMN first_registration_date DATE NULL AFTER vehicle_model;
