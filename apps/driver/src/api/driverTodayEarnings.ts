import { apiFetch } from './client';

export type DriverTodayCompletedOrder = {
  orderId: string;
  completedAtHk: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  fareHkd: number;
};

export type DriverTodayEarningsResponse = {
  dateHk: string;
  totalHkd: number;
  tripCount: number;
  items: DriverTodayCompletedOrder[];
};

export async function fetchDriverTodayEarnings(): Promise<DriverTodayEarningsResponse> {
  const res = await apiFetch('/driver/earnings/today');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.trim() || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as DriverTodayEarningsResponse;
  return {
    dateHk: data.dateHk ?? '',
    totalHkd: Number(data.totalHkd) || 0,
    tripCount: Number(data.tripCount) || 0,
    items: Array.isArray(data.items) ? data.items : [],
  };
}
