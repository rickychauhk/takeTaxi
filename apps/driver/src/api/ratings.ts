import { apiFetch } from './client';

export type OrderRatingSnapshot = {
  score: number | null;
  comment: string | null;
};

export async function fetchDriverPassengerRating(orderId: string): Promise<OrderRatingSnapshot> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/rating`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as OrderRatingSnapshot;
}

export async function submitDriverPassengerRating(
  orderId: string,
  score: number,
  comment?: string,
): Promise<OrderRatingSnapshot> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/rating`, {
    method: 'POST',
    body: JSON.stringify({ score, comment: comment?.trim() || undefined }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { score: number; comment: string | null };
  return { score: data.score, comment: data.comment };
}
