import * as Location from 'expo-location';
import { findHkDemoPlaceForLabel } from '@taxima/shared';
import type { LatLng } from '../constants/demoDestinations';
import { fetchPlaceSearchFromApi } from '../api/placeSearchApi';
import { searchGooglePlacesForward } from './googleForwardPlaceSearch';

const HK_FALLBACK = { latitude: 22.3193, longitude: 114.1694 };

function hkGeocodeQuery(query: string): string {
  const t = query.trim();
  if (!t) return t;
  if (t.includes('香港') || t.includes('Hong Kong')) return t;
  return `${t}, Hong Kong`;
}

/**
 * 乘客手動輸入地址：保留使用者輸入文字為 label；
 * 座標盡量 geocode，失敗則用 near／香港中心（仍可以該地址落單）。
 */
export async function resolvePassengerPlaceFromManualText(
  text: string,
  near?: { latitude: number; longitude: number } | null,
): Promise<LatLng | null> {
  const label = text.trim();
  if (!label) return null;

  const demo = findHkDemoPlaceForLabel(label);
  if (demo) {
    return { latitude: demo.latitude, longitude: demo.longitude, label: demo.labelZh };
  }

  try {
    const apiHits = await fetchPlaceSearchFromApi(label, near ?? undefined);
    const hit = apiHits[0];
    if (hit) {
      return { latitude: hit.latitude, longitude: hit.longitude, label };
    }
  } catch {
    /* API search optional */
  }

  try {
    const google = await searchGooglePlacesForward(label, near ?? undefined);
    const hit = google[0];
    if (hit) {
      return { latitude: hit.latitude, longitude: hit.longitude, label };
    }
  } catch {
    /* Google optional */
  }

  try {
    const rows = await Location.geocodeAsync(hkGeocodeQuery(label));
    const row = rows[0];
    if (row && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
      return { latitude: row.latitude, longitude: row.longitude, label };
    }
  } catch {
    /* system geocoder optional */
  }

  const anchor = near ?? HK_FALLBACK;
  return { latitude: anchor.latitude, longitude: anchor.longitude, label };
}
