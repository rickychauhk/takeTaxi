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

/** 落單儲存：英文 demo／座標 → 繁中 */
export function addressForOrderStorage(
  addressText: string,
  lat: number,
  lng: number,
): string {
  const text = addressText.trim();
  if (/[\u3400-\u9fff]/.test(text)) return text;

  const lower = text.toLowerCase();
  for (const d of DEMO_DESTINATIONS) {
    if (d.labelEn.toLowerCase() === lower) return d.label;
  }
  for (const d of DEMO_DESTINATIONS) {
    const en = d.labelEn.toLowerCase();
    if (lower.includes(en) || en.includes(lower)) return d.label;
  }

  let best = 250;
  let zh: string | null = null;
  for (const d of DEMO_DESTINATIONS) {
    const dist = haversineMeters(lat, lng, d.latitude, d.longitude);
    if (dist < best) {
      best = dist;
      zh = d.label;
    }
  }
  if (zh) return zh;

  return text;
}
