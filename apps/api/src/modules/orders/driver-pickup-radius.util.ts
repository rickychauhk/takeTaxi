export const DRIVER_PICKUP_RADIUS_KM_OPTIONS = [3, 6, 10] as const;

/** 司機設定：只接收距離上車點在此半徑內的柯打；null = 不限 */
export function parseMaxPickupRadiusKm(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (raw === 'unlimited' || raw === 'null') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 2) return 3;
  if (n === 4) return 6;
  if (DRIVER_PICKUP_RADIUS_KM_OPTIONS.includes(n as (typeof DRIVER_PICKUP_RADIUS_KM_OPTIONS)[number])) {
    return n;
  }
  return null;
}

/** DB `max_pickup_radius_km` → 現行 3 / 6 / 10；無效值當不限 */
export function normalizeStoredPickupRadiusKm(n: number): number | null {
  return parseMaxPickupRadiusKm(n);
}

/** App 即時 GPS（WebSocket / query）；優先於 live_locations 做半徑過濾 */
export function parseDriverPosition(raw: {
  driverLat?: unknown;
  driverLng?: unknown;
}): { lat: number; lng: number } | null {
  const lat = typeof raw.driverLat === 'number' ? raw.driverLat : Number(raw.driverLat);
  const lng = typeof raw.driverLng === 'number' ? raw.driverLng : Number(raw.driverLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 待接預約（用車時間在未來） */
export function isFutureScheduledAt(
  scheduledAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!scheduledAtIso?.trim()) return false;
  const t = Date.parse(scheduledAtIso);
  return Number.isFinite(t) && t > nowMs;
}

export function isWithinDriverPickupRadius(
  driverLat: number | null | undefined,
  driverLng: number | null | undefined,
  pickupLat: number | null | undefined,
  pickupLng: number | null | undefined,
  maxPickupRadiusKm: number | null | undefined,
): boolean {
  if (maxPickupRadiusKm == null || maxPickupRadiusKm <= 0) return true;
  if (
    driverLat == null ||
    driverLng == null ||
    !Number.isFinite(driverLat) ||
    !Number.isFinite(driverLng)
  ) {
    return false;
  }
  if (
    pickupLat == null ||
    pickupLng == null ||
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng)
  ) {
    return false;
  }
  return haversineKm(driverLat, driverLng, pickupLat, pickupLng) <= maxPickupRadiusKm + 0.05;
}
