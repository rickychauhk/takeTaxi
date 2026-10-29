export const PASSENGER_NEARBY_DRIVERS_RADIUS_KM_SETTING_KEY = 'passenger_nearby_drivers_radius_km';

export const PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS = [2, 3, 4, 5] as const;

export type PassengerNearbyDriversRadiusKm = (typeof PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS)[number];

export const PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT: PassengerNearbyDriversRadiusKm = 2;

export function parsePassengerNearbyDriversRadiusKm(raw: unknown): PassengerNearbyDriversRadiusKm {
  const n = Number(String(raw ?? '').trim() || PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT);
  if ((PASSENGER_NEARBY_DRIVERS_RADIUS_KM_OPTIONS as readonly number[]).includes(n)) {
    return n as PassengerNearbyDriversRadiusKm;
  }
  return PASSENGER_NEARBY_DRIVERS_RADIUS_KM_DEFAULT;
}

export function passengerNearbyDriversRadiusMeters(km: number): number {
  return km * 1000;
}
