import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { readDriverPosition } from '../location/readDriverPosition';
import type { GeoPoint } from '../types/order';

export type DriverFix = GeoPoint & { heading: number | null; speedKmh: number | null };

function normalizeHeading(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** 行程地圖：持續更新司機 GPS + 行車方向 */
export function useDriverWatchPosition(enabled: boolean) {
  const [fix, setFix] = useState<DriverFix | null>(null);

  const mergeFix = useCallback(
    (
      latitude: number,
      longitude: number,
      heading?: number | null,
      speedMps?: number | null,
    ) => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const h = normalizeHeading(heading ?? null);
      const speedKmh =
        speedMps != null && Number.isFinite(speedMps) && speedMps >= 0
          ? Math.round(speedMps * 3.6)
          : null;
      setFix((prev) => {
        if (
          prev &&
          Math.abs(prev.latitude - latitude) < 0.000001 &&
          Math.abs(prev.longitude - longitude) < 0.000001 &&
          prev.heading === h &&
          prev.speedKmh === speedKmh
        ) {
          return prev;
        }
        return { latitude, longitude, heading: h, speedKmh };
      });
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setFix(null);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const applyReading = async () => {
      const result = await readDriverPosition();
      if (!cancelled && result.ok) {
        mergeFix(result.latitude, result.longitude, null, null);
      }
    };

    void (async () => {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted' || cancelled) return;

      await applyReading();

      pollTimer = setInterval(() => void applyReading(), 4000);

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 1000,
          },
          (pos) => {
            if (cancelled) return;
            mergeFix(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.heading,
              pos.coords.speed,
            );
          },
        );
      } catch {
        /* interval fallback only */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [enabled, mergeFix]);

  const mergeDriverCoord = useCallback(
    (latitude: number, longitude: number, heading?: number | null, speedMps?: number | null) =>
      mergeFix(latitude, longitude, heading ?? null, speedMps ?? null),
    [mergeFix],
  );

  return {
    fix,
    coord: fix ? { latitude: fix.latitude, longitude: fix.longitude } : null,
    heading: fix?.heading ?? null,
    speedKmh: fix?.speedKmh ?? null,
    mergeDriverCoord,
  };
}
