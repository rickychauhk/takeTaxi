import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { apiFetch } from '../api/client';
import { formatSessionRevokedMessage, notifyDriverSessionRevoked } from '../auth/sessionRevoked';

const POLL_MS = 30_000;

/** 背景／另一裝置登入後，HTTP 401 或定期 /me 檢查 session */
export function useDriverAuthSessionWatch(token: string | null) {
  const ticking = useRef(false);

  useEffect(() => {
    if (!token) return;

    const tick = async () => {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const res = await apiFetch('/driver/auth/me');
        if (res.status === 401) {
          const text = await res.text().catch(() => '');
          notifyDriverSessionRevoked(formatSessionRevokedMessage(text));
        }
      } catch {
        /* offline */
      } finally {
        ticking.current = false;
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [token]);
}
