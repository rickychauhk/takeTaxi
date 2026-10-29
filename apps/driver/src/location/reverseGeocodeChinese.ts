import Constants from 'expo-constants';

const GEOCODE_MS = 6_000;

function googleMapsKey(): string | null {
  const k =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    '';
  const t = k.trim();
  return t || null;
}

/** Google Geocoding API（language 例：en、zh-HK） */
export async function reverseGeocodeGoogle(
  latitude: number,
  longitude: number,
  language: string,
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
      results?: { formatted_address?: string }[];
    };
    if (data.status !== 'OK' || !data.results?.length) return null;
    return data.results[0]?.formatted_address?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 落單／CRM 用繁中地址 */
export async function reverseGeocodeChinese(latitude: number, longitude: number): Promise<string | null> {
  return reverseGeocodeGoogle(latitude, longitude, 'zh-HK');
}
