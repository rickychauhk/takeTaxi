import { getApiBaseUrl } from './config';

export type LostPropertyTickerItem = {
  id: string;
  itemName: string;
  lostAtHk: string;
  contactPhone: string;
  marqueeText: string;
};

export function lostPropertyBoardUrl(): string {
  return `${getApiBaseUrl()}/public/lost-property/board`;
}

export async function fetchActiveLostPropertyTicker(): Promise<LostPropertyTickerItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/lost-property/active`);
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: LostPropertyTickerItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}
