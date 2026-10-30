import { useEffect, useState } from 'react';
import { fetchBookingOptions } from '../api/bookingOptions';

let cached: boolean | undefined;

/** CRM「預約叫車」開關；預設 true（API 未帶欄位時） */
export function useScheduledOrdersEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached ?? true);

  useEffect(() => {
    let cancelled = false;
    void fetchBookingOptions().then((payload) => {
      if (cancelled) return;
      const v = payload.scheduledOrdersEnabled !== false;
      cached = v;
      setEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
