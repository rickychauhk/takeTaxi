import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { postDriverDispatchPreferences } from '../api/dispatchPreferences';
import { useDriverAuth } from '../auth/DriverAuthContext';
import {
  type DriverPickupRadiusKm,
  getStoredPickupRadiusKm,
  setStoredPickupRadiusKm,
} from '../settings/driverPickupRadius';

type Ctx = {
  pickupRadiusKm: DriverPickupRadiusKm;
  /** 接單距離變更時遞增，供首頁地圖 refit 範圍 */
  pickupRadiusVersion: number;
  setPickupRadiusKm: (km: DriverPickupRadiusKm) => Promise<void>;
  /** 從本機 storage 讀取；有變更則更新 state 並 bump version */
  syncPickupRadiusFromStorage: () => Promise<boolean>;
  ready: boolean;
};

const DriverSettingsContext = createContext<Ctx | null>(null);

export function DriverSettingsProvider({ children }: { children: ReactNode }) {
  const { token } = useDriverAuth();
  const [pickupRadiusKm, setPickupRadiusKmState] = useState<DriverPickupRadiusKm>(null);
  const [pickupRadiusVersion, setPickupRadiusVersion] = useState(0);
  const [ready, setReady] = useState(false);

  const bumpPickupRadiusVersion = useCallback(() => {
    setPickupRadiusVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredPickupRadiusKm();
      setPickupRadiusKmState(stored);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!token || !ready) return;
    void postDriverDispatchPreferences(pickupRadiusKm).catch(() => undefined);
  }, [token, ready, pickupRadiusKm]);

  const setPickupRadiusKm = useCallback(
    async (km: DriverPickupRadiusKm) => {
      await setStoredPickupRadiusKm(km);
      let changed = false;
      setPickupRadiusKmState((prev) => {
        if (prev === km) return prev;
        changed = true;
        return km;
      });
      if (changed) bumpPickupRadiusVersion();
      if (token) {
        await postDriverDispatchPreferences(km);
      }
    },
    [token, bumpPickupRadiusVersion],
  );

  const syncPickupRadiusFromStorage = useCallback(async (): Promise<boolean> => {
    const stored = await getStoredPickupRadiusKm();
    let changed = false;
    setPickupRadiusKmState((prev) => {
      if (prev === stored) return prev;
      changed = true;
      return stored;
    });
    if (changed) bumpPickupRadiusVersion();
    return changed;
  }, [bumpPickupRadiusVersion]);

  const value = useMemo(
    () => ({
      pickupRadiusKm,
      pickupRadiusVersion,
      setPickupRadiusKm,
      syncPickupRadiusFromStorage,
      ready,
    }),
    [pickupRadiusKm, pickupRadiusVersion, setPickupRadiusKm, syncPickupRadiusFromStorage, ready],
  );

  return (
    <DriverSettingsContext.Provider value={value}>{children}</DriverSettingsContext.Provider>
  );
}

export function useDriverSettings() {
  const ctx = useContext(DriverSettingsContext);
  if (!ctx) throw new Error('useDriverSettings must be used within DriverSettingsProvider');
  return ctx;
}
