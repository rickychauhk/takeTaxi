import type { LatLng } from '../constants/demoDestinations';
import { resolveLabelForCoords } from './resolveLabelForCoords';

const COORD_LABEL = /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/;

export function labelLooksIncomplete(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (COORD_LABEL.test(t)) return true;
  return t.length < 6;
}

/** 落單前盡量用 reverse geocode 嘅完整地址（同 App 顯示一致） */
export async function ensureFullPlaceLabel(place: LatLng): Promise<LatLng> {
  if (!labelLooksIncomplete(place.label)) return place;
  const label = await resolveLabelForCoords(place.latitude, place.longitude);
  return { ...place, label };
}
