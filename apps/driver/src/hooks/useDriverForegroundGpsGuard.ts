import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  alertDriverGpsOnResume,
  checkDriverGpsOnAppResume,
} from '../location/requireDriverLocation';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSession } from '../context/DriverSessionContext';

/** 已登入：從背景回前景時檢查 GPS（不自動下線，請司機開啟定位）。 */
export function useDriverForegroundGpsGuard() {
  const { token } = useDriverAuth();
  const { state } = useDriverSession();
  const checking = useRef(false);
  const onlineRef = useRef(state.online);
  onlineRef.current = state.online;
  const activeOrderRef = useRef(state.activeOrder);
  activeOrderRef.current = state.activeOrder;

  useEffect(() => {
    if (!token) return;

    const onResume = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const check = await checkDriverGpsOnAppResume();
        if (check.ok) return;

        const wasOnline = onlineRef.current;
        const inTrip = !!activeOrderRef.current;
        alertDriverGpsOnResume(check.reason, {
          forcedOffline: false,
          activeTrip: wasOnline && inTrip,
        });
      } finally {
        checking.current = false;
      }
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void onResume();
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [token]);
}
