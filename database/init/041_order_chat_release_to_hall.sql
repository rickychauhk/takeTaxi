-- 乘客快捷「我等不了，下位師傅」→ 柯打返回大廳（非取消柯打）

ALTER TABLE passenger_order_chat_quick_replies
  MODIFY action_type ENUM('message', 'cancel_order', 'release_to_hall') NOT NULL DEFAULT 'message';

UPDATE passenger_order_chat_quick_replies
SET action_type = 'release_to_hall'
WHERE label_zh LIKE '%等不了%'
   OR label_zh LIKE '%下位師%';
