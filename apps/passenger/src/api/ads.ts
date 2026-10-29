import { getApiBaseUrl, resolveApiUrl } from './config';

export type PublicSplashAd = {
  id: number;
  targetApp: string;
  placement: string;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  status: string;
};

export async function fetchPassengerSplashAd(): Promise<PublicSplashAd | null> {
  const res = await fetch(`${getApiBaseUrl()}/public/ads?app=passenger`);
  if (!res.ok) return null;
  const rows = (await res.json()) as PublicSplashAd[];
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first?.id) return null;
  return {
    ...first,
    imageUrl: resolveApiUrl(first.imageUrl),
  };
}

export async function fetchAdWebviewHtml(adId: number): Promise<string | null> {
  const res = await fetch(`${getApiBaseUrl()}/public/ads/${adId}/webview`);
  if (!res.ok) return null;
  const data = (await res.json()) as { html?: string };
  return data.html?.trim() || null;
}

export async function trackAdEvent(adId: number, type: 'impression' | 'click'): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/public/ads/${adId}/track?type=${type}`, { method: 'POST' });
  } catch {
    /* non-blocking */
  }
}
