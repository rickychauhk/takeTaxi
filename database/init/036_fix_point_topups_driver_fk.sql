-- Legacy DB: point_topups.driver_id still referenced dropped `users` table.
-- Repoint to drivers(id) so driver app top-up submissions succeed.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE point_topups
  DROP FOREIGN KEY point_topups_ibfk_1;

ALTER TABLE point_topups
  ADD CONSTRAINT fk_point_topups_driver
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
