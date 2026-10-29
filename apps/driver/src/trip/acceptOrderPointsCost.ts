import type { OrderOffer } from '../types/order';
import { isDriverPostedHallOrder } from './driverHallOrderDisplay';

/** 接單時會從接單司機扣減的積分（乘客 App 接單費；出貨為出貨人設定的柯打分數） */
export function acceptOrderPointsCost(offer: Pick<
  OrderOffer,
  'orderType' | 'driverPointsCostAtOrder' | 'driverPostBountyPoints'
>): number {
  const fromCost = Math.round(offer.driverPointsCostAtOrder ?? 0);
  if (fromCost > 0) return fromCost;
  if (isDriverPostedHallOrder(offer)) {
    return Math.round(offer.driverPostBountyPoints ?? 0);
  }
  return 0;
}
