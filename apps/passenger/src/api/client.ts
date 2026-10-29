import {
  passengerNearbyDriversRadiusMeters,
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT,
  reportApiFetchFailure,
  reportApiFetchSuccess,
} from '@taxima/shared';
import Constants from 'expo-constants';

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://app.hktaketaxi.online/api/v1';

/** 後端設定未載入時的後備值 */
export const PASSENGER_NEARBY_DRIVERS_RADIUS_M = passengerNearbyDriversRadiusMeters(
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT,
);

export type NearbyDriver = {
  driver_id: string;
  lat: number;
  lng: number;
  distance_m: number;
  heading?: number | null;
};

function normalizeNearbyDriver(row: unknown): NearbyDriver | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const rawId = r.driver_id ?? r.driverId;
  if (rawId == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const headingRaw = r.heading ?? r.bearing;
  const heading =
    headingRaw != null && Number.isFinite(Number(headingRaw)) ? Number(headingRaw) : null;
  return {
    driver_id: String(rawId),
    lat: Number(lat),
    lng: Number(lng),
    distance_m: Number(r.distance_m ?? 0),
    heading,
  };
}

export async function fetchNearbyDrivers(
  lat: number,
  lng: number,
  radius = PASSENGER_NEARBY_DRIVERS_RADIUS_M,
  limit = 48,
): Promise<NearbyDriver[]> {
  const url = `${baseUrl}/realtime/nearby-drivers?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`;
  try {
    const res = await fetch(url);
    reportApiFetchSuccess();
    if (!res.ok) return [];
    const data = (await res.json()) as unknown[];
    if (!Array.isArray(data)) return [];
    return data.map(normalizeNearbyDriver).filter((d): d is NearbyDriver => d != null);
  } catch (error) {
    reportApiFetchFailure(error);
    return [];
  }
}
