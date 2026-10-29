-- UAT legacy: driver_point_ledger.driver_id still referenced dropped `users` table.
-- Repoint to drivers(id) so CRM admin adjust / topups / order debits can insert ledger rows.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE driver_point_ledger
  DROP FOREIGN KEY driver_point_ledger_ibfk_1;

ALTER TABLE driver_point_ledger
  ADD CONSTRAINT fk_driver_point_ledger_driver
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
