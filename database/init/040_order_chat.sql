-- 乘客行程快捷訊息（CRM 管理）與司機↔乘客即時對話（柯打完結後刪除）

CREATE TABLE IF NOT EXISTS passenger_order_chat_quick_replies (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  label_zh VARCHAR(255) NOT NULL,
  label_en VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  action_type ENUM('message', 'cancel_order', 'release_to_hall') NOT NULL DEFAULT 'message',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO passenger_order_chat_quick_replies (label_zh, label_en, sort_order, action_type)
SELECT * FROM (
  SELECT '無問題' AS label_zh, 'No problem' AS label_en, 10 AS sort_order, 'message' AS action_type
  UNION ALL SELECT '無問題，請打電話給我', 'No problem, please call me', 20, 'message'
  UNION ALL SELECT '我等不了，下位師父', 'Cannot wait, next driver please', 30, 'release_to_hall'
  UNION ALL SELECT '請先致電給我', 'Please call me first', 40, 'message'
  UNION ALL SELECT '取消柯打', 'Cancel order', 50, 'cancel_order'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM passenger_order_chat_quick_replies LIMIT 1);

CREATE TABLE IF NOT EXISTS order_chat_messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  sender_role ENUM('passenger', 'driver') NOT NULL,
  body TEXT NOT NULL,
  passenger_read_at TIMESTAMP NULL DEFAULT NULL,
  driver_read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_chat_order_id (order_id),
  INDEX idx_order_chat_created (created_at),
  CONSTRAINT fk_order_chat_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
