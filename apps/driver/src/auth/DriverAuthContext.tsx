import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { apiFetch, setDriverAuthToken } from '../api/client';
import { firebaseAuth } from '../firebase/app';
import { setDriverCrashlyticsUserId } from '../firebase/crashlytics';
import { withTimeout } from '../location/withTimeout';
import { postDriverPresence } from '../api/presence';
import {
  clearDriverSession,
  getOrCreateDeviceId,
  persistActiveOrderId,
  persistDriverOnline,
  persistDriverSession,
  readStoredSession,
  type StoredDriver,
} from './session';
import { formatSessionRevokedMessage, registerDriverSessionRevokedHandler } from './sessionRevoked';
import { connectDriverSessionRevokedListener } from '../realtime/driverOrdersSocket';
import { useDriverAuthSessionWatch } from '../hooks/useDriverAuthSessionWatch';
import {
  ensureDriverPushPermission,
  loginDriverOneSignal,
  logoutDriverOneSignal,
} from '../notifications/DriverOneSignalService';

const BOOTSTRAP_ME_TIMEOUT_MS = 8_000;

type Ctx = {
  token: string | null;
  driver: StoredDriver | null;
  bootstrapping: boolean;
  loginWithFirebase: (idToken: string) => Promise<void>;
  loginWithPhone: (phoneE164: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const DriverAuthContext = createContext<Ctx | null>(null);

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<StoredDriver | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    void (async () => {
      try {
        const stored = await readStoredSession();
        if (stored) {
          setDriverAuthToken(stored.token);
          setToken(stored.token);
          setDriver(stored.driver);
          setDriverCrashlyticsUserId(String(stored.driver.id));
          loginDriverOneSignal(String(stored.driver.id));
          void ensureDriverPushPermission();
          try {
            const res = await withTimeout(
              apiFetch('/driver/auth/me'),
              BOOTSTRAP_ME_TIMEOUT_MS,
              'timeout',
            );
            if (res.ok) {
              const profile = (await res.json()) as StoredDriver;
              setDriver(profile);
              await persistDriverSession(stored.token, profile);
              setDriverCrashlyticsUserId(String(profile.id));
              loginDriverOneSignal(String(profile.id));
              void ensureDriverPushPermission();
            } else if (res.status === 401) {
              await clearDriverSession();
              setToken(null);
              setDriver(null);
              setDriverAuthToken(null);
            }
          } catch {
            /* 離線或 API 無回應：沿用本地 session，不阻塞進入 App */
          }
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const applyLoginResponse = useCallback(
    async (data: { token: string; expiresAt?: string | null; driver: StoredDriver }) => {
      setDriverAuthToken(data.token);
      setToken(data.token);
      setDriver(data.driver);
      await persistDriverSession(data.token, data.driver, data.expiresAt);
      await persistDriverOnline(true);
      setDriverCrashlyticsUserId(String(data.driver.id));
      loginDriverOneSignal(String(data.driver.id));
      void ensureDriverPushPermission();
    },
    [],
  );

  const loginWithFirebase = useCallback(async (idToken: string) => {
    const deviceId = await getOrCreateDeviceId();
    const res = await apiFetch('/driver/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken, deviceId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      token: string;
      expiresAt?: string | null;
      driver: StoredDriver;
    };
    await applyLoginResponse(data);
  }, [applyLoginResponse]);

  const loginWithPhone = useCallback(async (phoneE164: string) => {
    const deviceId = await getOrCreateDeviceId();
    const res = await apiFetch('/driver/auth/phone-login', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneE164, deviceId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      token: string;
      expiresAt?: string | null;
      driver: StoredDriver;
    };
    await applyLoginResponse(data);
  }, [applyLoginResponse]);

  const handleSessionRevoked = useCallback((message: string) => {
    Alert.alert(
      '已登出',
      formatSessionRevokedMessage(message),
      [{ text: '確定', onPress: () => void logoutRef.current() }],
      { cancelable: false },
    );
  }, []);

  useEffect(() => {
    registerDriverSessionRevokedHandler(handleSessionRevoked);
    return () => registerDriverSessionRevokedHandler(null);
  }, [handleSessionRevoked]);

  useEffect(() => {
    if (!token) return;
    return connectDriverSessionRevokedListener(token, handleSessionRevoked);
  }, [token, handleSessionRevoked]);

  const logout = useCallback(async () => {
    try {
      await postDriverPresence(false);
    } catch {
      /* ignore */
    }
    try {
      await apiFetch('/driver/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken(null);
    setDriver(null);
    setDriverAuthToken(null);
    setDriverCrashlyticsUserId(null);
    logoutDriverOneSignal();
    await persistDriverOnline(false);
    await persistActiveOrderId(null);
    await clearDriverSession();
    await signOut(firebaseAuth);
  }, []);

  logoutRef.current = logout;

  useDriverAuthSessionWatch(token);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch('/driver/auth/me');
    if (!res.ok) return;
    const profile = (await res.json()) as StoredDriver;
    setDriver(profile);
    await persistDriverSession(token, profile);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      driver,
      bootstrapping,
      loginWithFirebase,
      loginWithPhone,
      logout,
      refreshProfile,
    }),
    [token, driver, bootstrapping, loginWithFirebase, loginWithPhone, logout, refreshProfile],
  );

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

export function useDriverAuth() {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) throw new Error('useDriverAuth requires DriverAuthProvider');
  return ctx;
}
