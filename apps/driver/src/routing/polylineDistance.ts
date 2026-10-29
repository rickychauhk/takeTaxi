type Coord = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;

function haversineMeters(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polylineLengthMeters(coords: Coord[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1]!, coords[i]!);
  }
  return total;
}
