import { useEffect, useRef } from 'react';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { postDriverPresenceWithPreferences } from '../api/dispatchPreferences';
import { postDriverLocation } from '../api/orders';
import { driverDispatchBlockedMessage, isDriverApproved } from '../constants/driverApproval';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { ensureDriverGpsForOnline, postImmediateDriverLocation } from '../location/requireDriverLocation';

/**
 * 登入且已審批即視為上線：同步 presence、立即上報 GPS。
 * 無手動上下線掣；登出時由 session 重置 online。
 */
export function useDriverAutoOnline() {
  const { token, driver } = useDriverAuth();
  const { pickupRadiusKm } = useDriverSettings();
  const { sessionReady, state, setOnline } = useDriverSession();
  const presenceSyncedRef = useRef(false);

  useEffect(() => {
    if (!token) presenceSyncedRef.current = false;
  }, [token]);

  useEffect(() => {
    presenceSyncedRef.current = false;
  }, [pickupRadiusKm, state.activeOrder?.id]);

  useEffect(() => {
    if (!token || !sessionReady || !driver?.id) return;

    if (!isDriverApproved(driver.verificationStatus) || driverDispatchBlockedMessage(driver)) {
      if (state.online) setOnline(false);
      presenceSyncedRef.current = false;
      return;
    }

    if (!state.online) setOnline(true);

    if (state.activeOrder) return;

    if (presenceSyncedRef.current) return;

    void (async () => {
      const ok = await ensureDriverGpsForOnline();
      if (!ok) return;
      const posted = await postImmediateDriverLocation((lat, lng) =>
        postDriverLocation(driver.id, lat, lng),
      );
      if (!posted) return;
      try {
        await postDriverPresenceWithPreferences(true, pickupRadiusKm);
        presenceSyncedRef.current = true;
      } catch {
        /* 下一輪 effect 或 GPS watch 會再試 */
      }
    })();
  }, [
    token,
    sessionReady,
    driver?.id,
    driver?.verificationStatus,
    driver?.suspensionActive,
    driver?.suspendedPermanent,
    driver?.suspendedUntilHk,
    state.online,
    state.activeOrder,
    pickupRadiusKm,
    setOnline,
  ]);
}
