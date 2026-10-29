import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'taxima_driver_token';
const DRIVER_KEY = 'taxima_driver_profile';
const EXPIRES_KEY = 'taxima_driver_expires_at';
const DEVICE_ID_KEY = 'taxima_driver_device_id';
const REMEMBER_PHONE_KEY = 'taxima_driver_remember_phone';
const ONLINE_KEY = 'taxima_driver_online';
const ACTIVE_ORDER_ID_KEY = 'taxima_driver_active_order_id';
const ACTIVE_TRIP_KEY = 'taxima_driver_active_trip_v1';

export type StoredDriver = {
  id: string;
  phone: string;
  displayName: string | null;
  driverTier: string;
  vehiclePlate: string | null;
  /** 以往使用過、可快速選回的車牌（不含目前車牌） */
  vehiclePlateHistory?: string[];
  pointsBalance?: number;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  suspensionActive?: boolean;
  suspendedPermanent?: boolean;
  suspendedUntilHk?: string | null;
  suspendedReason?: string | null;
};

function isJwtExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();
  const id = `drv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function persistDriverSession(
  token: string,
  driver: StoredDriver,
  expiresAt?: string | null,
) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [DRIVER_KEY, JSON.stringify(driver)],
    ...(expiresAt ? [[EXPIRES_KEY, expiresAt] as [string, string]] : []),
  ]);
}

export async function readStoredSession(): Promise<{
  token: string;
  driver: StoredDriver;
} | null> {
  const [[, token], [, driverRaw], [, expiresAt]] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    DRIVER_KEY,
    EXPIRES_KEY,
  ]);
  if (!token || !driverRaw) return null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    await clearDriverSession();
    return null;
  }
  if (isJwtExpired(token)) {
    await clearDriverSession();
    return null;
  }
  try {
    return { token, driver: JSON.parse(driverRaw) as StoredDriver };
  } catch {
    await clearDriverSession();
    return null;
  }
}

export async function clearDriverSession() {
  await AsyncStorage.multiRemove([
    TOKEN_KEY,
    DRIVER_KEY,
    EXPIRES_KEY,
    ONLINE_KEY,
    ACTIVE_ORDER_ID_KEY,
    ACTIVE_TRIP_KEY,
  ]);
}

export async function persistDriverOnline(online: boolean) {
  await AsyncStorage.setItem(ONLINE_KEY, online ? '1' : '0');
}

export async function readDriverOnline(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONLINE_KEY)) === '1';
}

export async function persistActiveOrderId(orderId: string | null) {
  if (orderId?.trim()) {
    await AsyncStorage.setItem(ACTIVE_ORDER_ID_KEY, orderId.trim());
  } else {
    await AsyncStorage.removeItem(ACTIVE_ORDER_ID_KEY);
  }
}

export async function readActiveOrderId(): Promise<string | null> {
  const id = await AsyncStorage.getItem(ACTIVE_ORDER_ID_KEY);
  return id?.trim() || null;
}

export type StoredActiveTrip = {
  offer: { id: string; pickupLabel: string; dropoffLabel: string; fareEstimateHkd: number };
  phase: 'to_pickup' | 'waiting_passenger' | 'to_dropoff';
};

export async function persistActiveTripSnapshot(trip: StoredActiveTrip | null) {
  if (trip) {
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
  } else {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  }
}

export async function readActiveTripSnapshot(): Promise<StoredActiveTrip | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredActiveTrip;
  } catch {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
    return null;
  }
}

export async function loadRememberPhone(): Promise<string> {
  return (await AsyncStorage.getItem(REMEMBER_PHONE_KEY)) ?? '';
}

export async function saveRememberPhone(phone: string) {
  await AsyncStorage.setItem(REMEMBER_PHONE_KEY, phone.trim());
}
