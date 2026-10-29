import type { DriverAvailableOrderDto } from './orders';
import { haversineKm, tripDistanceKmFromCoords } from '../geo/haversineKm';
import { normalizeHongKongCoord } from '../geo/hkCoords';
import type { OrderOffer } from '../types/order';

export function mapAvailableOrderToOffer(
  row: DriverAvailableOrderDto,
  driverCoord?: { latitude: number; longitude: number } | null,
): OrderOffer {
  const fare = row.fareEstimate != null ? Number(row.fareEstimate) : 0;
  const legacyId = (row as DriverAvailableOrderDto & { id?: string }).id;
  const pickupCoord =
    row.pickupLat != null && row.pickupLng != null
      ? normalizeHongKongCoord({ latitude: row.pickupLat, longitude: row.pickupLng }) ?? undefined
      : undefined;
  const dropoffCoord =
    row.dropoffLat != null && row.dropoffLng != null
      ? normalizeHongKongCoord({ latitude: row.dropoffLat, longitude: row.dropoffLng }) ?? undefined
      : undefined;
  return {
    id: row.orderId ?? legacyId ?? '',
    orderType: row.orderType,
    postedByDriverId: row.postedByDriverId ?? null,
    pickupLabel: row.pickupAddress?.trim() || '上車點',
    dropoffLabel: row.dropoffAddress?.trim() || '目的地',
    fareEstimateHkd: Number.isFinite(fare) ? Math.round(fare) : 0,
    passengerPointsRedeemed: row.passengerPointsRedeemed ?? null,
    passengerPointsDiscountHkd: row.passengerPointsDiscountHkd ?? null,
    passengerPointsHkdPerPointAtOrder: row.passengerPointsHkdPerPointAtOrder ?? null,
    driverPointsCostAtOrder: row.driverPointsCostAtOrder ?? null,
    driverPointsBusySurcharge: row.driverPointsBusySurcharge ?? null,
    driverBusyRegionRewardPoints: row.driverBusyRegionRewardPoints ?? null,
    driverBusyRegionFromArea: row.driverBusyRegionFromArea ?? null,
    driverBusyRegionToArea: row.driverBusyRegionToArea ?? null,
    driverPostBountyPoints: row.driverPostBountyPoints ?? null,
    passengerPhone: row.passengerPhone ?? null,
    postedByDriverPhone: row.postedByDriverPhone ?? null,
    passengerContactCall: !!row.passengerContactCall,
    passengerContactSms: !!row.passengerContactSms,
    bookingOptionLines: Array.isArray(row.bookingOptionLines) ? row.bookingOptionLines : [],
    driverPostGuestPhone: row.driverPostGuestPhone ?? null,
    driverPostOwnerPhone: row.driverPostOwnerPhone ?? null,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt ?? null,
    orderStatus: row.status,
    distanceKm: tripDistanceKmFromCoords(pickupCoord, dropoffCoord),
    pickupDistanceKm:
      row.pickupDistanceKm != null && Number.isFinite(Number(row.pickupDistanceKm))
        ? Math.round(Number(row.pickupDistanceKm) * 10) / 10
        : driverCoord && pickupCoord
          ? Math.round(
              haversineKm(
                driverCoord.latitude,
                driverCoord.longitude,
                pickupCoord.latitude,
                pickupCoord.longitude,
              ) * 10,
            ) / 10
          : null,
    /** API 有回傳 pickupDistanceKm 時為行車路線；否則 App 暫用直線 */
    pickupDistanceIsDriving:
      row.pickupDistanceKm != null && Number.isFinite(Number(row.pickupDistanceKm)),
    pickupCoord,
    dropoffCoord,
  };
}
