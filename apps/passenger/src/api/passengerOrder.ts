import Constants from 'expo-constants';
import type { PassengerPaymentMethod } from '../constants/paymentMethods';

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://app.hktaketaxi.online/api/v1';

export type PassengerOrderRebookSnapshot = {
  fareEstimate: number;
  tipHkd: number;
  estimateDistanceMeters: number;
  pointsToRedeem: number;
  sixSeat: boolean;
  paymentMethods: PassengerPaymentMethod[];
  selectedOptionIds: number[];
  remark: string;
  scheduledAt: string | null;
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
  orderContactPhone?: string | null;
  companyPrice?: boolean;
  safeDriving?: boolean;
};

export type PassengerOrderTrack = {
  orderId: string;
  status: string;
  cancelBy?: 'passenger' | 'driver' | 'admin' | 'system' | null;
  rebookSnapshot?: PassengerOrderRebookSnapshot;
  fareEstimate: string | null;
  fareFinal: string | null;
  completedAtHk: string | null;
  tripDistanceKm: number | null;
  pointsEarnedThisTrip: number | null;
  passengerPointsBalance: number | null;
  passengerPointsRedeemed: number | null;
  passengerPointsDiscountHkd: number | null;
  passengerPointsHkdPerPointAtOrder: number | null;
  pickup: { label: string | null; lat: number | null; lng: number | null };
  dropoff: { label: string | null; lat: number | null; lng: number | null };
  driver: {
    id: string;
    displayName: string;
    vehiclePlate: string | null;
    vehicleModel: string | null;
    ratingAvg: number | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  passengerRating: { score: number; comment: string | null } | null;
};

export async function fetchPassengerOrderTrack(orderId: string): Promise<PassengerOrderTrack> {
  const res = await fetch(`${baseUrl}/passenger/orders/${orderId}/track`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as PassengerOrderTrack;
}

export async function cancelPassengerOrder(orderId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/passenger/orders/${orderId}/cancel`, { method: 'PATCH' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
