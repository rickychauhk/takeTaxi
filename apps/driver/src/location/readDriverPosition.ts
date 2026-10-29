import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { withTimeout } from './withTimeout';

const GPS_ATTEMPT_MS = 10_000;

export type DriverPositionFailure = 'services_off' | 'simulator_no_location' | 'unavailable';

export type DriverPositionResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: DriverPositionFailure };

async function readOnce(): Promise<Location.LocationObject | null> {
  try {
    const recent = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: 300_000 }),
      3_000,
    );
    if (recent && Number.isFinite(recent.coords.latitude) && Number.isFinite(recent.coords.longitude)) {
      return recent;
    }
  } catch {
    /* continue */
  }

  for (const accuracy of [Location.Accuracy.Low, Location.Accuracy.Balanced]) {
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy }),
        GPS_ATTEMPT_MS,
      );
      if (Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
        return pos;
      }
    } catch {
      /* next */
    }
  }

  try {
    const stale = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: 86_400_000 }),
      3_000,
    );
    if (stale && Number.isFinite(stale.coords.latitude)) return stale;
  } catch {
    /* ignore */
  }
  return null;
}

/** 讀取司機當前座標（上線／接單／上報共用）。 */
export async function readDriverPosition(): Promise<DriverPositionResult> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return { ok: false, reason: 'services_off' };
  }

  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      /* ignore */
    }
  }

  const pos = await readOnce();
  if (!pos) {
    if (Platform.OS === 'ios' && Constants.isDevice === false) {
      return { ok: false, reason: 'simulator_no_location' };
    }
    return { ok: false, reason: 'unavailable' };
  }

  return {
    ok: true,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

export function alertForDriverPositionFailure(reason: DriverPositionFailure): void {
  switch (reason) {
    case 'services_off':
      Alert.alert(
        '定位服務已關閉',
        '請到系統設定開啟「定位服務」，司機版才能上線及接單。',
      );
      break;
    case 'simulator_no_location':
      Alert.alert(
        'Simulator 未有模擬位置',
        '請用 Xcode / Simulator：Features → Location → 揀 Apple 或 Custom Location，然後再試上線或接單。',
      );
      break;
    default:
      Alert.alert(
        '無法取得 GPS',
        '請確認已允許定位，並在空曠地方稍等數秒再試；若在室內可先走到窗邊。',
      );
      break;
  }
}
