-- 預約柯打 push 提醒（T-30 / T-15 / T-5）防重
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS order_scheduled_reminder_sent (
  order_id BIGINT NOT NULL,
  minutes_before INT NOT NULL,
  sent_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (order_id, minutes_before),
  CONSTRAINT fk_order_scheduled_reminder_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
