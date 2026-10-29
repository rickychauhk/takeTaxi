import { useEffect, useRef } from 'react';
import { playNewOrderAlertIfEnabled } from '../audio/newOrderAlertSound';
import type { OrderOffer } from '../types/order';

/** 範圍內新柯打彈窗出現時播放提示音（受地圖靜音掣控制） */
export function useNewOrderAlertSound(
  alertOffer: OrderOffer | null,
  online: boolean,
  playSound: boolean,
) {
  const lastPlayedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!online || !alertOffer || !playSound) {
      if (!alertOffer) lastPlayedIdRef.current = null;
      return;
    }
    if (lastPlayedIdRef.current === alertOffer.id) return;
    lastPlayedIdRef.current = alertOffer.id;
    void playNewOrderAlertIfEnabled(alertOffer);
  }, [alertOffer?.id, online, alertOffer, playSound]);
}
