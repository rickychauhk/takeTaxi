-- 乘客仍在等候接單（matching/pending）的心跳時間；司機大廳只顯示近期有心跳嘅即時單
ALTER TABLE orders
  ADD COLUMN passenger_matching_watch_at DATETIME NULL
  COMMENT '乘客仍在等候接單的最後心跳'
  AFTER passenger_history_hidden_at;
