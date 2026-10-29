import * as Location from 'expo-location';
import { useEffect } from 'react';
import { postPassengerLocation } from '../api/passengerLocation';

/** 行程進行中上報乘客 GPS，供司機地圖即時顯示 */
export function usePassengerLiveLocation(passengerId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !passengerId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        await postPassengerLocation(
          passengerId,
          pos.coords.latitude,
          pos.coords.longitude,
        );
      } catch {
        /* ignore */
      }
    };

    void tick();
    timer = setInterval(() => void tick(), 4000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [passengerId, enabled]);
}
