import { haversineKm } from './haversineKm';
import type { OrderOffer } from '../types/order';
import type { DriverPickupRadiusKm } from '../settings/driverPickupRadius';

export function isUnlimitedPickupRadius(maxKm: DriverPickupRadiusKm): boolean {
  return maxKm == null;
}

/** 待接預約（用車時間在未來）— 不受接單公里數限制 */
export function isFutureScheduledOffer(
  offer: Pick<OrderOffer, 'scheduledAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (!offer.scheduledAt?.trim()) return false;
  const t = Date.parse(offer.scheduledAt);
  return Number.isFinite(t) && t > nowMs;
}

export function pickupDistanceKmFromDriver(
  driver: { latitude: number; longitude: number } | null | undefined,
  order: Pick<OrderOffer, 'pickupCoord'>,
): number | null {
  const p = order.pickupCoord;
  if (!driver || !p) return null;
  const km = haversineKm(driver.latitude, driver.longitude, p.latitude, p.longitude);
  if (!Number.isFinite(km)) return null;
  return Math.round(km * 10) / 10;
}

/** 已設公里數時：無 GPS 或無上車點座標 → 唔顯示（避免公海單無限制露出） */
export function orderWithinPickupRadius(
  driver: { latitude: number; longitude: number } | null | undefined,
  order: OrderOffer,
  maxKm: DriverPickupRadiusKm,
): boolean {
  if (isUnlimitedPickupRadius(maxKm)) return true;
  if (!driver) return false;
  if (!order.pickupCoord) return false;
  const km = haversineKm(
    driver.latitude,
    driver.longitude,
    order.pickupCoord.latitude,
    order.pickupCoord.longitude,
  );
  return km <= maxKm + 0.05;
}

export function filterOrdersByPickupRadius(
  orders: OrderOffer[],
  driver: { latitude: number; longitude: number } | null | undefined,
  maxKm: DriverPickupRadiusKm,
  keepOrder?: (order: OrderOffer) => boolean,
): OrderOffer[] {
  if (isUnlimitedPickupRadius(maxKm)) return orders;
  return orders.filter(
    (o) => (keepOrder?.(o) ?? false) || orderWithinPickupRadius(driver, o, maxKm),
  );
}

/** 保留 API 行車距離；僅喺未有 km 時補直線距離 */
export function enrichOrdersWithPickupDistance(
  orders: OrderOffer[],
  driver: { latitude: number; longitude: number } | null | undefined,
): OrderOffer[] {
  return orders.map((o) => {
    if (o.pickupDistanceKm != null && o.pickupDistanceKm > 0) return o;
    const km = pickupDistanceKmFromDriver(driver, o);
    return km != null ? { ...o, pickupDistanceKm: km } : o;
  });
}

/** GPS 變更時暫用直線 km，等 API 再下行車距離 */
export function enrichOrdersWithStraightPickupDistance(
  orders: OrderOffer[],
  driver: { latitude: number; longitude: number } | null | undefined,
): OrderOffer[] {
  return orders.map((o) => {
    const km = pickupDistanceKmFromDriver(driver, o);
    return km != null ? { ...o, pickupDistanceKm: km } : o;
  });
}
