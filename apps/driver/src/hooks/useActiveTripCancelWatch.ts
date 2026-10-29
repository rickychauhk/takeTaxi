import { useCallback, useEffect, useRef, useState } from 'react';

/** 行程 track 回傳 cancelled 時顯示取消通知（約每 2.5s 輪詢 track API） */
export function useActiveTripCancelWatch(
  orderId: string | undefined,
  orderStatus: string | null | undefined,
) {
  const [cancelledVisible, setCancelledVisible] = useState(false);
  const firedForOrderRef = useRef<string | null>(null);

  const showCancelledNotice = useCallback((id: string) => {
    firedForOrderRef.current = id;
    setCancelledVisible(true);
  }, []);

  useEffect(() => {
    if (!orderId || orderStatus !== 'cancelled') return;
    showCancelledNotice(orderId);
  }, [orderId, orderStatus, showCancelledNotice]);

  const dismissCancelled = useCallback(() => {
    setCancelledVisible(false);
  }, []);

  return { cancelledVisible, dismissCancelled, showCancelledNotice };
}
