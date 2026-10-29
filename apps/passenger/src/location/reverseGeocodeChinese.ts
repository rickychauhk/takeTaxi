import Constants from 'expo-constants';
import { isChinesePrimaryAddress } from './addressLocale';
import {
  bestHkAreaFromGoogleComponents,
  ensureMinimumHkAreaInAddress,
} from './hkDisplayArea';
import { simplifyPassengerDisplayAddress } from './simplifyDisplayAddress';

const GEOCODE_MS = 6_000;

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GeocodeResult = {
  formatted_address?: string;
  address_components?: AddressComponent[];
};

function googleMapsKey(): string | null {
  const k =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    '';
  const t = k.trim();
  return t || null;
}

function buildLineFromComponents(components: AddressComponent[] | undefined): string | null {
  if (!components?.length) return null;
  const pick = (...types: string[]) => {
    for (const type of types) {
      const c = components.find((x) => x.types.includes(type));
      if (c?.long_name?.trim()) return c.long_name.trim();
    }
    return null;
  };
  const premise = pick('premise', 'establishment', 'point_of_interest', 'park');
  const streetNum = pick('street_number');
  const route = pick('route');
  const street =
    streetNum && route ? `${route} ${streetNum}號` : route ?? streetNum ?? null;

  const hkArea = bestHkAreaFromGoogleComponents(components);

  const parts: string[] = [];
  if (premise) parts.push(premise);
  if (street) parts.push(street);
  if (hkArea && hkArea !== premise && hkArea !== street && !parts.some((p) => p.includes(hkArea))) {
    parts.push(hkArea);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
  }
  const line = unique.join('，');
  return line.trim() || null;
}

function pickGeocodeLine(
  result: GeocodeResult,
  accept?: (line: string) => boolean,
): string | null {
  const ok = (line: string | null | undefined) => {
    const t = line?.trim();
    if (!t) return null;
    if (accept && !accept(t)) return null;
    return t;
  };
  const components = result.address_components;
  const fromComponents = ok(buildLineFromComponents(components));
  if (fromComponents) {
    return ensureMinimumHkAreaInAddress(fromComponents, components);
  }
  const formatted = ok(result.formatted_address);
  if (formatted) {
    const simplified = simplifyPassengerDisplayAddress(formatted);
    return ensureMinimumHkAreaInAddress(simplified, components);
  }
  return null;
}

/** 將 Geocoding API 單筆結果轉成乘客顯示用繁中地址 */
export function labelFromGeocodeResult(result: GeocodeResult): string | null {
  const accept = (line: string) => isChinesePrimaryAddress(line) || hasChineseForOrder(line);
  return pickGeocodeLine(result, accept);
}

/** Google Geocoding API（language 例：en、zh-HK） */
export async function reverseGeocodeGoogle(
  latitude: number,
  longitude: number,
  language: string,
  accept?: (line: string) => boolean,
): Promise<string | null> {
  const key = googleMapsKey();
  if (!key) return null;

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    language,
    region: 'hk',
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
      results?: GeocodeResult[];
    };
    if (data.status !== 'OK' || !data.results?.length) return null;
    for (const result of data.results) {
      const line = pickGeocodeLine(result, accept);
      if (line) return line;
    }
    return pickGeocodeLine(data.results[0]!, accept);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 落單／CRM 用繁中地址 */
export async function reverseGeocodeChinese(latitude: number, longitude: number): Promise<string | null> {
  const accept = (line: string) => isChinesePrimaryAddress(line) || hasChineseForOrder(line);
  return reverseGeocodeGoogle(latitude, longitude, 'zh-HK', accept);
}

function hasChineseForOrder(line: string): boolean {
  return /[\u3400-\u9fff]/.test(line.trim());
}

/** OSM 後備（無 Google key 時，繁中 UI 用） */
export async function reverseGeocodeNominatimZh(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_MS);
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(String(latitude))}` +
      `&lon=${encodeURIComponent(String(longitude))}` +
      `&accept-language=zh-Hant-HK,zh-HK,zh-Hant,zh`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TaxiMaPassenger/1.0 (taxima.hk)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string; name?: string };
    const line = data.display_name?.trim() || data.name?.trim();
    if (!line) return null;
    if (isChinesePrimaryAddress(line)) return simplifyPassengerDisplayAddress(line);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
