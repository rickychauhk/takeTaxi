import {
  PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT,
  parsePassengerNearbyDriversRadiusKm,
  passengerNearbyDriversRadiusMeters,
} from '@taxima/shared';
import { getApiBaseUrl } from './config';

export type PassengerMapConfig = {
  nearbyDriversRadiusKm: number;
  nearbyDriversRadiusM: number;
};

export async function fetchPassengerMapConfig(): Promise<PassengerMapConfig> {
  const fallbackKm = PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT;
  const fallbackM = passengerNearbyDriversRadiusMeters(fallbackKm);
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/passenger-map-config`);
    if (!res.ok) {
      return { nearbyDriversRadiusKm: fallbackKm, nearbyDriversRadiusM: fallbackM };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const km = parsePassengerNearbyDriversRadiusKm(data.nearbyDriversRadiusKm);
    const radiusM = Number(data.nearbyDriversRadiusM);
    return {
      nearbyDriversRadiusKm: km,
      nearbyDriversRadiusM:
        Number.isFinite(radiusM) && radiusM > 0 ? radiusM : passengerNearbyDriversRadiusMeters(km),
    };
  } catch {
    return { nearbyDriversRadiusKm: fallbackKm, nearbyDriversRadiusM: fallbackM };
  }
}
