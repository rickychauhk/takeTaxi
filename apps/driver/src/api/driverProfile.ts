import { apiFetch } from './client';
import type { StoredDriver } from '../auth/session';

export async function patchDriverVehiclePlate(vehiclePlate: string): Promise<StoredDriver> {
  const res = await apiFetch('/driver/auth/vehicle-plate', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehiclePlate: vehiclePlate.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `更新車牌失敗（${res.status}）`);
  }
  return (await res.json()) as StoredDriver;
}
