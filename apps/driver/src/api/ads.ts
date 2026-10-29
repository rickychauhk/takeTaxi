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

/** 司機 App 最多 3 則投放中 Splash（API 已限制）。 */
export async function fetchDriverSplashAds(): Promise<PublicSplashAd[]> {
  const res = await fetch(`${getApiBaseUrl()}/public/ads?app=driver`);
  if (!res.ok) return [];
  const rows = (await res.json()) as PublicSplashAd[];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r?.id && r.imageUrl)
    .map((r) => ({
      ...r,
      imageUrl: resolveApiUrl(r.imageUrl),
    }))
    .filter((r): r is PublicSplashAd & { imageUrl: string } => Boolean(r.imageUrl));
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
