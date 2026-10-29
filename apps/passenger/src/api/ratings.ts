import Constants from 'expo-constants';

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://app.hktaketaxi.online/api/v1';

export type OrderRatingSnapshot = {
  score: number | null;
  comment: string | null;
};

export async function submitPassengerDriverRating(
  orderId: string,
  score: number,
  comment?: string,
): Promise<OrderRatingSnapshot> {
  const res = await fetch(`${baseUrl}/passenger/orders/${encodeURIComponent(orderId)}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, comment: comment?.trim() || undefined }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { score: number; comment: string | null };
  return { score: data.score, comment: data.comment };
}
