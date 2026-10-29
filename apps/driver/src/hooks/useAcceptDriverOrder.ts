import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { acceptOrderPointsCost } from '../trip/acceptOrderPointsCost';
import { acceptDriverOrder, fetchDriverActiveOrder, postDriverLocation } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { acceptOrderAlertFromError } from '../api/parseDriverApiError';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { readDriverPosition } from '../location/readDriverPosition';
import {
  alertForDriverPositionFailure,
  ensureDriverForegroundLocation,
  postImmediateDriverLocation,
} from '../location/requireDriverLocation';
import { navigationRef } from '../navigation/navigationRef';
import type { OrderOffer } from '../types/order';

export type AcceptOfferOptions = {
  /** 預約「接受預約」：只鎖單，不進行程頁 */
  reserveOnly?: boolean;
};

function mergeOfferForTrip(base: OrderOffer, fallback: OrderOffer): OrderOffer {
  return {
    ...base,
    bookingOptionLines:
      fallback.bookingOptionLines?.length ? fallback.bookingOptionLines : base.bookingOptionLines,
    driverPointsCostAtOrder: base.driverPointsCostAtOrder ?? fallback.driverPointsCostAtOrder,
    driverPointsBusySurcharge:
      base.driverPointsBusySurcharge ?? fallback.driverPointsBusySurcharge,
    driverBusyRegionRewardPoints:
      base.driverBusyRegionRewardPoints ?? fallback.driverBusyRegionRewardPoints,
    driverPostBountyPoints: base.driverPostBountyPoints ?? fallback.driverPostBountyPoints,
    passengerPointsRedeemed: base.passengerPointsRedeemed ?? fallback.passengerPointsRedeemed,
    passengerContactCall: base.passengerContactCall ?? fallback.passengerContactCall,
    passengerContactSms: base.passengerContactSms ?? fallback.passengerContactSms,
    scheduledAt: base.scheduledAt ?? fallback.scheduledAt,
    orderType: base.orderType ?? fallback.orderType,
    postedByDriverPhone: base.postedByDriverPhone ?? fallback.postedByDriverPhone,
    bookingOptionLines: base.bookingOptionLines?.length
      ? base.bookingOptionLines
      : fallback.bookingOptionLines,
  };
}

function alertInsufficientAcceptPoints(
  needed: number,
  balance: number,
  onRecharge: () => void,
) {
  Alert.alert(
    '積分不足',
    `接此柯打需要 ${needed} 積分，你目前只有 ${balance} 積分。請先充值。`,
    [
      { text: '取消', style: 'cancel' },
      { text: '充值', onPress: onRecharge },
    ],
  );
}

export function useAcceptDriverOrder() {
  const { driver } = useDriverAuth();
  const { acceptAlert, rejectAlert, removeAvailableOrder } = useDriverSession();
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const acceptingRef = useRef(false);

  const acceptOffer = useCallback(
    async (offer: OrderOffer, options?: AcceptOfferOptions): Promise<boolean> => {
      if (!driver?.id || acceptingRef.current) return false;
      const acceptCost = acceptOrderPointsCost(offer);
      const balance = Math.round(Number(driver.pointsBalance ?? 0));
      if (acceptCost > 0 && balance < acceptCost) {
        alertInsufficientAcceptPoints(acceptCost, balance, () => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('PurchasePoints', { requiredPoints: acceptCost });
          }
        });
        return false;
      }
      const locOk = await ensureDriverForegroundLocation();
      if (!locOk) return false;
      const gps = await readDriverPosition();
      if (!gps.ok) {
        alertForDriverPositionFailure(gps.reason);
        return false;
      }
      void postImmediateDriverLocation((lat, lng) =>
        postDriverLocation(driver.id, lat, lng),
      ).catch(() => undefined);
      acceptingRef.current = true;
      setAcceptingOrderId(offer.id);
      try {
        await acceptDriverOrder(driver.id, offer.id, {
          lat: gps.latitude,
          lng: gps.longitude,
        });
        if (options?.reserveOnly) {
          removeAvailableOrder(offer.id);
          return true;
        }

        const active = await fetchDriverActiveOrder(driver.id);
        let tripOffer: OrderOffer;
        if (active) {
          tripOffer = mergeOfferForTrip(mapAvailableOrderToOffer(active), offer);
        } else if (offer.scheduledAt?.trim()) {
          tripOffer = offer;
        } else {
          Alert.alert('未能接單', '此柯打已不可用（乘客可能已取消或已被接）。');
          return false;
        }
        acceptAlert(tripOffer);
        if (navigationRef.isReady()) {
          navigationRef.navigate('ActiveTrip');
        }
        return true;
      } catch (e) {
        const { title, message, dismissAlert } = acceptOrderAlertFromError(e);
        if (dismissAlert) rejectAlert();
        if (message.includes('積分不足')) {
          const match = message.match(/需要\s*(\d+)\s*積分/);
          const needed = match ? Number(match[1]) : acceptOrderPointsCost(offer);
          alertInsufficientAcceptPoints(needed, balance, () => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('PurchasePoints', { requiredPoints: needed });
            }
          });
          return false;
        }
        Alert.alert(title, message);
        return false;
      } finally {
        acceptingRef.current = false;
        setAcceptingOrderId(null);
      }
    },
    [acceptAlert, driver?.id, rejectAlert, removeAvailableOrder],
  );

  return { acceptOffer, acceptingOrderId, rejectAlert };
}
