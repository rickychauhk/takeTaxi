export const PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY = 'passenger_tip_hkd_wheelchair';
export const PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY = 'passenger_tip_hkd_safe_driving';
export const PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY = 'passenger_tip_hkd_five_seat';
export const PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY = 'passenger_tip_hkd_six_seat';
export const PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY = 'passenger_tip_hkd_large_luggage';

export const PASSENGER_TIP_HKD_WHEELCHAIR_DEFAULT = 10;
export const PASSENGER_TIP_HKD_SAFE_DRIVING_DEFAULT = 10;
export const PASSENGER_TIP_HKD_FIVE_SEAT_DEFAULT = 10;
export const PASSENGER_TIP_HKD_SIX_SEAT_DEFAULT = 10;
export const PASSENGER_TIP_HKD_LARGE_LUGGAGE_DEFAULT = 10;

export const PASSENGER_AUTO_TIP_SETTING_KEYS = [
  PASSENGER_TIP_HKD_WHEELCHAIR_SETTING_KEY,
  PASSENGER_TIP_HKD_SAFE_DRIVING_SETTING_KEY,
  PASSENGER_TIP_HKD_FIVE_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_SIX_SEAT_SETTING_KEY,
  PASSENGER_TIP_HKD_LARGE_LUGGAGE_SETTING_KEY,
] as const;

export type PassengerAutoTipHkdPublic = {
  wheelchairTipHkd: number;
  safeDrivingTipHkd: number;
  fiveSeatTipHkd: number;
  sixSeatTipHkd: number;
  largeLuggageTipHkd: number;
};

export function defaultPassengerAutoTipHkdPublic(): PassengerAutoTipHkdPublic {
  return {
    wheelchairTipHkd: PASSENGER_TIP_HKD_WHEELCHAIR_DEFAULT,
    safeDrivingTipHkd: PASSENGER_TIP_HKD_SAFE_DRIVING_DEFAULT,
    fiveSeatTipHkd: PASSENGER_TIP_HKD_FIVE_SEAT_DEFAULT,
    sixSeatTipHkd: PASSENGER_TIP_HKD_SIX_SEAT_DEFAULT,
    largeLuggageTipHkd: PASSENGER_TIP_HKD_LARGE_LUGGAGE_DEFAULT,
  };
}

export function isPassengerAutoTipSettingKey(key: string): boolean {
  return (PASSENGER_AUTO_TIP_SETTING_KEYS as readonly string[]).includes(key);
}

/** CRM 設定的自動貼士（港元，非負整數） */
export function parsePassengerAutoTipHkd(
  raw: string | null | undefined,
  fallback: number,
): number {
  const n = Math.round(Number(String(raw ?? '').trim()));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
