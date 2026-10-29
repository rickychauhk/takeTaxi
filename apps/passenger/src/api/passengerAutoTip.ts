import { defaultPassengerAutoTipHkdPublic, type PassengerAutoTipHkdPublic } from '@taxima/shared';
import { getApiBaseUrl } from './config';

export type PassengerAutoTipConfig = PassengerAutoTipHkdPublic;

const fallback = defaultPassengerAutoTipHkdPublic();

function parseField(data: Partial<PassengerAutoTipHkdPublic>, key: keyof PassengerAutoTipHkdPublic): number {
  const n = Number(data[key]);
  const fb = fallback[key];
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fb;
}

export async function fetchPassengerAutoTipConfig(): Promise<PassengerAutoTipConfig> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/passenger-auto-tip`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<PassengerAutoTipHkdPublic>;
    return {
      wheelchairTipHkd: parseField(data, 'wheelchairTipHkd'),
      safeDrivingTipHkd: parseField(data, 'safeDrivingTipHkd'),
      fiveSeatTipHkd: parseField(data, 'fiveSeatTipHkd'),
      sixSeatTipHkd: parseField(data, 'sixSeatTipHkd'),
      largeLuggageTipHkd: parseField(data, 'largeLuggageTipHkd'),
    };
  } catch {
    return fallback;
  }
}
