import { getOrCreatePassengerClientId } from '../storage/passengerClientId';
import { passengerFetch } from './passengerClient';

export type PassengerOrderHistoryRow = {
  orderId: string;
  orderType: string;
  status: string;
  cancelBy: 'passenger' | 'driver' | 'admin' | 'system' | null;
  driverMisaccept: boolean;
  fareEstimate: string | null;
  fareFinal: string | null;
  placedAtHk: string | null;
  scheduledAtHk: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  passengerPointsRedeemed: number | null;
  passengerPointsDiscountHkd: number | null;
  passengerPointsHkdPerPointAtOrder: number | null;
};

export type PassengerOrderHistoryPage = {
  items: PassengerOrderHistoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function fetchPassengerOrderHistory(page = 1): Promise<PassengerOrderHistoryPage> {
  const appClientId = await getOrCreatePassengerClientId();
  const params = new URLSearchParams({
    appClientId,
    page: String(page),
    pageSize: '20',
  });
  const res = await passengerFetch(`/passenger/orders?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as PassengerOrderHistoryPage;
}

export async function hidePassengerOrderFromHistory(orderId: string): Promise<void> {
  const res = await passengerFetch(`/passenger/orders/${encodeURIComponent(orderId)}/history`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
