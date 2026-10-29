import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { fetchAvailableOrders, fetchScheduledOrders } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { orderWithinPickupRadius } from '../geo/orderPickupDistance';
import { readDriverPosition } from '../location/readDriverPosition';
import { queuePushOrderNavigation, tryOpenPushOrder } from '../navigation/navigationRef';
import {
  attachDriverPushNotificationHandlers,
  attachDriverPushForegroundNewOrderHandler,
} from './DriverOneSignalService';
import {
  consumeAndroidLaunchOrderId,
  postAndroidFullScreenNewOrderAlert,
} from '../native/incomingOrderWindow';

function orderIdFromData(additionalData?: object): string | null {
  if (!additionalData || typeof additionalData !== 'object') return null;
  const d = additionalData as Record<string, unknown>;
  if (d.type !== 'new_order' && d.type !== 'scheduled_order_reminder') return null;
  const orderId = d.orderId;
  if (typeof orderId !== 'string') return null;
  const id = orderId.trim();
  return id || null;
}

/** Android：push / 全屏 intent 喚醒後自動彈接單；背景 push 發本地 full-screen 通知 */
export function DriverAndroidIncomingPush() {
  const { driver } = useDriverAuth();
  const { pickupRadiusKm } = useDriverSettings();
  const { state, showIncomingOffer } = useDriverSession();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const openOrderById = async (orderId: string) => {
      if (!driver?.id || state.activeOrder) return;
      queuePushOrderNavigation(orderId);
      tryOpenPushOrder();
      try {
        let coord: { latitude: number; longitude: number } | null = null;
        const fix = await readDriverPosition();
        if (fix.ok) coord = { latitude: fix.latitude, longitude: fix.longitude };
        const rows = await fetchAvailableOrders(driver.id, pickupRadiusKm, coord);
        let row = rows.find((r) => r.orderId === orderId);
        if (!row) {
          const scheduled = await fetchScheduledOrders(driver.id, pickupRadiusKm, coord);
          row = scheduled.find((r) => r.orderId === orderId);
        }
        if (!row) return;
        const offer = mapAvailableOrderToOffer(row, coord);
        if (
          pickupRadiusKm != null &&
          coord &&
          !orderWithinPickupRadius(coord, offer, pickupRadiusKm)
        ) {
          return;
        }
        showIncomingOffer(offer, { playSound: true });
      } catch {
        /* ignore */
      }
    };

    const detachClick = attachDriverPushNotificationHandlers((orderId) => {
      void openOrderById(orderId);
    });

    const detachForeground = attachDriverPushForegroundNewOrderHandler((event) => {
      const id = orderIdFromData(event.notification.additionalData);
      if (!id) return;
      event.preventDefault(); // 唔用系統 banner，改 App 全屏接單
      const pickup = typeof event.notification.title === 'string' ? event.notification.title : '新柯打';
      const body = typeof event.notification.body === 'string' ? event.notification.body : '';
      if (AppState.currentState !== 'active') {
        postAndroidFullScreenNewOrderAlert(id, pickup, body);
      }
      void openOrderById(id);
    });

    const onActive = async () => {
      const launchId = await consumeAndroidLaunchOrderId();
      if (launchId) void openOrderById(launchId);
    };
    void onActive();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void onActive();
    });

    return () => {
      detachClick();
      detachForeground();
      sub.remove();
    };
  }, [driver?.id, pickupRadiusKm, showIncomingOffer, state.activeOrder]);

  return null;
}
