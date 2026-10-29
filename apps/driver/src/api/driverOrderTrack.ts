import { apiFetch } from './client';

export type DriverOrderTrack = {
  orderId: string;
  status: string;
  pickup: { label: string; lat: number | null; lng: number | null };
  dropoff: { label: string; lat: number | null; lng: number | null };
  passenger: { lat: number; lng: number } | null;
};

export async function fetchDriverOrderTrack(
  driverId: string,
  orderId: string,
): Promise<DriverOrderTrack> {
  const res = await apiFetch(
    `/driver/orders/${encodeURIComponent(orderId)}/track?driverId=${encodeURIComponent(driverId)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as DriverOrderTrack;
}
