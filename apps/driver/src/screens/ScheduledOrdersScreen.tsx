import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { releaseDriverOrder } from '../api/orders';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { DriverCancelOrderSheet } from '../components/DriverCancelOrderSheet';
import {
  isDriverReservedScheduledOrder,
  OrderBottomSheet,
} from '../components/OrderBottomSheet';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { useAcceptDriverOrder } from '../hooks/useAcceptDriverOrder';
import { useDriverCancelOrderSheet } from '../hooks/useDriverCancelOrderSheet';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useScheduledOrders } from '../hooks/useScheduledOrders';
import { useDriverWatchPosition } from '../hooks/useDriverWatchPosition';
import type { OrderOffer } from '../types/order';
import { t } from '../i18n';
import { DRIVER_PENDING_APPROVAL_MSG, isDriverApproved } from '../constants/driverApproval';
import { orderWithinPickupRadius } from '../geo/orderPickupDistance';
import { requestDriverOrdersRefresh } from '../realtime/driverOrdersSocket';
import { requestScheduledOrdersRefresh } from '../realtime/driverScheduledOrdersRefresh';
import { scheduledOrderHallHintMessage } from '../trip/driverHallOrderDisplay';
import { colors } from '../theme/colors';

export default function ScheduledOrdersScreen() {
  const { driver, token } = useDriverAuth();
  const { state } = useDriverSession();
  const { acceptOffer, acceptingOrderId } = useAcceptDriverOrder();
  const { isLandscape } = useLayoutMode();
  const { pickupRadiusKm } = useDriverSettings();
  const approved = isDriverApproved(driver?.verificationStatus);
  const { orders, loading, error, refresh } = useScheduledOrders(
    driver?.id,
    pickupRadiusKm,
    approved && state.online,
  );
  const { coord: driverCoord } = useDriverWatchPosition(!state.activeOrder);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);

  const refreshLists = useCallback(() => {
    requestScheduledOrdersRefresh();
    void refresh();
    if (token) {
      requestDriverOrdersRefresh(
        token,
        pickupRadiusKm,
        driverCoord
          ? { latitude: driverCoord.latitude, longitude: driverCoord.longitude }
          : null,
      );
    }
  }, [driverCoord, pickupRadiusKm, refresh, token]);

  const cancelSheet = useDriverCancelOrderSheet({
    driverId: driver?.id,
    onSuccess: refreshLists,
    isBusy: () => Boolean(releasingOrderId || acceptingOrderId),
  });

  const guardOrderAccept = useCallback(
    (order: OrderOffer) => {
      if (!isDriverApproved(driver?.verificationStatus)) {
        Alert.alert('待審批', DRIVER_PENDING_APPROVAL_MSG);
        return false;
      }
      if (
        pickupRadiusKm != null &&
        !orderWithinPickupRadius(driverCoord, order, pickupRadiusKm)
      ) {
        Alert.alert('超出接單範圍', '此柯打上車點不在你設定的距離內。');
        return false;
      }
      return true;
    },
    [driver?.verificationStatus, driverCoord, pickupRadiusKm],
  );

  const onConfirmOrder = useCallback(
    async (order: OrderOffer) => {
      if (!guardOrderAccept(order)) return;
      if (isDriverReservedScheduledOrder(order)) {
        const ok = await acceptOffer(order, { startScheduledTrip: true });
        if (ok) refreshLists();
        return;
      }
      if (order.scheduledAt?.trim()) {
        const ok = await acceptOffer(order, { reserveOnly: true });
        if (!ok) return;
        requestScheduledOrdersRefresh();
        refreshLists();
        Alert.alert('已接受預約', scheduledOrderHallHintMessage(order.scheduledAt), [
          { text: '知道了' },
        ]);
        return;
      }
      void acceptOffer(order);
    },
    [acceptOffer, guardOrderAccept, refreshLists],
  );

  const onCancelReservedOrder = useCallback(
    (order: OrderOffer) => {
      cancelSheet.openCancelSheet(order.id);
    },
    [cancelSheet],
  );

  const onReleaseReservedOrder = useCallback(
    (order: OrderOffer) => {
      if (!driver?.id || cancelSheet.cancelling || releasingOrderId || acceptingOrderId) return;
      Alert.alert(
        '放出柯打',
        '確定將此柯打放回大廳？乘客 App 會重新進入等候司機接單，並收到提醒。',
        [
          { text: '返回', style: 'cancel' },
          {
            text: '確定放出',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setReleasingOrderId(order.id);
                try {
                  await releaseDriverOrder(driver.id, order.id);
                  refreshLists();
                } catch (e) {
                  const msg = e instanceof Error ? e.message : '無法放出柯打';
                  Alert.alert('放出失敗', msg);
                } finally {
                  setReleasingOrderId(null);
                }
              })();
            },
          },
        ],
      );
    },
    [acceptingOrderId, cancelSheet.cancelling, driver?.id, refreshLists, releasingOrderId],
  );

  const brandLabel = `${t('home.brand')} · ${driver?.displayName?.trim() || '司機'}`;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.hall} edges={['top', 'left', 'right', 'bottom']}>
        <View style={isLandscape ? styles.landscapeHeader : styles.portraitHeader}>
          <Text style={[styles.brand, isLandscape && styles.landscapeBrand]} numberOfLines={1}>
            {brandLabel}
          </Text>
          {error ? <Text style={styles.errorLine}>{error}</Text> : null}
          {loading && orders.length === 0 ? (
            <Text style={styles.hintLine}>載入預約柯打…</Text>
          ) : null}
        </View>
        <View style={styles.hallBody}>
          <OrderBottomSheet
            online={approved && state.online}
            hasActiveTrip={!!state.activeOrder}
            availableOrders={orders}
            onConfirmOrder={onConfirmOrder}
            confirmingOrderId={acceptingOrderId}
            onCancelReservedOrder={onCancelReservedOrder}
            onReleaseReservedOrder={onReleaseReservedOrder}
            cancellingReservedOrderId={cancelSheet.cancellingOrderId}
            releasingReservedOrderId={releasingOrderId}
            hallFullscreen
            listTitle="已預約訂單"
            orderSort="scheduledNearest"
            confirmButtonLabelForOrder={(o) =>
              isDriverReservedScheduledOrder(o) ? '開始接客' : '接受預約'
            }
            scheduledStartTrip45MinGate
          />
        </View>
      </SafeAreaView>
      <DriverCancelOrderSheet
        visible={cancelSheet.sheetOpen}
        busy={cancelSheet.cancelling}
        onClose={cancelSheet.closeSheet}
        onDirectCancel={cancelSheet.onDirectCancel}
        onCancelWithReport={cancelSheet.onCancelWithReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hall: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hallBody: {
    flex: 1,
    minHeight: 0,
  },
  portraitHeader: {
    flexShrink: 0,
    paddingBottom: 8,
    paddingTop: 4,
  },
  landscapeHeader: {
    flexShrink: 0,
    paddingBottom: 8,
    paddingTop: 10,
  },
  landscapeBrand: {
    textAlign: 'left',
  },
  brand: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorLine: {
    textAlign: 'center',
    color: colors.danger,
    fontSize: 12,
    marginBottom: 4,
  },
  hintLine: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
  },
});
