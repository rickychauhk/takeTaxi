-- Trip-linked ratings: passenger→driver and driver→passenger (score 1.0–5.0)
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS ratings;

CREATE TABLE ratings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  direction ENUM('passenger_to_driver', 'driver_to_passenger') NOT NULL,
  passenger_id BIGINT NOT NULL,
  driver_id BIGINT NOT NULL,
  score DECIMAL(2,1) NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rating_order_direction (order_id, direction),
  CONSTRAINT chk_rating_score CHECK (score >= 1.0 AND score <= 5.0),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_ratings_order (order_id),
  INDEX idx_ratings_driver (driver_id),
  INDEX idx_ratings_passenger (passenger_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
