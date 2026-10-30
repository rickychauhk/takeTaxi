type Listener = (orderId: string) => void;

let pendingOrderId: string | null = null;
const listeners = new Set<Listener>();

/** 司機行程訊息 push（點擊或前景）→ 打開對應柯打 Chat */
export function requestOpenPassengerTripChat(orderId: string) {
  const id = orderId.trim();
  if (!id) return;
  pendingOrderId = id;
  for (const fn of listeners) fn(id);
}

export function subscribePassengerTripChatOpen(listener: Listener): () => void {
  listeners.add(listener);
  if (pendingOrderId) listener(pendingOrderId);
  return () => listeners.delete(listener);
}

/** 已成功開啟該柯打 Chat 後清除 pending */
export function clearPendingPassengerTripChat(orderId: string) {
  if (pendingOrderId === orderId.trim()) pendingOrderId = null;
}

export function peekPendingPassengerTripChatOrderId(): string | null {
  return pendingOrderId;
}
