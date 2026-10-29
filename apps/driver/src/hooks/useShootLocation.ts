import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '../constants/latLng';
import { resolveLabelForCoords } from '../location/resolveLabelForCoords';

export function useShootLocation() {
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPickup = useCallback(async (): Promise<LatLng | null> => {
    setLoading(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('請開啟定位以設定上車點');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const label = await resolveLabelForCoords(latitude, longitude);
      const place: LatLng = { latitude, longitude, label };
      setPickup(place);
      return place;
    } catch {
      setError('無法讀取位置');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPickup();
  }, [refreshPickup]);

  return { pickup, loading, error, refreshPickup, setPickup };
};
