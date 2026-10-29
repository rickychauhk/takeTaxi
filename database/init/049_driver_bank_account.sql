-- 司機登記：收款銀行及戶口號碼
ALTER TABLE drivers
  ADD COLUMN bank_name VARCHAR(128) NULL AFTER first_registration_date,
  ADD COLUMN bank_account_number VARCHAR(34) NULL AFTER bank_name;
