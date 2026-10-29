import * as Location from 'expo-location';
import { DEMO_DESTINATIONS, toLocalizedLatLng, type LatLng } from '../constants/demoDestinations';
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
    const rows = await Location.geocodeAsync(hkGeocodeQuery(trimmed));
    fromGeocoder = rows.slice(0, 6).map((row, i) => {
      let label = trimmed;
      return {
        id: `geo-${i}-${row.latitude}-${row.longitude}`,
        latitude: row.latitude,
        longitude: row.longitude,
        label,
      };
    });
    // Enrich labels via reverse geocode when possible
    await Promise.all(
      fromGeocoder.map(async (item) => {
        try {
          item.label = await resolveLabelForCoords(item.latitude, item.longitude);
        } catch {
          /* keep query as label */
        }
      }),
    );
  } catch {
    /* geocoder unavailable */
  }

  const seen = new Set<string>();
  const merged: PlaceSuggestion[] = [];
  for (const item of [...fromDemo, ...fromGeocoder]) {
    const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 12);
}
