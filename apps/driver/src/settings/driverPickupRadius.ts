import AsyncStorage from '@react-native-async-storage/async-storage';

/** null = 不限公里 */
export type DriverPickupRadiusKm = 3 | 6 | 10 | null;

export const DRIVER_PICKUP_RADIUS_OPTIONS: { value: DriverPickupRadiusKm; label: string }[] = [
  { value: 3, label: '3 公里' },
  { value: 6, label: '6 公里' },
  { value: 10, label: '10 公里' },
  { value: null, label: '不限' },
];

const STORAGE_KEY = 'driver.maxPickupRadiusKm.v2';
const LEGACY_STORAGE_KEY = 'driver.maxPickupRadiusKm';

export function pickupRadiusQueryValue(km: DriverPickupRadiusKm): string | undefined {
  if (km == null) return undefined;
  return String(km);
}

/** 舊版 2 / 4 / 6 公里 → 3 / 6 / 10（legacy key 嘅「6」係舊第三檔 → 10） */
function migrateLegacyStored(raw: string): DriverPickupRadiusKm {
  if (raw === 'unlimited' || raw === '') return null;
  if (raw === '2') return 3;
  if (raw === '4') return 6;
  if (raw === '6') return 10;
  if (raw === '3' || raw === '10') return Number(raw) as DriverPickupRadiusKm;
  return null;
}

export async function getStoredPickupRadiusKm(): Promise<DriverPickupRadiusKm> {
  const v2 = await AsyncStorage.getItem(STORAGE_KEY);
  if (v2 != null) {
    if (v2 === 'unlimited') return null;
    if (v2 === '3' || v2 === '6' || v2 === '10') return Number(v2) as DriverPickupRadiusKm;
  }
  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy == null) return null;
  const migrated = migrateLegacyStored(legacy);
  await setStoredPickupRadiusKm(migrated);
  return migrated;
}

export async function setStoredPickupRadiusKm(km: DriverPickupRadiusKm): Promise<void> {
  if (km == null) {
    await AsyncStorage.setItem(STORAGE_KEY, 'unlimited');
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, String(km));
}

export function formatPickupRadiusLabel(km: DriverPickupRadiusKm): string {
  if (km == null) return '不限';
  return `${km} 公里內`;
}

export function pickupRadiusForApi(km: DriverPickupRadiusKm): number | null | 'unlimited' {
  if (km == null) return 'unlimited';
  return km;
}
