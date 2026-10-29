import * as Location from 'expo-location';
import { findHkDemoPlaceForLabel } from '@taxima/shared';
import type { LatLng } from '../constants/latLng';
import { forwardGeocodeHongKong } from './forwardGeocodeHongKong';

/** 無法 geocode 時的暫用座標（同步預覽用；落單前應 resolve 成功） */
export const SHOOT_HK_FALLBACK_COORD = { latitude: 22.3193, longitude: 114.1694 };

function hkGeocodeQuery(query: string): string {
  const t = query.trim();
  if (!t) return t;
  if (t.includes('香港') || t.includes('Hong Kong')) return t;
  return `${t}, Hong Kong`;
}

function placeFromDemoLabel(label: string): LatLng | null {
  const demo = findHkDemoPlaceForLabel(label);
  if (!demo) return null;
  return { latitude: demo.latitude, longitude: demo.longitude, label: demo.labelZh };
}

/** 出貨頁同步：已知地標即對齊；否則暫用 fallback（等 resolve 更新） */
export function shootPlaceFromLabel(text: string): LatLng {
  const label = text.trim();
  const fromDemo = label ? placeFromDemoLabel(label) : null;
  if (fromDemo) return fromDemo;
  return { ...SHOOT_HK_FALLBACK_COORD, label };
}

export function isUnresolvedShootFallback(place: LatLng, labelText: string): boolean {
  const trimmed = labelText.trim();
  if (!trimmed) return true;
  if (placeFromDemoLabel(trimmed)) return false;
  return (
    Math.abs(place.latitude - SHOOT_HK_FALLBACK_COORD.latitude) < 1e-5 &&
    Math.abs(place.longitude - SHOOT_HK_FALLBACK_COORD.longitude) < 1e-5
  );
}

/** 出貨地址：地標 → Google geocode → 系統 geocode → fallback */
export async function resolveShootPlaceFromLabel(text: string): Promise<LatLng> {
  const label = text.trim();
  if (!label) return { ...SHOOT_HK_FALLBACK_COORD, label: '' };

  const fromDemo = placeFromDemoLabel(label);
  if (fromDemo) return fromDemo;

  const google = await forwardGeocodeHongKong(label);
  if (google) {
    return { latitude: google.latitude, longitude: google.longitude, label };
  }

  try {
    const rows = await Location.geocodeAsync(hkGeocodeQuery(label));
    const row = rows[0];
    if (row && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
      return { latitude: row.latitude, longitude: row.longitude, label };
    }
  } catch {
    /* geocoder unavailable */
  }

  return { ...SHOOT_HK_FALLBACK_COORD, label };
}

export async function resolveShootPlacesForPost(
  pickupText: string,
  dropoffText: string,
): Promise<{ pickup: LatLng; dropoff: LatLng } | { error: 'pickup' | 'dropoff' }> {
  const [pickup, dropoff] = await Promise.all([
    resolveShootPlaceFromLabel(pickupText),
    resolveShootPlaceFromLabel(dropoffText),
  ]);
  if (isUnresolvedShootFallback(pickup, pickupText)) {
    return { error: 'pickup' };
  }
  if (isUnresolvedShootFallback(dropoff, dropoffText)) {
    return { error: 'dropoff' };
  }
  return { pickup, dropoff };
}
