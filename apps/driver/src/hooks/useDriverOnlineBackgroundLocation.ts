import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { DRIVER_BG_LOCATION_TASK } from '../location/driverBackgroundLocationTask';

async function stopBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_BG_LOCATION_TASK).catch(
    () => false,
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_BG_LOCATION_TASK).catch(() => undefined);
  }
}

async function startBackgroundLocation(): Promise<boolean> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    fg = await Location.requestForegroundPermissionsAsync();
  }
  if (fg.status !== 'granted') return false;

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  if (bg.status !== 'granted') return false;

  const already = await Location.hasStartedLocationUpdatesAsync(DRIVER_BG_LOCATION_TASK).catch(
    () => false,
  );
  if (already) return true;

  await Location.startLocationUpdatesAsync(DRIVER_BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 8000,
    distanceInterval: 15,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: '搭的司機版',
      notificationBody: '上線接單中 · 保持定位以接收附近柯打',
    },
  });
  return true;
}

/** Android 上線：前景 service + 背景 GPS，令 PROD 可發 push / 全屏提醒 */
export function useDriverOnlineBackgroundLocation(driverId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled || !driverId) {
      void stopBackgroundLocation();
      return;
    }
    void startBackgroundLocation();
    return () => {
      void stopBackgroundLocation();
    };
  }, [driverId, enabled]);
}
