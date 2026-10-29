import { passengerFetch, passengerApiErrorMessage } from './passengerClient';

export type OrderChatMessage = {
  id: string;
  orderId: string;
  senderRole: 'passenger' | 'driver';
  body: string;
  createdAt: string;
};

export type PassengerChatQuickReply = {
  id: number;
  labelZh: string;
  labelEn: string | null;
  actionType: 'message' | 'cancel_order' | 'release_to_hall';
};

async function parseJson<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.text();
  if (!res.ok) throw new Error(passengerApiErrorMessage(res.status, body, fallback));
  return JSON.parse(body) as T;
}

export async function fetchPassengerChatQuickReplies(): Promise<PassengerChatQuickReply[]> {
  const res = await passengerFetch('/passenger/order-chat/quick-replies');
  return parseJson(res, '無法載入快捷訊息');
}

export async function fetchOrderChatMessages(orderId: string): Promise<OrderChatMessage[]> {
  const res = await passengerFetch(`/passenger/orders/${encodeURIComponent(orderId)}/chat/messages`);
  return parseJson(res, '無法載入訊息');
}

export async function fetchOrderChatUnreadCount(orderId: string): Promise<number> {
  const res = await passengerFetch(
    `/passenger/orders/${encodeURIComponent(orderId)}/chat/unread-count`,
  );
  const data = await parseJson<{ count: number }>(res, '無法載入未讀訊息');
  return data.count ?? 0;
}

export async function markOrderChatRead(orderId: string): Promise<void> {
  const res = await passengerFetch(`/passenger/orders/${encodeURIComponent(orderId)}/chat/read`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(passengerApiErrorMessage(res.status, body, '無法標記已讀'));
  }
}

export async function sendPassengerOrderChatMessage(
  orderId: string,
  input: { body?: string; quickReplyId?: number },
): Promise<{ message: OrderChatMessage; cancelOrder?: boolean; releaseToHall?: boolean }> {
  const res = await passengerFetch(
    `/passenger/orders/${encodeURIComponent(orderId)}/chat/messages`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return parseJson(res, '無法傳送訊息');
}
