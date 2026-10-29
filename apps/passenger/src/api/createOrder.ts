import { snapLatLngToKnownHkPlace } from '@taxima/shared';
import { getOrCreatePassengerClientId } from '../storage/passengerClientId';
import { ensureChineseOrderLabel } from '../location/labelForOrderStorage';
import { passengerApiErrorMessage, passengerFetch } from './passengerClient';
import type { LatLng } from '../constants/demoDestinations';
import type { PassengerPaymentMethod } from '../constants/paymentMethods';
import type { BookingExtrasSelection } from '../screens/BookingMoreOptionsScreen';

export type CreateOrderPayload = {
  pickup: LatLng;
  dropoff: LatLng;
  /** 確認叫車頁路線預估駕駛路程（米） */
  estimateDistanceMeters: number;
  fareEstimate: number;
  tipHkd: number;
  extras: BookingExtrasSelection;
  sixSeat?: boolean;
  paymentMethods?: PassengerPaymentMethod[];
  scheduledAt?: string | null;
  pointsToRedeem?: number;
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
  orderContactPhone?: string;
  companyPrice?: boolean;
  safeDriving?: boolean;
};

export type CreateOrderResult = {
  id: string;
  status: string;
  fareEstimate: string | null;
};

/** 落單地址一律繁中（司機端），唔跟乘客 App 語言 */
async function pickupDropoffForApi(pickup: LatLng, dropoff: LatLng): Promise<[LatLng, LatLng]> {
  const normalize = async (place: LatLng): Promise<LatLng> =>
    ensureChineseOrderLabel(snapLatLngToKnownHkPlace(place));
  return Promise.all([normalize(pickup), normalize(dropoff)]);
}

export async function createPassengerOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const fareEstimate = Number(payload.fareEstimate);
  if (!Number.isFinite(fareEstimate) || fareEstimate < 0) {
    throw new Error('HTTP 400');
  }

  const appClientId = await getOrCreatePassengerClientId();
  const [pickup, dropoff] = await pickupDropoffForApi(payload.pickup, payload.dropoff);
  const res = await passengerFetch(
    '/passenger/orders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup: {
          lat: pickup.latitude,
          lng: pickup.longitude,
          label: pickup.label,
        },
        dropoff: {
          lat: dropoff.latitude,
          lng: dropoff.longitude,
          label: dropoff.label,
        },
        fareEstimate,
        estimateDistanceMeters: Math.max(0, Math.round(payload.estimateDistanceMeters)),
        tipHkd: payload.tipHkd,
        appClientId,
        remark: payload.extras.remark,
        selectedOptionIds: payload.extras.selectedOptionIds,
        sixSeat: payload.sixSeat ?? false,
        paymentMethods: payload.paymentMethods ?? [],
        scheduledAt: payload.scheduledAt ?? undefined,
        pointsToRedeem: payload.pointsToRedeem ?? 0,
        passengerContactCall: !!payload.passengerContactCall,
        passengerContactSms: !!payload.passengerContactSms,
        ...(payload.orderContactPhone?.trim()
          ? { orderContactPhone: payload.orderContactPhone.trim() }
          : {}),
        companyPrice: !!payload.companyPrice,
        safeDriving: !!payload.safeDriving,
      }),
    },
    { timeoutMs: 60_000 },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(passengerApiErrorMessage(res.status, text));
  }
  return (await res.json()) as CreateOrderResult;
}
