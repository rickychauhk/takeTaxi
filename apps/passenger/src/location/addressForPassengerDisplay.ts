import { getAppLocale } from '../i18n';
import { DEMO_DESTINATIONS } from '../constants/demoDestinations';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 乘客 App 畫面：英文介面時將 CRM／API 繁中地址轉為英文（已知 demo 點） */
export function localizedAddressForPassenger(
  addressText: string,
  lat: number,
  lng: number,
): string {
  if (getAppLocale() !== 'en') return addressText;

  const text = addressText.trim();
  for (const d of DEMO_DESTINATIONS) {
    if (d.label === text) return d.labelEn;
  }
  for (const d of DEMO_DESTINATIONS) {
    if (haversineMeters(lat, lng, d.latitude, d.longitude) < 120) {
      return d.labelEn;
    }
  }
  return addressText;
}
