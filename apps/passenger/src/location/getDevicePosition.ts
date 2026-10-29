import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { LatLng } from '../constants/demoDestinations';
import { getAppLocale, t, type AppLocale } from '../i18n';
import { resolveLabelForCoords } from './resolveLabelForCoords';
import { withTimeout } from './withTimeout';

const GPS_ATTEMPT_MS = 8_000;
const GEOCODE_MS = 6_000;
const READ_POSITION_BUDGET_MS = 20_000;
const WHOLE_FIX_BUDGET_MS = 28_000;

export type DevicePositionFailureReason = 'denied' | 'services_off' | 'unavailable' | 'simulator_no_location';

export type DevicePositionResult =
  | { ok: true; place: LatLng }
  | { ok: false; reason: DevicePositionFailureReason };

function coordFallbackLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function readPosition(): Promise<Location.LocationObject | null> {
  try {
    const recent = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: 300_000 }),
      2_500,
    );
    if (recent && Number.isFinite(recent.coords.latitude) && Number.isFinite(recent.coords.longitude)) {
      return recent;
    }
  } catch {
    /* fall through */
  }

  const accuracies = [Location.Accuracy.Low, Location.Accuracy.Balanced];
  for (const accuracy of accuracies) {
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy }),
        GPS_ATTEMPT_MS,
      );
      if (Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
        return pos;
      }
    } catch {
      /* next attempt */
    }
  }

  try {
    const stale = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: 86_400_000 }),
      2_500,
    );
    if (stale && Number.isFinite(stale.coords.latitude)) return stale;
  } catch {
    /* ignore */
  }
  return null;
}

async function labelForCoords(
  latitude: number,
  longitude: number,
  locale: AppLocale,
): Promise<string> {
  const fallback = coordFallbackLabel(latitude, longitude);
  try {
    return await withTimeout(resolveLabelForCoords(latitude, longitude, locale), GEOCODE_MS);
  } catch {
    return fallback;
  }
}

async function getDevicePositionInner(locale: AppLocale): Promise<DevicePositionResult> {
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

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const pos = await withTimeout(readPosition(), READ_POSITION_BUDGET_MS);
  if (!pos) {
    const isSimulator = Constants.isDevice === false;
    if (Platform.OS === 'ios' && isSimulator) {
      return { ok: false, reason: 'simulator_no_location' };
    }
    return { ok: false, reason: 'unavailable' };
  }

  const { latitude, longitude } = pos.coords;
  const label = await labelForCoords(latitude, longitude, locale);
  return { ok: true, place: { latitude, longitude, label } };
}

/** 只檢查定位服務與 App 權限（不讀 GPS 座標） */
export async function assessLocationAccess(): Promise<DevicePositionFailureReason | null> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) return 'services_off';

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === 'undetermined') {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') return 'denied';
  return null;
}

export async function getDevicePosition(locale: AppLocale = getAppLocale()): Promise<DevicePositionResult> {
  try {
    return await withTimeout(getDevicePositionInner(locale), WHOLE_FIX_BUDGET_MS);
  } catch {
    const isSimulator = Constants.isDevice === false;
    if (Platform.OS === 'ios' && isSimulator) {
      return { ok: false, reason: 'simulator_no_location' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}

export function messageForPositionFailure(reason: DevicePositionFailureReason): string {
  switch (reason) {
    case 'denied':
      return t('location.denied');
    case 'services_off':
      return t('location.servicesOff');
    case 'simulator_no_location':
      return t('location.simulatorNoLocation');
    default:
      return t('location.unavailable');
  }
}

export function hintForPositionFailure(reason: DevicePositionFailureReason): string {
  switch (reason) {
    case 'denied':
      return t('location.hint.denied');
    case 'services_off':
      return t('location.hint.servicesOff');
    case 'simulator_no_location':
      return t('location.hint.simulator');
    default:
      return t('location.hint.fallback');
  }
}
