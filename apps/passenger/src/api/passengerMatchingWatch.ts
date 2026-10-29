import { passengerFetch } from './passengerClient';

/** 乘客仍在等候接單頁時心跳，供司機大廳判斷是否繼續顯示 */
export async function pingPassengerMatchingWatch(orderId: string): Promise<void> {
  const res = await passengerFetch(`/passenger/orders/${orderId}/matching-watch`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
