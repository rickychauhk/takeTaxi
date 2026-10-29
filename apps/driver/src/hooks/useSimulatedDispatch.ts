import { useEffect, useRef } from 'react';
import { useDriverSession } from '../context/DriverSessionContext';

/** 上線後定時模擬派單（原型） */
export function useSimulatedDispatch() {
  const { state, simulateIncomingOrder } = useDriverSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!state.online || state.activeOrder || state.alertOffer) return;

    const delay = 4000 + Math.random() * 5000;
    timerRef.current = setTimeout(() => {
      simulateIncomingOrder();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.online, state.activeOrder, state.alertOffer, simulateIncomingOrder]);
}
