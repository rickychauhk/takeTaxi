import type { OrderOffer } from '../types/order';

export function passengerContactPreferenceLine(
  offer: Pick<OrderOffer, 'passengerContactCall' | 'passengerContactSms'>,
): string | null {
  const bits: string[] = [];
  if (offer.passengerContactCall) bits.push('致電給我');
  if (offer.passengerContactSms) bits.push('短訊給我');
  return bits.length ? `乘客希望：${bits.join(' · ')}` : null;
}
