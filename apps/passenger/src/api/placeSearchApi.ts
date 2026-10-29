import { getApiBaseUrl } from './config';
import type { PlaceSuggestion } from '../location/placeSearch';

export async function fetchPlaceSearchFromApi(
  query: string,
  near?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const base = getApiBaseUrl().replace(/\/$/, '');
  const params = new URLSearchParams({ q: trimmed });
  if (near) {
    params.set('lat', String(near.latitude));
    params.set('lng', String(near.longitude));
  }

  const res = await fetch(`${base}/public/places/search?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id: string; label: string; latitude: number; longitude: number }[];
  };
  if (!Array.isArray(data.items)) return [];
  return data.items
    .filter((x) => x && Number.isFinite(x.latitude) && Number.isFinite(x.longitude))
    .map((x) => ({
      id: x.id || `api-${x.latitude}-${x.longitude}`,
      label: x.label?.trim() || trimmed,
      latitude: x.latitude,
      longitude: x.longitude,
    }));
}
