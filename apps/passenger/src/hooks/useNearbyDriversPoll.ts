import { useEffect, useState } from 'react';
import { fetchNearbyDrivers, type NearbyDriver } from '../api/client';
import { bearingDegrees } from '../geo/bearingDegrees';

export const PASSENGER_NEARBY_DRIVERS_POLL_MS = 4000;

type Center = { latitude: number; longitude: number };

export type NearbyDriverOnMap = NearbyDriver & { heading: number };

function withHeadings(prev: NearbyDriverOnMap[], rows: NearbyDriver[]): NearbyDriverOnMap[] {
  const prevById = new Map(prev.map((d) => [d.driver_id, d]));
  return rows.map((d) => {
    const old = prevById.get(d.driver_id);
    let heading = old?.heading ?? 0;
    if (old && (old.lat !== d.lat || old.lng !== d.lng)) {
      heading = bearingDegrees(old.lat, old.lng, d.lat, d.lng);
    }
    return { ...d, heading };
  });
}

/** 叫車地圖：定期拉附近在線司機，並推算車頭朝向 */
export function useNearbyDriversPoll(center: Center | null | undefined, radiusM: number) {
  const [drivers, setDrivers] = useState<NearbyDriverOnMap[]>([]);

  useEffect(() => {
    if (!center) {
      setDrivers([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const rows = await fetchNearbyDrivers(center.latitude, center.longitude, radiusM);
      if (cancelled) return;
      const inRange = rows.filter((d) => d.distance_m <= radiusM + 80);
      setDrivers((prev) => withHeadings(prev, inRange));
    };

    void load();
    const interval = setInterval(() => void load(), PASSENGER_NEARBY_DRIVERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [center?.latitude, center?.longitude, radiusM]);

  return drivers;
}
