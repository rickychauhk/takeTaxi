-- 即時派單板／司機 App 只顯示乘客 App 落嘅柯打：清走 demo 同 admin 測試 matching 單
SET NAMES utf8mb4;

UPDATE orders o
SET
  o.status = 'cancelled',
  o.updated_at = UTC_TIMESTAMP()
WHERE o.status IN ('pending', 'matching')
  AND (
    o.id BETWEEN 90001 AND 90045
    OR o.passenger_id BETWEEN 20001 AND 20008
    OR NOT EXISTS (
      SELECT 1
      FROM order_status_events e
      WHERE e.order_id = o.id
        AND e.to_status = 'matching'
        AND e.actor_type = 'passenger'
    )
    OR (
      SELECT COUNT(*) FROM order_stops s WHERE s.order_id = o.id
    ) < 2
  );
