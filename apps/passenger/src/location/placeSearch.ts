import * as Location from 'expo-location';
import { DEMO_DESTINATIONS, toLocalizedLatLng, type LatLng } from '../constants/demoDestinations';
import { fetchPlaceSearchFromApi } from '../api/placeSearchApi';
import { searchGooglePlacesForward } from './googleForwardPlaceSearch';
import { resolveLabelForCoords } from './resolveLabelForCoords';

export type PlaceSuggestion = LatLng & { id: string };

function demoMatches(query: string): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DEMO_DESTINATIONS.filter(
    (d) => d.label.toLowerCase().includes(q) || d.labelEn.toLowerCase().includes(q),
  ).map((d, i) => ({
    ...toLocalizedLatLng(d),
    id: `demo-${i}-${d.label}`,
  }));
}

function hkGeocodeQuery(query: string): string {
  const t = query.trim();
  if (!t) return t;
  if (t.includes('香港') || t.includes('Hong Kong')) return t;
  return `${t}, Hong Kong`;
}

export async function searchPlaces(query: string, near?: { latitude: number; longitude: number }): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    if (near) {
      return [...DEMO_DESTINATIONS]
        .map((d) => ({
          ...d,
          dist:
            (d.latitude - near.latitude) ** 2 + (d.longitude - near.longitude) ** 2,
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 8)
        .map((d, i) => ({ ...toLocalizedLatLng(d), id: `near-${i}` }));
    }
    return DEMO_DESTINATIONS.slice(0, 5).map((d, i) => ({
      ...toLocalizedLatLng(d),
      id: `default-${i}`,
    }));
  }

  const fromDemo = demoMatches(trimmed);
  let fromGeocoder: PlaceSuggestion[] = [];
  try {
    fromGeocoder = await fetchPlaceSearchFromApi(trimmed, near);
  } catch {
    fromGeocoder = [];
  }
  if (fromGeocoder.length < 4) {
    try {
      const local = await searchGooglePlacesForward(trimmed, near);
      fromGeocoder = [...fromGeocoder, ...local];
    } catch {
      /* client google failed */
    }
  }
  if (fromGeocoder.length < 8) {
    try {
      const rows = await Location.geocodeAsync(hkGeocodeQuery(trimmed));
      const expoItems = rows.slice(0, 6).map((row, i) => ({
        id: `geo-${i}-${row.latitude}-${row.longitude}`,
        latitude: row.latitude,
        longitude: row.longitude,
        label: trimmed,
      }));
      await Promise.all(
        expoItems.map(async (item) => {
          try {
            item.label = await resolveLabelForCoords(item.latitude, item.longitude);
          } catch {
            /* keep query as label */
          }
        }),
      );
      fromGeocoder = [...fromGeocoder, ...expoItems];
    } catch {
      /* geocoder unavailable */
    }
  }

  const seen = new Set<string>();
  const merged: PlaceSuggestion[] = [];
  for (const item of [...fromGeocoder, ...fromDemo]) {
    const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  const q = trimmed.replace(/\s+/g, '').toLowerCase();
  merged.sort((a, b) => {
    const score = (label: string) => {
      const l = label.replace(/\s+/g, '').toLowerCase();
      if (l.includes(q)) return 0;
      const block = q.match(/([一二三四五六七八九十\d]+座|第\d+座)/);
      if (block && !l.includes(block[1]!)) return 2;
      return 1;
    };
    return score(a.label) - score(b.label);
  });
  return merged.slice(0, 12);
}
