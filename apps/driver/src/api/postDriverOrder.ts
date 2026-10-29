import { snapLatLngToKnownHkPlace } from '@taxima/shared';
import { apiFetch } from './client';
import { formatDriverApiError } from './parseDriverApiError';
import { ensureChineseOrderLabel } from '../location/labelForOrderStorage';
import type { LatLng } from '../constants/latLng';

export const DRIVER_POST_BOUNTY_OPTIONS = [0, 3, 5, 8, 12] as const;
export type DriverPostBountyPoints = (typeof DRIVER_POST_BOUNTY_OPTIONS)[number];

export type PostDriverOrderPayload = {
  driverId: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  fareEstimate: number;
  estimateDistanceMeters: number;
  bountyPoints: DriverPostBountyPoints;
  tipHkd?: number;
  remark?: string;
  selectedOptionIds?: number[];
  sixSeat?: boolean;
  paymentMethods?: ('octopus' | 'alipay' | 'wechat' | 'fps')[];
  scheduledAt?: string;
};

export type PostDriverOrderResult = {
  id: string;
  status: string;
  orderType: string;
  fareEstimate: string | null;
  driverPostBountyPoints: number;
};

async function chineseEndpoint(place: { lat: number; lng: number; label: string }) {
  const normalized: LatLng = await ensureChineseOrderLabel(
    snapLatLngToKnownHkPlace({
      latitude: place.lat,
      longitude: place.lng,
      label: place.label,
    }),
  );
  return { lat: normalized.latitude, lng: normalized.longitude, label: normalized.label };
}

export async function postDriverOrder(payload: PostDriverOrderPayload): Promise<PostDriverOrderResult> {
  const [pickup, dropoff] = await Promise.all([
    chineseEndpoint(payload.pickup),
    chineseEndpoint(payload.dropoff),
  ]);
  const res = await apiFetch('/driver/orders/post', {
    method: 'POST',
    body: JSON.stringify({ ...payload, pickup, dropoff }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatDriverApiError(text, `發單失敗（${res.status}）`, res.status));
  }
  return (await res.json()) as PostDriverOrderResult;
}
