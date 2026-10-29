import type { GeoPoint } from '../types/order';

/** 香港及鄰近（大嶼山、西貢、深圳灣口岸一帶） */
export const HK_LAT_MIN = 22.08;
export const HK_LAT_MAX = 22.58;
export const HK_LNG_MIN = 113.83;
export const HK_LNG_MAX = 114.52;

export function isLikelyHongKongCoord(p: GeoPoint): boolean {
  return (
    p.latitude >= HK_LAT_MIN &&
    p.latitude <= HK_LAT_MAX &&
    p.longitude >= HK_LNG_MIN &&
    p.longitude <= HK_LNG_MAX
  );
}

/** API 偶爾 lat/lng 對調；只喺其中一種組合落喺香港時修正 */
export function normalizeHongKongCoord(p: GeoPoint): GeoPoint | null {
  if (isLikelyHongKongCoord(p)) return p;
  const swapped = { latitude: p.longitude, longitude: p.latitude };
  if (isLikelyHongKongCoord(swapped)) return swapped;
  return null;
}

/** 模擬器預設 GPS 常喺台灣／美國；若目的地喺香港而司機位置離譜，唔好跟車鏡頭 */
export function driverCoordForTripNavigation(
  driver: GeoPoint | null,
  destination: GeoPoint | null,
): GeoPoint | null {
  if (!driver) return null;
  if (!destination) return driver;

  const destHk = isLikelyHongKongCoord(destination);
  const driverHk = isLikelyHongKongCoord(driver);
  const distM = haversineMetersApprox(driver, destination);

  if (destHk && !driverHk && distM > 25_000) return null;
  if (distM > 150_000) return null;
  return driver;
}

function haversineMetersApprox(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
