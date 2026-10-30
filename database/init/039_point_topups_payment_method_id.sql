-- 司機積分充值：記錄所選 CRM 付款方式 id（FPS／銀行入數等）

ALTER TABLE point_topups
  ADD COLUMN payment_method_id VARCHAR(64) NULL AFTER bank_name;
