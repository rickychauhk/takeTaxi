import { addressForCrmDisplay, snapLatLngToKnownHkPlace } from '@taxima/shared';
import type { LatLng } from '../constants/latLng';
import { reverseGeocodeChinese } from './reverseGeocodeChinese';

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

/** 發柯打／介面顯示用繁中地址 */
export async function ensureChineseOrderLabel(place: LatLng): Promise<LatLng> {
  let current = snapLatLngToKnownHkPlace(place);
  if (hasCjk(current.label.trim())) {
    return snapLatLngToKnownHkPlace(current);
  }
  const zh = await reverseGeocodeChinese(current.latitude, current.longitude);
  if (zh?.trim() && hasCjk(zh)) {
    return snapLatLngToKnownHkPlace({ ...current, label: zh.trim() });
  }
  const demo = addressForCrmDisplay(current.label, current.latitude, current.longitude);
  if (demo?.trim() && hasCjk(demo)) {
    return snapLatLngToKnownHkPlace({ ...current, label: demo.trim() });
  }
  return current;
}
