import type { PassengerOrderRebookSnapshot } from '../api/passengerOrder';
import type { PassengerPaymentMethod } from '../constants/paymentMethods';
import type { BookingExtrasSelection } from '../screens/BookingMoreOptionsScreen';

/** 落單快照：司機取消後可原設定重新叫車 */
export type OrderRebookDraft = {
  fareEstimate: number;
  tipHkd: number;
  estimateDistanceMeters: number;
  pointsToRedeem: number;
  sixSeat: boolean;
  paymentMethods: PassengerPaymentMethod[];
  extras: BookingExtrasSelection;
  passengerContactCall: boolean;
  passengerContactSms: boolean;
  orderContactPhone?: string | null;
  companyPrice: boolean;
  safeDriving: boolean;
};

export function orderRebookDraftFromSnapshot(
  snapshot: PassengerOrderRebookSnapshot,
): OrderRebookDraft {
  return {
    fareEstimate: snapshot.fareEstimate,
    tipHkd: snapshot.tipHkd,
    estimateDistanceMeters: snapshot.estimateDistanceMeters,
    pointsToRedeem: snapshot.pointsToRedeem,
    sixSeat: snapshot.sixSeat,
    paymentMethods: snapshot.paymentMethods,
    extras: {
      selectedOptionIds: snapshot.selectedOptionIds,
      remark: snapshot.remark,
      scheduledAt: snapshot.scheduledAt,
    },
    passengerContactCall: snapshot.passengerContactCall ?? true,
    passengerContactSms: !!snapshot.passengerContactSms,
    orderContactPhone: snapshot.orderContactPhone ?? null,
    companyPrice: !!snapshot.companyPrice,
    safeDriving: !!snapshot.safeDriving,
  };
}
