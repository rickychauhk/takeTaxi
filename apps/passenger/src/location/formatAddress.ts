import type { LocationGeocodedAddress } from 'expo-location';

export function formatGeocodedAddress(p: LocationGeocodedAddress): string {
  const ext = p as LocationGeocodedAddress & { formattedAddress?: string };
  if (ext.formattedAddress?.trim()) return ext.formattedAddress.trim();

  const streetLine = [p.streetNumber, p.street].filter(Boolean).join(' ').trim();
  const parts = [p.name, streetLine, p.district, p.subregion, p.city, p.region, p.country].filter(
    (x) => typeof x === 'string' && x.trim().length > 0,
  ) as string[];
  const seen = new Set<string>();
  const unique = parts.filter((x) => {
    const k = x.trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.join(' ') || '';
}
