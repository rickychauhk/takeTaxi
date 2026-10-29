import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { firebaseAuth } from '../firebase/config';
import { clearAdminSession, getOrCreateDeviceId, persistAdminSession, readStoredToken } from './session';

type Admin = { id: number; phone?: string | null; email?: string; displayName: string; role: string };

type AuthCtx = {
  token: string | null;
  admin: Admin | null;
  loginWithFirebase: (idToken: string) => Promise<void>;
  loginWithPhone: (phoneE164: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

function readStoredAdmin(): Admin | null {
  const raw = localStorage.getItem('taxima_admin');
  return raw ? (JSON.parse(raw) as Admin) : null;
}

function loadInitialAuthState(): { token: string | null; admin: Admin | null } {
  const token = readStoredToken();
  if (token) setAuthToken(token);
  return { token, admin: token ? readStoredAdmin() : null };
}

let initialAuthCache: ReturnType<typeof loadInitialAuthState> | undefined;

function getInitialAuthState() {
  initialAuthCache ??= loadInitialAuthState();
  return initialAuthCache;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getInitialAuthState().token);
  const [admin, setAdmin] = useState<Admin | null>(() => getInitialAuthState().admin);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setAdmin(null);
      clearAdminSession();
      setAuthToken(null);
      void signOut(firebaseAuth);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      token,
      admin,
      async loginWithFirebase(idToken) {
        const { data } = await api.post<{ token: string; expiresAt?: string | null; admin: Admin }>(
          '/admin/auth/firebase-login',
          { idToken, deviceId: getOrCreateDeviceId() },
        );
        setToken(data.token);
        setAdmin(data.admin);
        persistAdminSession(data.token, data.admin, data.expiresAt);
        setAuthToken(data.token);
      },
      async loginWithPhone(phoneE164) {
        const { data } = await api.post<{ token: string; expiresAt?: string | null; admin: Admin }>(
          '/admin/auth/phone-login',
          { phone: phoneE164, deviceId: getOrCreateDeviceId() },
        );
        setToken(data.token);
        setAdmin(data.admin);
        persistAdminSession(data.token, data.admin, data.expiresAt);
        setAuthToken(data.token);
      },
      logout() {
        setToken(null);
        setAdmin(null);
        clearAdminSession();
        setAuthToken(null);
        void signOut(firebaseAuth);
      },
    }),
    [token, admin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
