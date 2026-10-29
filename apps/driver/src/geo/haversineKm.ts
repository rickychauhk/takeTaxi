/** 兩點直線距離（公里），用於柯打概略行程長度。 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
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

export function tripDistanceKmFromCoords(
  pickup: { latitude: number; longitude: number } | undefined,
  dropoff: { latitude: number; longitude: number } | undefined,
): number {
  if (!pickup || !dropoff) return 0;
  const km = haversineKm(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.round(km * 10) / 10;
}
