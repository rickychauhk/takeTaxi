import type { OrderOffer } from '../types/order';

export function passengerPointsRedemptionLine(offer: Pick<
  OrderOffer,
  'passengerPointsRedeemed' | 'passengerPointsDiscountHkd' | 'passengerPointsHkdPerPointAtOrder'
>): string | null {
  const pts = offer.passengerPointsRedeemed ?? 0;
  const discount = offer.passengerPointsDiscountHkd ?? 0;
  if (pts <= 0 || discount <= 0) return null;
  const rate = offer.passengerPointsHkdPerPointAtOrder;
  const ratePart =
    rate != null && Number.isFinite(rate) ? `（HK$${Math.round(rate)}/分）` : '';
  return `乘客積分抵扣 ${pts} 分 · -HK$${Math.round(discount)}${ratePart}`;
}
