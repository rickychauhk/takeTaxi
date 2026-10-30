import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { DriverOrdersSocketGeo } from '../realtime/driverOrdersSocket';
import { fetchAvailableOrders } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useDriverSession } from '../context/DriverSessionContext';
import {
  enrichOrdersWithPickupDistance,
  filterOrdersByPickupRadius,
  orderWithinPickupRadius,
} from '../geo/orderPickupDistance';
import type { DriverPickupRadiusKm } from '../settings/driverPickupRadius';
import { readDriverPosition } from '../location/readDriverPosition';
import { useDriverWatchPosition } from './useDriverWatchPosition';
import type { OrderOffer } from '../types/order';
import {
  isOwnDriverPostedHallOrder,
  sortHallOrdersNearestPickupFirst,
} from '../trip/driverHallOrderDisplay';
import { setSuppressForegroundNewOrderPush } from '../notifications/DriverOneSignalService';
import {
  connectDriverOrdersSocket,
  disconnectDriverOrdersSocket,
  isDriverOrdersSocketConnected,
  requestDriverOrdersRefresh,
  resubscribeDriverOrdersSocket,
  type DriverOrderSocketPayload,
} from '../realtime/driverOrdersSocket';

const FALLBACK_POLL_MS = 30_000;

function toSocketGeo(
  coord: { latitude: number; longitude: number } | null | undefined,
): DriverOrdersSocketGeo | null {
  if (!coord) return null;
  return { latitude: coord.latitude, longitude: coord.longitude };
}

function mergeEvent(
  rows: OrderOffer[],
  payload: DriverOrderSocketPayload,
  driverCoord: { latitude: number; longitude: number } | null | undefined,
): OrderOffer[] {
  if (payload.type === 'removed') {
    return rows.filter((r) => r.id !== payload.orderId);
  }
  const offer = mapAvailableOrderToOffer(payload.order, driverCoord);
  const idx = rows.findIndex((r) => r.id === offer.id);
  if (idx >= 0) {
    const next = [...rows];
    next[idx] = offer;
    return sortHallOrdersNearestPickupFirst(next);
  }
  return sortHallOrdersNearestPickupFirst([offer, ...rows]);
}

function applyHallListFilter(
  offers: OrderOffer[],
  driver: { latitude: number; longitude: number } | null | undefined,
  maxKm: DriverPickupRadiusKm,
  driverId: string | null | undefined,
): OrderOffer[] {
  const withDist = enrichOrdersWithPickupDistance(offers, driver);
  return filterOrdersByPickupRadius(withDist, driver, maxKm, (o) =>
    isOwnDriverPostedHallOrder(o, driverId),
  );
}

type LiveDispatchOptions = {
  /** 待派列表移除某單（乘客取消等）且與當前彈窗同一單 */
  onOrderRemovedWhileAlerting?: (orderId: string) => void;
};

/** 上線：WebSocket 收待派柯打；離線或 socket 斷線時低頻 HTTP 對帳 */
export function useLiveDispatch(
  driverId: string | undefined,
  authToken: string | null,
  options?: LiveDispatchOptions,
) {
  const { pickupRadiusKm, ready: settingsReady } = useDriverSettings();
  const {
    state,
    setAvailableOrders,
    showIncomingOffer,
    rejectAlert,
    dismissedOfferIds,
  } = useDriverSession();
  const watchEnabled = Boolean(driverId && state.online && !state.activeOrder);
  const { coord: driverCoord } = useDriverWatchPosition(watchEnabled);
  const [hallDispatchReady, setHallDispatchReady] = useState(false);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const rowsRef = useRef<OrderOffer[]>([]);
  const skipAlertRef = useRef(true);
  const alertOfferRef = useRef(state.alertOffer);
  const dismissedRef = useRef(dismissedOfferIds);
  const radiusRef = useRef(pickupRadiusKm);
  const driverCoordRef = useRef(driverCoord);
  const onRemovedRef = useRef(options?.onOrderRemovedWhileAlerting);

  alertOfferRef.current = state.alertOffer;
  const appForegroundRef = useRef(AppState.currentState === 'active');
  useEffect(() => {
    const syncPushSuppress = () => {
      const fg = AppState.currentState === 'active';
      appForegroundRef.current = fg;
      setSuppressForegroundNewOrderPush(fg || Boolean(state.alertOffer));
    };
    syncPushSuppress();
    const sub = AppState.addEventListener('change', syncPushSuppress);
    return () => sub.remove();
  }, [state.alertOffer]);
  onRemovedRef.current = options?.onOrderRemovedWhileAlerting;
  dismissedRef.current = dismissedOfferIds;
  radiusRef.current = pickupRadiusKm;
  driverCoordRef.current = driverCoord;

  useEffect(() => {
    knownIdsRef.current = new Set();
    rowsRef.current = [];
    skipAlertRef.current = true;
  }, [driverId]);

  useEffect(() => {
    if (!authToken || !state.online || state.activeOrder) return;
    const geo = toSocketGeo(driverCoord);
    resubscribeDriverOrdersSocket(pickupRadiusKm, geo);
    requestDriverOrdersRefresh(authToken, pickupRadiusKm, geo);
  }, [
    authToken,
    pickupRadiusKm,
    state.online,
    state.activeOrder,
    driverCoord?.latitude,
    driverCoord?.longitude,
  ]);

  useEffect(() => {
    if (!driverId || !authToken || !state.online || state.activeOrder || !settingsReady) {
      disconnectDriverOrdersSocket();
      setAvailableOrders([]);
      setHallDispatchReady(false);
      return;
    }

    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    setHallDispatchReady(false);
    setAvailableOrders([]);

    const applyRows = (offers: OrderOffer[], fromSnapshot: boolean) => {
      const filtered = sortHallOrdersNearestPickupFirst(
        applyHallListFilter(offers, driverCoordRef.current, radiusRef.current, driverId),
      );
      rowsRef.current = filtered;
      setAvailableOrders(filtered);
      if (fromSnapshot) setHallDispatchReady(true);

      if (alertOfferRef.current || fromSnapshot) {
        for (const o of filtered) knownIdsRef.current.add(o.id);
        if (fromSnapshot) skipAlertRef.current = false;
        return;
      }

      const dismissed = dismissedRef.current;
      for (const offer of filtered) {
        const isNew = !knownIdsRef.current.has(offer.id);
        knownIdsRef.current.add(offer.id);
        if (skipAlertRef.current) continue;
        if (isNew && !dismissed.has(offer.id) && !isOwnDriverPostedHallOrder(offer, driverId)) {
          showIncomingOffer(offer, { playSound: true });
          break;
        }
      }
      skipAlertRef.current = false;
    };

    const pollFallback = async () => {
      if (cancelled || isDriverOrdersSocketConnected()) {
        schedulePoll();
        return;
      }
      try {
        const rows = await fetchAvailableOrders(
          driverId,
          radiusRef.current,
          driverCoordRef.current,
        );
        if (cancelled) return;
        applyRows(
          rows.map((r) => mapAvailableOrderToOffer(r, driverCoordRef.current)),
          true,
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHallDispatchReady(true);
      }
      schedulePoll();
    };

    const schedulePoll = () => {
      if (cancelled) return;
      pollTimer = setTimeout(() => void pollFallback(), FALLBACK_POLL_MS);
    };

    const tryConnectSocket = () => {
      if (cancelled) return;
      connectDriverOrdersSocket(
        authToken,
        {
            onConnectionChange: (connected) => {
            if (connected) skipAlertRef.current = true;
          },
          onSnapshot: (rows) => {
            if (cancelled) return;
            applyRows(
              rows.map((r) => mapAvailableOrderToOffer(r, driverCoordRef.current)),
              true,
            );
          },
          onEvent: (payload) => {
            if (cancelled) return;
            if (payload.type === 'removed' && payload.orderId) {
              if (alertOfferRef.current?.id === payload.orderId) {
                onRemovedRef.current?.(payload.orderId);
              }
            }
            const merged = mergeEvent(rowsRef.current, payload, driverCoordRef.current);
            applyRows(merged, false);
          },
        },
        {
          maxPickupRadiusKm: radiusRef.current,
          driverCoord: toSocketGeo(driverCoordRef.current),
        },
      );
    };

    if (
      radiusRef.current != null &&
      !toSocketGeo(driverCoordRef.current)
    ) {
      void readDriverPosition().then((result) => {
        if (cancelled || !result.ok) {
          tryConnectSocket();
          return;
        }
        driverCoordRef.current = {
          latitude: result.latitude,
          longitude: result.longitude,
        };
        tryConnectSocket();
        requestDriverOrdersRefresh(authToken, radiusRef.current, toSocketGeo(driverCoordRef.current));
      });
    } else {
      tryConnectSocket();
    }

    schedulePoll();
    void pollFallback();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      disconnectDriverOrdersSocket();
    };
  }, [
    driverId,
    authToken,
    state.online,
    state.activeOrder,
    settingsReady,
    setAvailableOrders,
    showIncomingOffer,
  ]);

  /** GPS 或接單範圍變更：重算列表；彈窗中的柯打若超出範圍則關閉 */
  useEffect(() => {
    if (!state.online || state.activeOrder) return;

    const withDist = enrichOrdersWithPickupDistance(rowsRef.current, driverCoord);
    const filtered = sortHallOrdersNearestPickupFirst(
      filterOrdersByPickupRadius(withDist, driverCoord, pickupRadiusKm, (o) =>
        isOwnDriverPostedHallOrder(o, driverId),
      ),
    );
    const prevIds = rowsRef.current.map((o) => o.id).join(',');
    const nextIds = filtered.map((o) => o.id).join(',');
    if (prevIds !== nextIds) {
      rowsRef.current = filtered;
      setAvailableOrders(filtered);
    } else if (filtered.length > 0) {
      rowsRef.current = filtered;
      setAvailableOrders(filtered);
    }

    const alert = state.alertOffer;
    if (
      alert &&
      pickupRadiusKm != null &&
      !isOwnDriverPostedHallOrder(alert, driverId) &&
      !orderWithinPickupRadius(driverCoord, alert, pickupRadiusKm)
    ) {
      rejectAlert();
    }
  }, [
    driverId,
    driverCoord?.latitude,
    driverCoord?.longitude,
    pickupRadiusKm,
    state.online,
    state.activeOrder,
    state.alertOffer,
    setAvailableOrders,
    rejectAlert,
  ]);

  return { hallDispatchReady };
}
