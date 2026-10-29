import { apiFetch } from './client';
import { driverHttpErrorMessage, formatDriverApiError } from './parseDriverApiError';

export type DriverAvailableOrderDto = {
  orderId: string;
  orderType: string;
  postedByDriverId?: string | null;
  status: string;
  fareEstimate: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  stopCount: number;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupDistanceKm?: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  createdAt: string;
  scheduledAt?: string | null;
  passengerPointsRedeemed?: number | null;
  passengerPointsDiscountHkd?: number | null;
  passengerPointsHkdPerPointAtOrder?: number | null;
  driverPointsCostAtOrder?: number | null;
  driverPointsBusySurcharge?: number | null;
  driverBusyRegionRewardPoints?: number | null;
  driverBusyRegionFromArea?: string | null;
  driverBusyRegionToArea?: string | null;
  driverPostBountyPoints?: number | null;
  passengerPhone?: string | null;
  postedByDriverPhone?: string | null;
  passengerContactCall?: boolean;
  passengerContactSms?: boolean;
  bookingOptionLines?: string[];
  driverPostGuestPhone?: string | null;
  driverPostOwnerPhone?: string | null;
};

export async function fetchDriverActiveOrder(
  driverId: string,
): Promise<DriverAvailableOrderDto | null> {
  const res = await apiFetch(
    `/driver/orders/active?driverId=${encodeURIComponent(driverId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, text));
  }
  const data = await res.json();
  if (!data || typeof data !== 'object') return null;
  return data as DriverAvailableOrderDto;
}

export async function fetchAvailableOrders(
  driverId: string,
  maxPickupRadiusKm?: number | null,
  driverCoord?: { latitude: number; longitude: number } | null,
): Promise<DriverAvailableOrderDto[]> {
  const radiusQ =
    maxPickupRadiusKm != null && maxPickupRadiusKm > 0
      ? `&maxPickupRadiusKm=${encodeURIComponent(String(maxPickupRadiusKm))}`
      : '';
  const geoQ =
    driverCoord &&
    maxPickupRadiusKm != null &&
    maxPickupRadiusKm > 0
      ? `&driverLat=${encodeURIComponent(String(driverCoord.latitude))}&driverLng=${encodeURIComponent(String(driverCoord.longitude))}`
      : '';
  const res = await apiFetch(
    `/driver/orders/available?driverId=${encodeURIComponent(driverId)}${radiusQ}${geoQ}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, text));
  }
  const data = (await res.json()) as DriverAvailableOrderDto[];
  return Array.isArray(data) ? data : [];
}

export async function fetchScheduledOrders(
  driverId: string,
  maxPickupRadiusKm?: number | null,
  driverCoord?: { latitude: number; longitude: number } | null,
): Promise<DriverAvailableOrderDto[]> {
  const radiusQ =
    maxPickupRadiusKm != null && maxPickupRadiusKm > 0
      ? `&maxPickupRadiusKm=${encodeURIComponent(String(maxPickupRadiusKm))}`
      : '';
  const geoQ =
    driverCoord &&
    maxPickupRadiusKm != null &&
    maxPickupRadiusKm > 0
      ? `&driverLat=${encodeURIComponent(String(driverCoord.latitude))}&driverLng=${encodeURIComponent(String(driverCoord.longitude))}`
      : '';
  const res = await apiFetch(
    `/driver/orders/scheduled?driverId=${encodeURIComponent(driverId)}${radiusQ}${geoQ}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, text));
  }
  const data = (await res.json()) as DriverAvailableOrderDto[];
  return Array.isArray(data) ? data : [];
}

export async function acceptDriverOrder(
  driverId: string,
  orderId: string,
  driverGps?: { lat: number; lng: number },
): Promise<void> {
  const geoQ =
    driverGps &&
    Number.isFinite(driverGps.lat) &&
    Number.isFinite(driverGps.lng)
      ? `&driverLat=${encodeURIComponent(String(driverGps.lat))}&driverLng=${encodeURIComponent(String(driverGps.lng))}`
      : '';
  const res = await apiFetch(
    `/driver/orders/${encodeURIComponent(orderId)}/accept?driverId=${encodeURIComponent(driverId)}${geoQ}`,
    { method: 'PATCH' },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatDriverApiError(text, `接單失敗（${res.status}）`, res.status));
  }
}

export type DriverOrderStatus = 'en_route' | 'in_trip' | 'completed';

export async function cancelDriverOrder(
  driverId: string,
  orderId: string,
  cancelReportCode?: string,
): Promise<void> {
  const res = await apiFetch(
    `/driver/orders/${encodeURIComponent(orderId)}/cancel?driverId=${encodeURIComponent(driverId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(
        cancelReportCode?.trim() ? { cancelReportCode: cancelReportCode.trim() } : {},
      ),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatDriverApiError(text, `取消訂單失敗（${res.status}）`, res.status));
  }
}

export async function releaseDriverOrder(driverId: string, orderId: string): Promise<void> {
  const res = await apiFetch(
    `/driver/orders/${encodeURIComponent(orderId)}/release?driverId=${encodeURIComponent(driverId)}`,
    { method: 'PATCH' },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatDriverApiError(text, `放出失敗（${res.status}）`, res.status));
  }
}

export async function updateDriverOrderStatus(
  driverId: string,
  orderId: string,
  status: DriverOrderStatus,
): Promise<void> {
  const res = await apiFetch(
    `/driver/orders/${encodeURIComponent(orderId)}/status?driverId=${encodeURIComponent(driverId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, text));
  }
}

export async function postDriverLocation(driverId: string, lat: number, lng: number): Promise<void> {
  const res = await apiFetch('/realtime/location', {
    method: 'POST',
    body: JSON.stringify({ userId: driverId, role: 'driver', lat, lng }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, text));
  }
}
