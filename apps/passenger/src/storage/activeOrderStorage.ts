import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLng } from '../constants/demoDestinations';
import { fetchPassengerOrderTrack } from '../api/passengerOrder';
import { localizedAddressForPassenger } from '../location/addressForPassengerDisplay';
import type { OrderRebookDraft } from './orderRebookDraft';

const STORAGE_KEY = '@taxima/passenger/active_order_v1';

export type StoredActiveOrder = {
  orderId: string;
  pickup: LatLng;
  dropoff: LatLng;
  rebookDraft?: OrderRebookDraft;
};

export const ACTIVE_TRIP_STATUSES = new Set([
  'pending',
  'matching',
  'accepted',
  'en_route',
  'in_trip',
]);

export async function saveActiveOrder(order: StoredActiveOrder): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export async function clearActiveOrder(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function loadStoredActiveOrder(): Promise<StoredActiveOrder | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredActiveOrder;
    if (!parsed?.orderId || !parsed.pickup || !parsed.dropoff) return null;
    return parsed;
  } catch {
    await clearActiveOrder();
    return null;
  }
}

function latLngFromTrackStop(
  label: string | null,
  lat: number | null,
  lng: number | null,
  fallback: LatLng,
): LatLng {
  if (lat != null && lng != null) {
    const latitude = lat;
    const longitude = lng;
    const displayLabel = localizedAddressForPassenger(
      fallback.label?.trim() || label?.trim() || '',
      latitude,
      longitude,
    );
    return {
      latitude,
      longitude,
      label: displayLabel,
    };
  }
  return fallback;
}

/** 重開 App：向 API 確認柯打仍進行中，並用最新起終點 */
export async function restoreActiveOrderFromServer(): Promise<StoredActiveOrder | null> {
  const stored = await loadStoredActiveOrder();
  if (!stored) return null;

  try {
    const track = await fetchPassengerOrderTrack(stored.orderId);
    if (!ACTIVE_TRIP_STATUSES.has(track.status)) {
      await clearActiveOrder();
      return null;
    }
    const order: StoredActiveOrder = {
      orderId: stored.orderId,
      pickup: latLngFromTrackStop(track.pickup.label, track.pickup.lat, track.pickup.lng, stored.pickup),
      dropoff: latLngFromTrackStop(
        track.dropoff.label,
        track.dropoff.lat,
        track.dropoff.lng,
        stored.dropoff,
      ),
      rebookDraft: stored.rebookDraft,
    };
    await saveActiveOrder(order);
    return order;
  } catch {
    return stored;
  }
}
