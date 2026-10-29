import { useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { fetchAvailableOrders, fetchScheduledOrders } from '../api/orders';
import { mapAvailableOrderToOffer } from '../api/mapAvailableOrder';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { orderWithinPickupRadius } from '../geo/orderPickupDistance';
import { consumePendingPushOrderId, queuePushOrderNavigation } from '../navigation/navigationRef';
import type { MainTabParamList } from '../navigation/types';
import { attachDriverPushNotificationHandlers } from '../notifications/DriverOneSignalService';
import { readDriverPosition } from '../location/readDriverPosition';

type DashNav = BottomTabNavigationProp<MainTabParamList, 'Dashboard'>;
type DashRoute = RouteProp<MainTabParamList, 'Dashboard'>;

/** OneSignal 點擊 → 接單首頁並彈出該柯打 */
export function useDriverPushOpenOrder() {
  const navigation = useNavigation<DashNav>();
  const route = useRoute<DashRoute>();
  const { driver } = useDriverAuth();
  const { pickupRadiusKm } = useDriverSettings();
  const { state, showIncomingOffer } = useDriverSession();

  const openOrderById = useCallback(
    async (orderId: string) => {
      if (!driver?.id || state.activeOrder) return;
      navigation.navigate('Dashboard', { focusOrderId: undefined });
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
    },
    [driver?.id, navigation, pickupRadiusKm, showIncomingOffer, state.activeOrder],
  );

  useEffect(() => {
    if (Platform.OS === 'android') return;
    return attachDriverPushNotificationHandlers((orderId) => {
      queuePushOrderNavigation(orderId);
      void openOrderById(orderId);
    });
  }, [openOrderById]);

  useEffect(() => {
    const id = route.params?.focusOrderId ?? consumePendingPushOrderId();
    if (id) void openOrderById(id);
  }, [route.params?.focusOrderId, openOrderById]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        const pending = consumePendingPushOrderId();
        if (pending) void openOrderById(pending);
      }
    });
    return () => sub.remove();
  }, [openOrderById]);
}
