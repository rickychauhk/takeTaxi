import Constants from 'expo-constants';
import { labelFromGeocodeResult } from './reverseGeocodeChinese';
import type { PlaceSuggestion } from './placeSearch';

const TIMEOUT_MS = 8_000;

function googleMapsKey(): string | null {
  const k =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    '';
  const t = k.trim();
  return t || null;
}

function expandBlockQueries(query: string): string[] {
  const base = query.trim().replace(/\s+/g, '');
  if (!base) return [];
  const variants = new Set<string>([base]);
  const block = base.match(/^(.*?)([一二三四五六七八九十\d]+)座$/);
  if (block) {
    const prefix = block[1] ?? '';
    const numPart = block[2] ?? '';
    const cnMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    let n: number | null = /^\d+$/.test(numPart) ? parseInt(numPart, 10) : null;
    if (n == null && numPart === '十') n = 10;
    if (n == null && numPart.startsWith('十')) n = 10 + (cnMap[numPart[1]!] ?? 0);
    if (n == null && cnMap[numPart]) n = cnMap[numPart];
    if (n != null && n > 0) {
      variants.add(`${prefix}${n}座`);
      variants.add(`${prefix}第${n}座`);
    }
  }
  if (!base.includes('香港') && !/hong kong/i.test(base)) {
    for (const v of [...variants]) {
      variants.add(`${v}, 香港`);
      variants.add(`${v} 香港`);
    }
  }
  return [...variants];
}

function hkQueryVariants(query: string): string[] {
  return expandBlockQueries(query);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function placeDetails(
  placeId: string,
  key: string,
): Promise<{ lat: number; lng: number; label: string } | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry,formatted_address,name',
    language: 'zh-HK',
    region: 'hk',
    key,
  });
  const data = await fetchJson<{
    status?: string;
    result?: {
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    };
  }>(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  if (data?.status !== 'OK' || !data.result?.geometry?.location) return null;
  const lat = data.result.geometry.location.lat;
  const lng = data.result.geometry.location.lng;
  if (lat == null || lng == null) return null;
  const label =
    data.result.name?.trim() ||
    data.result.formatted_address?.trim() ||
    '';
  if (!label) return null;
  return { lat, lng, label };
}

async function autocompleteSearch(
  query: string,
  key: string,
  near?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    input: query,
    components: 'country:hk',
    language: 'zh-HK',
    key,
  });
  if (near) {
    params.set('location', `${near.latitude},${near.longitude}`);
    params.set('radius', '80000');
  }
  const data = await fetchJson<{
    status?: string;
    predictions?: { place_id?: string; description?: string }[];
  }>(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  if (data?.status !== 'OK' || !data.predictions?.length) return [];

  const picks = data.predictions.slice(0, 12);
  const details = await Promise.all(
    picks.map(async (p) => {
      if (!p.place_id) return null;
      const d = await placeDetails(p.place_id, key);
      if (!d) return null;
      return {
        id: `places-${p.place_id}`,
        latitude: d.lat,
        longitude: d.lng,
        label: d.label || p.description?.trim() || query,
      } satisfies PlaceSuggestion;
    }),
  );
  return details.filter((x): x is PlaceSuggestion => x != null);
}

async function textSearch(query: string, key: string, near?: { latitude: number; longitude: number }): Promise<PlaceSuggestion[]> {
  const q = query.includes('香港') ? query : `${query} 香港`;
  const params = new URLSearchParams({ query: q, region: 'hk', language: 'zh-HK', key });
  if (near) params.set('location', `${near.latitude},${near.longitude}`);
  const data = await fetchJson<{
    status?: string;
    results?: { name?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[];
  }>(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  if (data?.status !== 'OK' || !data.results?.length) return [];
  return data.results.slice(0, 10).flatMap((r, i) => {
    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    const label = r.name?.trim() || r.formatted_address?.trim();
    if (lat == null || lng == null || !label) return [];
    return [{ id: `ts-${i}-${lat}`, latitude: lat, longitude: lng, label }];
  });
}

async function geocodeSearch(query: string, key: string): Promise<PlaceSuggestion[]> {
  for (const address of hkQueryVariants(query)) {
    const params = new URLSearchParams({
      address,
      region: 'hk',
      language: 'zh-HK',
      key,
    });
    const data = await fetchJson<{
      status?: string;
      results?: Record<string, unknown>[];
    }>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (data?.status !== 'OK' || !data.results?.length) continue;

    const items: PlaceSuggestion[] = [];
    for (let i = 0; i < Math.min(data.results.length, 10); i++) {
      const r = data.results[i]!;
      const loc = (r as { geometry?: { location?: { lat?: number; lng?: number } } }).geometry
        ?.location;
      if (loc?.lat == null || loc?.lng == null) continue;
      const label =
        labelFromGeocodeResult(r as Parameters<typeof labelFromGeocodeResult>[0]) ?? address;
      items.push({
        id: `ggeo-${i}-${loc.lat}-${loc.lng}`,
        latitude: loc.lat,
        longitude: loc.lng,
        label,
      });
    }
    if (items.length) return items;
  }
  return [];
}

/** Google Places Autocomplete + Geocoding（香港），支援大廈／座數等細緻地址 */
function rankSpecificity(query: string, label: string): number {
  const q = query.replace(/\s+/g, '').toLowerCase();
  const l = label.replace(/\s+/g, '').toLowerCase();
  if (l.includes(q)) return 1000 + q.length;
  const block = q.match(/([一二三四五六七八九十\d]+座|第\d+座)/);
  if (block && !l.includes(block[1]!)) return -200;
  return 0;
}

export async function searchGooglePlacesForward(
  query: string,
  near?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  const key = googleMapsKey();
  const trimmed = query.trim();
  if (!key || trimmed.length < 2) return [];

  const merged = new Map<string, PlaceSuggestion>();
  const add = (items: PlaceSuggestion[]) => {
    for (const item of items) {
      const k = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}|${item.label.trim()}`;
      const prev = merged.get(k);
      if (!prev || rankSpecificity(trimmed, item.label) > rankSpecificity(trimmed, prev.label)) {
        merged.set(k, item);
      }
    }
  };

  for (const q of hkQueryVariants(trimmed)) {
    add(await autocompleteSearch(q, key, near));
    add(await textSearch(q, key, near));
    add(await geocodeSearch(q, key));
    if (merged.size >= 18) break;
  }

  return [...merged.values()]
    .sort((a, b) => rankSpecificity(trimmed, b.label) - rankSpecificity(trimmed, a.label))
    .slice(0, 20);
}
