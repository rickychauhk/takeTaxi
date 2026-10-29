import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { signOut } from 'firebase/auth';
import { passengerFetch, setPassengerAuthToken } from '../api/passengerClient';
import { firebaseAuth } from '../firebase/app';
import {
  getOrCreatePassengerClientId,
} from '../storage/passengerClientId';
import { setPassengerCrashlyticsUserId } from '../firebase/crashlytics';
import {
  ensurePassengerPushPermission,
  loginPassengerOneSignal,
  logoutPassengerOneSignal,
} from '../notifications/PassengerOneSignalService';
import { withTimeout } from '../location/withTimeout';
import {
  clearPassengerSession,
  persistPassengerSession,
  readStoredPassengerSession,
  type StoredPassenger,
} from './session';

const BOOTSTRAP_ME_TIMEOUT_MS = 8_000;

type Ctx = {
  token: string | null;
  passenger: StoredPassenger | null;
  bootstrapping: boolean;
  loginWithFirebase: (idToken: string) => Promise<void>;
  loginWithPhone: (phoneE164: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const PassengerAuthContext = createContext<Ctx | null>(null);

export function PassengerAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [passenger, setPassenger] = useState<StoredPassenger | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await readStoredPassengerSession();
        if (stored) {
          setPassengerAuthToken(stored.token);
          setToken(stored.token);
          setPassenger(stored.passenger);
          loginPassengerOneSignal(String(stored.passenger.id));
          void ensurePassengerPushPermission();
          setPassengerCrashlyticsUserId(String(stored.passenger.id));
          try {
            const appClientId = await getOrCreatePassengerClientId();
            const res = await withTimeout(
              passengerFetch(
                `/passenger/auth/me?appClientId=${encodeURIComponent(appClientId)}`,
              ),
              BOOTSTRAP_ME_TIMEOUT_MS,
              'timeout',
            );
            if (res.ok) {
              const profile = (await res.json()) as StoredPassenger;
              setPassenger(profile);
              await persistPassengerSession(stored.token, profile, stored.expiresAt);
              loginPassengerOneSignal(String(profile.id));
              void ensurePassengerPushPermission();
              setPassengerCrashlyticsUserId(String(profile.id));
            } else if (res.status === 401) {
              await clearPassengerSession();
              setToken(null);
              setPassenger(null);
              setPassengerAuthToken(null);
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

  const applyPassengerSession = useCallback(
    async (data: { token: string; expiresAt?: string | null; passenger: StoredPassenger }) => {
      setPassengerAuthToken(data.token);
      setToken(data.token);
      setPassenger(data.passenger);
      await persistPassengerSession(data.token, data.passenger, data.expiresAt);
      loginPassengerOneSignal(String(data.passenger.id));
      void ensurePassengerPushPermission();
      setPassengerCrashlyticsUserId(String(data.passenger.id));
    },
    [],
  );

  const loginWithFirebase = useCallback(
    async (idToken: string) => {
      const appClientId = await getOrCreatePassengerClientId();
      const res = await passengerFetch('/passenger/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({ idToken, appClientId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        token: string;
        expiresAt?: string | null;
        passenger: StoredPassenger;
      };
      await applyPassengerSession(data);
    },
    [applyPassengerSession],
  );

  const loginWithPhone = useCallback(
    async (phoneE164: string) => {
      const appClientId = await getOrCreatePassengerClientId();
      const res = await passengerFetch('/passenger/auth/phone-login', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneE164, appClientId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        token: string;
        expiresAt?: string | null;
        passenger: StoredPassenger;
      };
      await applyPassengerSession(data);
    },
    [applyPassengerSession],
  );

  const logout = useCallback(async () => {
    logoutPassengerOneSignal();
    setPassengerCrashlyticsUserId(null);
    setToken(null);
    setPassenger(null);
    setPassengerAuthToken(null);
    await clearPassengerSession();
    try {
      await signOut(firebaseAuth);
    } catch {
      /* 未用 Firebase OTP 時可略過 */
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const appClientId = await getOrCreatePassengerClientId();
    const res = await passengerFetch(
      `/passenger/auth/me?appClientId=${encodeURIComponent(appClientId)}`,
    );
    if (!res.ok) return;
    const profile = (await res.json()) as StoredPassenger;
    setPassenger(profile);
    await persistPassengerSession(token, profile);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      passenger,
      bootstrapping,
      loginWithFirebase,
      loginWithPhone,
      logout,
      refreshProfile,
    }),
    [token, passenger, bootstrapping, loginWithFirebase, loginWithPhone, logout, refreshProfile],
  );

  return <PassengerAuthContext.Provider value={value}>{children}</PassengerAuthContext.Provider>;
}

export function usePassengerAuth() {
  const ctx = useContext(PassengerAuthContext);
  if (!ctx) throw new Error('usePassengerAuth must be used within PassengerAuthProvider');
  return ctx;
}
