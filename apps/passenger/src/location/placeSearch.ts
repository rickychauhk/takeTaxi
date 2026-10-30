import * as Location from 'expo-location';
import { DEMO_DESTINATIONS, toLocalizedLatLng, type LatLng } from '../constants/demoDestinations';
import { fetchPlaceSearchFromApi } from '../api/placeSearchApi';
import { searchGooglePlacesForward } from './googleForwardPlaceSearch';
import { resolveLabelForCoords } from './resolveLabelForCoords';

export type PlaceSuggestion = LatLng & { id: string };

/** 乘客選點列表上限（盡量俾多啲選擇） */
export const PASSENGER_PLACE_SUGGESTIONS_LIMIT = 20;

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
        .slice(0, PASSENGER_PLACE_SUGGESTIONS_LIMIT)
        .map((d, i) => ({ ...toLocalizedLatLng(d), id: `near-${i}` }));
    }
    return DEMO_DESTINATIONS.map((d, i) => ({
      ...toLocalizedLatLng(d),
      id: `default-${i}`,
    }));
  }

  if (trimmed.length === 1) {
    return demoMatches(trimmed).slice(0, PASSENGER_PLACE_SUGGESTIONS_LIMIT);
  }

  const fromDemo = demoMatches(trimmed);
  const [fromApi, fromGoogle] = await Promise.all([
    fetchPlaceSearchFromApi(trimmed, near).catch(() => [] as PlaceSuggestion[]),
    trimmed.length >= 2
      ? searchGooglePlacesForward(trimmed, near).catch(() => [] as PlaceSuggestion[])
      : Promise.resolve([] as PlaceSuggestion[]),
  ]);
  let fromGeocoder: PlaceSuggestion[] = [...fromApi, ...fromGoogle];
  if (fromGeocoder.length < PASSENGER_PLACE_SUGGESTIONS_LIMIT) {
    try {
      const rows = await Location.geocodeAsync(hkGeocodeQuery(trimmed));
      const expoItems = rows.slice(0, 10).map((row, i) => ({
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
    const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}|${item.label.trim()}`;
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
  return merged.slice(0, PASSENGER_PLACE_SUGGESTIONS_LIMIT);
}
