-- 乘客 App「刪除」叫車紀錄：只隱藏，CRM / 後台訂單不受影響
ALTER TABLE orders
  ADD COLUMN passenger_history_hidden_at DATETIME NULL AFTER updated_at;
