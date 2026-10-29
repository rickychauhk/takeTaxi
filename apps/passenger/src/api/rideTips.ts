import Constants from 'expo-constants';

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://app.hktaketaxi.online/api/v1';

export async function fetchRideTipsHtml(): Promise<string> {
  const res = await fetch(`${baseUrl}/public/passenger-ride-tips`);
  if (!res.ok) return '';
  const data = (await res.json()) as { html?: string };
  return data.html?.trim() ?? '';
}
