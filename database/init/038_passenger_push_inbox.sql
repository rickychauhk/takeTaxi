-- Per-passenger inbox: every OneSignal push sent via API (CRM messages) is recorded here.

CREATE TABLE IF NOT EXISTS passenger_push_inbox (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  passenger_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  crm_message_id BIGINT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_passenger_push_inbox_passenger_created (passenger_id, created_at),
  KEY idx_passenger_push_inbox_crm (crm_message_id),
  CONSTRAINT fk_passenger_push_inbox_passenger
    FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
  CONSTRAINT fk_passenger_push_inbox_crm_message
    FOREIGN KEY (crm_message_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
