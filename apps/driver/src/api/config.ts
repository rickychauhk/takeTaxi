import Constants from 'expo-constants';

export function getApiBaseUrl(): string {
  return (
    Constants.expoConfig?.extra?.apiBaseUrl ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'https://app.hktaketaxi.online/api/v1'
  );
}

export function resolveApiUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
