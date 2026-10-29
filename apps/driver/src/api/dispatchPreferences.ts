import { apiFetch } from './client';
import type { DriverPickupRadiusKm } from '../settings/driverPickupRadius';
import { pickupRadiusForApi } from '../settings/driverPickupRadius';

export async function postDriverDispatchPreferences(
  maxPickupRadiusKm: DriverPickupRadiusKm,
): Promise<void> {
  const res = await apiFetch('/driver/auth/dispatch-preferences', {
    method: 'POST',
    body: JSON.stringify({ maxPickupRadiusKm: pickupRadiusForApi(maxPickupRadiusKm) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function postDriverPresenceWithPreferences(
  online: boolean,
  maxPickupRadiusKm: DriverPickupRadiusKm,
): Promise<void> {
  const res = await apiFetch('/driver/auth/presence', {
    method: 'POST',
    body: JSON.stringify({
      online,
      maxPickupRadiusKm: pickupRadiusForApi(maxPickupRadiusKm),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
