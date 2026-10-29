import { offsetByMeters } from './navigationGeometry';
import type { GeoPoint } from '../types/order';

/** 用 fitToCoordinates 包住接單範圍圓 */
export function pickupRadiusCircleBounds(center: GeoPoint, radiusKm: number): GeoPoint[] {
  const meters = radiusKm * 1000;
  return [
    offsetByMeters(center, 0, meters),
    offsetByMeters(center, 90, meters),
    offsetByMeters(center, 180, meters),
    offsetByMeters(center, 270, meters),
  ];
}

export function pickupRadiusMeters(radiusKm: number): number {
  return Math.round(radiusKm * 1000);
}
