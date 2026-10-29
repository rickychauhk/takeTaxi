-- Demo data for CRM testing (drivers, passengers, orders, stops, status events)
-- Safe to re-run: uses fixed IDs and INSERT ... ON DUPLICATE KEY UPDATE / IGNORE

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO drivers (id, phone, display_name, is_active, is_internal_member, driver_tier, verification_status, points_balance)
VALUES
  (10001, '90011101', 'Demo 司機陳', 1, 0, 'public', 'approved', 120.00),
  (10002, '90011102', 'Demo 司機李', 1, 1, 'partner', 'approved', 350.50),
  (10003, '90011103', 'Demo 司機王', 1, 0, 'admin', 'approved', 80.00),
  (10004, '90011104', 'Demo 司機張', 1, 0, 'public', 'pending', 0.00),
  (10005, '90011105', 'Demo 司機劉', 1, 0, 'public', 'approved', 200.00)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), verification_status = VALUES(verification_status);

INSERT INTO passengers (id, phone, display_name, is_active)
VALUES
  (20001, '90021101', 'Demo 乘客何', 1),
  (20002, '90021102', 'Demo 乘客林', 1),
  (20003, '90021103', 'Demo 乘客黃', 1),
  (20004, '90021104', 'Demo 乘客周', 1),
  (20005, '90021105', 'Demo 乘客吳', 1),
  (20006, '90021106', 'Demo 乘客鄭', 1),
  (20007, '90021107', 'Demo 乘客梁', 1),
  (20008, '90021108', 'Demo 乘客謝', 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Orders: mix of statuses; created_at UTC (HK = UTC+8)
INSERT INTO orders (id, order_type, passenger_id, driver_id, status, fare_estimate, fare_final, scheduled_at, created_at, updated_at)
VALUES
  (90001, 'instant', 20001, 10001, 'completed', 88.00, 92.00, NULL, '2026-10-01 02:30:00', '2026-10-01 03:10:00'),
  (90002, 'instant', 20002, 10002, 'completed', 65.00, 65.00, NULL, '2026-10-01 06:15:00', '2026-10-01 06:50:00'),
  (90003, 'scheduled', 20003, 10001, 'completed', 120.00, 118.00, '2026-10-02 01:00:00', '2026-10-01 08:00:00', '2026-10-02 02:00:00'),
  (90004, 'instant', 20001, 10003, 'cancelled', 45.00, NULL, NULL, '2026-10-02 03:20:00', '2026-10-02 03:25:00'),
  (90005, 'instant', 20004, 10002, 'in_trip', 72.00, NULL, NULL, '2026-10-03 01:45:00', '2026-10-03 02:30:00'),
  (90006, 'instant', 20005, 10005, 'accepted', 55.00, NULL, NULL, '2026-10-03 05:00:00', '2026-10-03 05:08:00'),
  (90007, 'multi_stop', 20006, 10001, 'completed', 150.00, 155.00, NULL, '2026-10-04 02:00:00', '2026-10-04 03:00:00'),
  (90008, 'instant', 20007, NULL, 'cancelled', 40.00, NULL, NULL, '2026-10-04 06:30:00', '2026-10-04 06:30:00'),
  (90009, 'instant', 20008, 10003, 'en_route', 98.00, NULL, NULL, '2026-10-05 01:10:00', '2026-10-05 01:25:00'),
  (90010, 'instant', 20002, 10002, 'completed', 110.00, 110.00, NULL, '2026-10-05 04:45:00', '2026-10-05 05:30:00'),
  (90011, 'instant', 20003, 10005, 'completed', 76.00, 80.00, NULL, '2026-10-06 02:15:00', '2026-10-06 02:55:00'),
  (90012, 'instant', 20004, 10001, 'completed', 52.00, 52.00, NULL, '2026-10-06 06:00:00', '2026-10-06 06:35:00'),
  (90013, 'instant', 20005, 10002, 'completed', 63.00, 63.00, NULL, '2026-10-07 01:30:00', '2026-10-07 02:05:00'),
  (90014, 'instant', 20006, 10003, 'completed', 89.00, 91.00, NULL, '2026-10-07 05:20:00', '2026-10-07 06:00:00'),
  (90015, 'instant', 20007, 10001, 'completed', 47.00, 47.00, NULL, '2026-10-08 03:00:00', '2026-10-08 03:28:00'),
  (90016, 'instant', 20008, 10005, 'completed', 95.00, 95.00, NULL, '2026-10-08 06:45:00', '2026-10-08 07:25:00'),
  (90017, 'instant', 20001, 10002, 'completed', 58.00, 60.00, NULL, '2026-10-09 02:10:00', '2026-10-09 02:48:00'),
  (90018, 'instant', 20002, 10003, 'completed', 71.00, 71.00, NULL, '2026-10-09 04:30:00', '2026-10-09 05:05:00'),
  (90019, 'instant', 20003, 10001, 'completed', 82.00, 82.00, NULL, '2026-10-09 06:15:00', '2026-10-09 06:50:00'),
  (90020, 'instant', 20004, 10005, 'completed', 66.00, 68.00, NULL, '2026-10-10 01:00:00', '2026-10-10 01:38:00'),
  (90021, 'instant', 20005, 10002, 'completed', 54.00, 54.00, NULL, '2026-10-10 02:30:00', '2026-10-10 03:00:00'),
  (90022, 'instant', 20006, 10001, 'accepted', 49.00, NULL, NULL, '2026-10-10 03:15:00', '2026-10-10 03:20:00'),
  (90023, 'instant', 20007, NULL, 'cancelled', 35.00, NULL, NULL, '2026-10-10 03:45:00', '2026-10-10 03:45:00'),
  (90024, 'instant', 20008, 10003, 'cancelled', 42.00, NULL, NULL, '2026-10-10 04:00:00', '2026-10-10 04:00:00'),
  (90025, 'instant', 20001, 10005, 'completed', 100.00, 102.00, NULL, '2026-10-05 02:30:00', '2026-10-05 03:15:00'),
  (90026, 'instant', 20002, 10001, 'completed', 77.00, 77.00, NULL, '2026-10-06 04:30:00', '2026-10-06 05:05:00'),
  (90027, 'instant', 20003, 10002, 'completed', 61.00, 61.00, NULL, '2026-10-07 03:30:00', '2026-10-07 04:05:00'),
  (90028, 'instant', 20004, 10003, 'completed', 73.00, 75.00, NULL, '2026-10-08 05:30:00', '2026-10-08 06:08:00'),
  (90029, 'instant', 20005, 10001, 'completed', 59.00, 59.00, NULL, '2026-10-09 01:00:00', '2026-10-09 01:35:00'),
  (90030, 'instant', 20006, 10002, 'completed', 84.00, 84.00, NULL, '2026-10-09 03:00:00', '2026-10-09 03:40:00'),
  (90031, 'instant', 20007, 10005, 'completed', 91.00, 93.00, NULL, '2026-10-10 01:30:00', '2026-10-10 02:10:00'),
  (90032, 'instant', 20008, 10001, 'completed', 67.00, 67.00, NULL, '2026-10-10 02:00:00', '2026-10-10 02:35:00'),
  (90033, 'instant', 20001, 10003, 'completed', 56.00, 56.00, NULL, '2026-10-03 02:30:00', '2026-10-03 03:00:00'),
  (90034, 'instant', 20002, 10005, 'completed', 48.00, 50.00, NULL, '2026-10-04 04:00:00', '2026-10-04 04:32:00'),
  (90035, 'instant', 20003, NULL, 'cancelled', 38.00, NULL, NULL, '2026-10-08 01:00:00', '2026-10-08 01:00:00'),
  (90036, 'instant', 20004, 10002, 'completed', 69.00, 69.00, NULL, '2026-10-02 05:30:00', '2026-10-02 06:05:00'),
  (90037, 'instant', 20005, 10001, 'completed', 74.00, 74.00, NULL, '2026-10-01 04:00:00', '2026-10-01 04:38:00'),
  (90038, 'instant', 20006, 10003, 'completed', 86.00, 88.00, NULL, '2026-10-02 01:15:00', '2026-10-02 01:55:00'),
  (90039, 'instant', 20007, 10002, 'completed', 53.00, 53.00, NULL, '2026-10-03 06:00:00', '2026-10-03 06:30:00'),
  (90040, 'instant', 20008, 10005, 'completed', 79.00, 79.00, NULL, '2026-10-04 01:30:00', '2026-10-04 02:05:00'),
  (90041, 'instant', 20001, 10002, 'completed', 62.00, 62.00, NULL, '2026-10-05 06:00:00', '2026-10-05 06:35:00'),
  (90042, 'instant', 20002, 10001, 'completed', 57.00, 57.00, NULL, '2026-10-06 01:00:00', '2026-10-06 01:32:00'),
  (90043, 'instant', 20003, 10005, 'completed', 81.00, 83.00, NULL, '2026-10-07 06:00:00', '2026-10-07 06:42:00'),
  (90044, 'instant', 20004, 10001, 'completed', 44.00, 44.00, NULL, '2026-10-08 02:30:00', '2026-10-08 03:00:00'),
  (90045, 'instant', 20005, 10003, 'completed', 70.00, 70.00, NULL, '2026-10-09 05:00:00', '2026-10-09 05:35:00')
ON DUPLICATE KEY UPDATE status = VALUES(status), driver_id = VALUES(driver_id);

DELETE FROM order_stops WHERE order_id BETWEEN 90001 AND 90045;
DELETE FROM order_status_events WHERE order_id BETWEEN 90001 AND 90045;

INSERT INTO order_stops (order_id, seq, address_text, lat, lng) VALUES
  (90001, 0, '香港中環站', 22.2819000, 114.1582000),
  (90001, 1, '尖沙咀鐘樓', 22.2938000, 114.1694000),
  (90002, 0, '銅鑼灣時代廣場', 22.2783000, 114.1828000),
  (90002, 1, '灣仔會展', 22.2833000, 114.1731000),
  (90003, 0, '機場 T1', 22.3089000, 113.9146000),
  (90003, 1, '九龍塘', 22.3372000, 114.1764000),
  (90020, 0, '旺角朗豪坊', 22.3186000, 114.1699000),
  (90020, 1, '深水埗', 22.3308000, 114.1628000),
  (90021, 0, '沙田新城市', 22.3819000, 114.1886000),
  (90021, 1, '大圍', 22.3728000, 114.1786000);

INSERT INTO order_stops (order_id, seq, address_text, lat, lng)
SELECT o.id, 0, CONCAT('Demo 上車點 #', o.id), 22.3000000 + (o.id % 100) * 0.0001000, 114.1500000 + (o.id % 100) * 0.0001000
FROM orders o
WHERE o.id BETWEEN 90001 AND 90045
  AND NOT EXISTS (SELECT 1 FROM order_stops s WHERE s.order_id = o.id AND s.seq = 0);

INSERT INTO order_stops (order_id, seq, address_text, lat, lng)
SELECT o.id, 1, CONCAT('Demo 落車點 #', o.id), 22.3100000 + (o.id % 100) * 0.0001000, 114.1600000 + (o.id % 100) * 0.0001000
FROM orders o
WHERE o.id BETWEEN 90001 AND 90045
  AND o.driver_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM order_stops s WHERE s.order_id = o.id AND s.seq = 1);

INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, created_at)
SELECT o.id, 'matching', 'accepted', 'driver', o.driver_id, DATE_ADD(o.created_at, INTERVAL 5 MINUTE)
FROM orders o
WHERE o.id BETWEEN 90001 AND 90045 AND o.driver_id IS NOT NULL;

INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, created_at)
SELECT o.id, 'accepted', 'completed', 'system', NULL, o.updated_at
FROM orders o
WHERE o.id BETWEEN 90001 AND 90045 AND o.status = 'completed';

INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, created_at)
SELECT o.id, 'pending', 'matching', 'system', NULL, o.created_at
FROM orders o
WHERE o.id BETWEEN 90001 AND 90045;

-- Sample splash ad (optional)
INSERT INTO advertisements (id, target_app, placement, image_path, html_content, sort_order, status)
VALUES (
  9001, 'both', 'splash', NULL,
  '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Demo</title></head><body><h1>Demo 廣告 WebView</h1><p>測試用 HTML 內容。</p></body></html>',
  0, 'paused'
)
ON DUPLICATE KEY UPDATE html_content = VALUES(html_content);

INSERT INTO ratings (order_id, direction, passenger_id, driver_id, score, comment)
VALUES
  (90001, 'passenger_to_driver', 20001, 10001, 4.5, 'Demo：乘客評司機'),
  (90001, 'driver_to_passenger', 20001, 10001, 5.0, 'Demo：司機評乘客'),
  (90002, 'passenger_to_driver', 20002, 10002, 3.5, NULL)
ON DUPLICATE KEY UPDATE score = VALUES(score), comment = VALUES(comment);
