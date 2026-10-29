import type { LatLng } from '../constants/latLng';

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function straightLineRoute(pickup: LatLng, dropoff: LatLng) {
  const coordinates = [
    { latitude: pickup.latitude, longitude: pickup.longitude },
    { latitude: dropoff.latitude, longitude: dropoff.longitude },
  ];
  const distanceMeters = haversineMeters(pickup, dropoff);
  const durationSeconds = Math.max(60, Math.round((distanceMeters / 1000 / 25) * 3600));
  return { coordinates, distanceMeters, durationSeconds };
}
