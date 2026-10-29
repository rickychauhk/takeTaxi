import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { postDriverLocation } from '../api/orders';

const POST_INTERVAL_MS = 4000;

/** 上線或行程進行中定期上報司機 GPS（與地圖 watch 同源），供乘客附近司機／行程追蹤。 */
export function useDriverLiveLocation(driverId: string | undefined, enabled: boolean) {
  const lastPostAt = useRef(0);

  useEffect(() => {
    if (!enabled || !driverId) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryPost = async (lat: number, lng: number) => {
      if (cancelled || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const now = Date.now();
      if (now - lastPostAt.current < POST_INTERVAL_MS) return;
      try {
        await postDriverLocation(driverId, lat, lng);
        lastPostAt.current = now;
      } catch {
        /* 網絡／SSL 等暫時失敗，下一輪重試 */
      }
    };

    const postFromCache = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
        if (cached && !cancelled) {
          await tryPost(cached.coords.latitude, cached.coords.longitude);
        }
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted' || cancelled) return;

      await postFromCache();
      pollTimer = setInterval(() => void postFromCache(), POST_INTERVAL_MS);

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 5,
            timeInterval: 2000,
          },
          (pos) => {
            if (cancelled) return;
            void tryPost(pos.coords.latitude, pos.coords.longitude);
          },
        );
      } catch {
        /* 僅用 interval + lastKnown */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [driverId, enabled]);
}
