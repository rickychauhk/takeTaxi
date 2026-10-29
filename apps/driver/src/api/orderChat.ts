import { apiFetch } from './client';
import { driverHttpErrorMessage } from './parseDriverApiError';

export type OrderChatMessage = {
  id: string;
  orderId: string;
  senderRole: 'passenger' | 'driver';
  body: string;
  createdAt: string;
};

async function parseJson<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.text();
  if (!res.ok) throw new Error(driverHttpErrorMessage(res.status, body) || fallback);
  return JSON.parse(body) as T;
}

export async function fetchDriverOrderChatMessages(orderId: string): Promise<OrderChatMessage[]> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/chat/messages`);
  return parseJson(res, '無法載入訊息');
}

export async function fetchDriverOrderChatUnread(orderId: string): Promise<number> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/chat/unread-count`);
  const data = await parseJson<{ count: number }>(res, '無法載入未讀');
  return data.count ?? 0;
}

export async function markDriverOrderChatRead(orderId: string): Promise<void> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/chat/read`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(driverHttpErrorMessage(res.status, body) || '無法標記已讀');
  }
}

export async function sendDriverOrderChatMessage(
  orderId: string,
  body: string,
): Promise<OrderChatMessage> {
  const res = await apiFetch(`/driver/orders/${encodeURIComponent(orderId)}/chat/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  const data = await parseJson<{ message: OrderChatMessage }>(res, '無法傳送');
  return data.message;
}
