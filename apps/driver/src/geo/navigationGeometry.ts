import type { GeoPoint } from '../types/order';

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 0–360°，正北為 0，順時針 */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 沿 bearing 前進 meters 米 */
export function offsetByMeters(origin: GeoPoint, bearingDeg: number, meters: number): GeoPoint {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.latitude);
  const lon1 = toRad(origin.longitude);
  const angDist = meters / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: toDeg(lat2), longitude: toDeg(lon2) };
}

export function nearestRouteVertexIndex(driver: GeoPoint, route: GeoPoint[]): number {
  if (route.length === 0) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversineMeters(driver, route[i]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function sliceRouteAhead(
  driver: GeoPoint,
  route: GeoPoint[],
  endHint?: GeoPoint | null,
): GeoPoint[] {
  const end = endHint ?? route[route.length - 1] ?? null;

  const ensureMinTwo = (points: GeoPoint[]): GeoPoint[] => {
    if (points.length >= 2) return points;
    if (end && haversineMeters(driver, end) > 2) {
      return [
        { latitude: driver.latitude, longitude: driver.longitude },
        { latitude: end.latitude, longitude: end.longitude },
      ];
    }
    return points;
  };

  if (route.length < 2) {
    if (end) return ensureMinTwo([driver, end]);
    return route;
  }

  const idx = nearestRouteVertexIndex(driver, route);
  const tail = route.slice(Math.max(0, idx));
  let ahead: GeoPoint[];
  if (tail.length === 0) {
    ahead = [driver, route[route.length - 1]!];
  } else {
    const first = tail[0]!;
    ahead = haversineMeters(driver, first) < 8 ? tail : [driver, ...tail];
  }
  return ensureMinTwo(ahead);
}

export function resolveDriveHeading(
  driver: GeoPoint,
  previous: GeoPoint | null,
  gpsHeading: number | null,
  route: GeoPoint[],
  destination: GeoPoint | null,
): number {
  if (gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0) {
    return gpsHeading;
  }
  if (previous && haversineMeters(previous, driver) > 4) {
    return bearingDegrees(previous, driver);
  }
  if (route.length >= 2) {
    const idx = nearestRouteVertexIndex(driver, route);
    const ahead = route[Math.min(idx + 3, route.length - 1)]!;
    return bearingDegrees(driver, ahead);
  }
  if (destination) return bearingDegrees(driver, destination);
  return 0;
}
