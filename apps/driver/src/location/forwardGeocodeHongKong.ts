import Constants from 'expo-constants';
import { normalizeHongKongCoord } from '../geo/hkCoords';
import type { GeoPoint } from '../types/order';

const GEOCODE_MS = 8_000;

function googleMapsKey(): string | null {
  const k =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    '';
  const t = k.trim();
  return t || null;
}

/** 地址無 WGS84 時，用 Google Geocoding 補上車／落車點（限香港） */
export async function forwardGeocodeHongKong(address: string): Promise<GeoPoint | null> {
  const key = googleMapsKey();
  const trimmed = address.trim();
  if (!key || trimmed.length < 2) return null;

  const query = trimmed.includes('香港') ? trimmed : `${trimmed}, 香港`;
  const params = new URLSearchParams({
    address: query,
    region: 'hk',
    language: 'zh-HK',
    key,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_MS);
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    if (data.status !== 'OK' || !data.results?.length) return null;
    const loc = data.results[0]?.geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;
    return normalizeHongKongCoord({ latitude: loc.lat, longitude: loc.lng });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
