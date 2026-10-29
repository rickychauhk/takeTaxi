import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { cancelDriverOrder } from '../api/orders';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { OrderBottomSheet } from '../components/OrderBottomSheet';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useAcceptDriverOrder } from '../hooks/useAcceptDriverOrder';
import { useLiveDispatch } from '../hooks/useLiveDispatch';
import { useDriverPushOpenOrder } from '../hooks/useDriverPushOpenOrder';
import { useDriverWatchPosition } from '../hooks/useDriverWatchPosition';
import type { OrderOffer } from '../types/order';
import { t } from '../i18n';
import type { DriverDocumentType } from '../api/driverRegister';
import { pickAndUploadDriverDocument } from '../documents/pickAndUploadDriverDocument';
import {
  DRIVER_PENDING_APPROVAL_MSG,
  driverDispatchBlockedMessage,
  isDriverApproved,
  isDriverSuspended,
} from '../constants/driverApproval';
import { isFutureScheduledOffer, orderWithinPickupRadius } from '../geo/orderPickupDistance';
import { setDriverHallFocused } from '../navigation/driverHallFocus';
import { requestDriverOrdersRefresh } from '../realtime/driverOrdersSocket';
import { requestScheduledOrdersRefresh } from '../realtime/driverScheduledOrdersRefresh';
import {
  isOwnDriverPostedHallOrder,
  scheduledOrderHallHintMessage,
} from '../trip/driverHallOrderDisplay';
import { colors } from '../theme/colors';
import { LostPropertyMarquee } from '../components/LostPropertyMarquee';
import { LostPropertyBoardWebView } from '../components/LostPropertyBoardWebView';
import { useLostPropertyTicker } from '../hooks/useLostPropertyTicker';

export default function DashboardScreen() {
  const [lostBoardOpen, setLostBoardOpen] = useState(false);
  const { items: lostPropertyItems } = useLostPropertyTicker();
  const { driver, token } = useDriverAuth();
  const { state, rejectAlert, clearLocalTrip } = useDriverSession();
  const { acceptOffer, acceptingOrderId } = useAcceptDriverOrder();
  const [cancellingOwnDriverPostOrderId, setCancellingOwnDriverPostOrderId] = useState<
    string | null
  >(null);
  const { isLandscape } = useLayoutMode();
  const { pickupRadiusKm } = useDriverSettings();
  const alertOfferRef = useRef(state.alertOffer);
  alertOfferRef.current = state.alertOffer;

  useFocusEffect(
    useCallback(() => {
      setDriverHallFocused(true);
      return () => setDriverHallFocused(false);
    }, []),
  );

  useDriverPushOpenOrder();
  const { hallDispatchReady } = useLiveDispatch(driver?.id, token, {
    onOrderRemovedWhileAlerting: (orderId) => {
      if (alertOfferRef.current?.id !== orderId) return;
      rejectAlert();
      Alert.alert('柯打已不可用', '乘客可能已取消此柯打，或已被其他司機接走。');
    },
  });
  const { coord: driverCoord } = useDriverWatchPosition(!state.activeOrder);

  const dispatchBlockMsg = driverDispatchBlockedMessage(driver);

  const guardOrderAccept = useCallback(
    (order: OrderOffer) => {
      const block = driverDispatchBlockedMessage(driver);
      if (block) {
        Alert.alert(isDriverApproved(driver?.verificationStatus) ? '帳戶停用' : '待審批', block);
        return false;
      }
      if (isOwnDriverPostedHallOrder(order, driver?.id)) {
        Alert.alert('貨主柯打', '不可接自己出嘅貨主柯打，請等候其他師傅接單。');
        return false;
      }
      if (
        pickupRadiusKm != null &&
        !isFutureScheduledOffer(order) &&
        !orderWithinPickupRadius(driverCoord, order, pickupRadiusKm)
      ) {
        Alert.alert('超出接單範圍', '此柯打上車點不在你設定的距離內。');
        return false;
      }
      return true;
    },
    [driver, driverCoord, pickupRadiusKm],
  );

  const onCancelOwnDriverPost = useCallback(
    async (order: OrderOffer) => {
      if (!driver?.id) return;
      if (!isOwnDriverPostedHallOrder(order, driver.id)) return;
      Alert.alert('取消柯打', '確定要取消此貨主柯打？', [
        { text: '唔取消', style: 'cancel' },
        {
          text: '取消柯打',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingOwnDriverPostOrderId(order.id);
              try {
                await cancelDriverOrder(driver.id, order.id);
                if (token) {
                  requestDriverOrdersRefresh(
                    token,
                    pickupRadiusKm,
                    driverCoord ?
                      { latitude: driverCoord.latitude, longitude: driverCoord.longitude }
                    : null,
                  );
                }
                Alert.alert('已取消', '柯打已從大廳移除。');
              } catch (e) {
                Alert.alert('無法取消', e instanceof Error ? e.message : '請稍後再試');
              } finally {
                setCancellingOwnDriverPostOrderId(null);
              }
            })();
          },
        },
      ]);
    },
    [driver?.id, driverCoord, pickupRadiusKm, token],
  );

  const onConfirmOrder = useCallback(
    async (order: OrderOffer) => {
      if (!guardOrderAccept(order)) return;
      if (order.scheduledAt?.trim()) {
        const ok = await acceptOffer(order, { reserveOnly: true });
        if (!ok) return;
        if (token) {
          requestDriverOrdersRefresh(
            token,
            pickupRadiusKm,
            driverCoord
              ? { latitude: driverCoord.latitude, longitude: driverCoord.longitude }
              : null,
          );
        }
        requestScheduledOrdersRefresh();
        Alert.alert('已接受預約', scheduledOrderHallHintMessage(order.scheduledAt), [
          { text: '知道了' },
        ]);
        return;
      }
      void acceptOffer(order);
    },
    [acceptOffer, driverCoord, guardOrderAccept, pickupRadiusKm, token],
  );

  const approved = isDriverApproved(driver?.verificationStatus) && !isDriverSuspended(driver);

  const resubmitDocument = useCallback(
    (docType: DriverDocumentType) => async () => {
      if (!driver?.id) return;
      try {
        await pickAndUploadDriverDocument(driver.id, docType);
      } catch (e) {
        Alert.alert('上傳失敗', e instanceof Error ? e.message : '請稍後再試');
      }
    },
    [driver?.id],
  );

  const brandLabel = `${t('home.brand')} · ${driver?.displayName?.trim() || '司機'}`;

  const header = (
    <View style={isLandscape ? styles.landscapeHeader : styles.portraitHeader}>
      <Text style={[styles.brand, isLandscape && styles.landscapeBrand]} numberOfLines={1}>
        {brandLabel}
      </Text>
      {dispatchBlockMsg ? (
        <Text style={styles.pendingBanner}>{dispatchBlockMsg}</Text>
      ) : null}
      {!approved && !dispatchBlockMsg ? (
        <>
          <Text style={styles.pendingBanner}>{DRIVER_PENDING_APPROVAL_MSG}</Text>
          <View style={styles.resubmitRow}>
            <Pressable onPress={resubmitDocument('driving_license')} style={styles.resubmitLink}>
              <Text style={styles.resubmitLinkText}>補交行車證</Text>
            </Pressable>
            <Pressable onPress={resubmitDocument('driver_id')} style={styles.resubmitLink}>
              <Text style={styles.resubmitLinkText}>補交司機證</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.hall} edges={['top', 'left', 'right', 'bottom']}>
        {lostPropertyItems.length > 0 ? (
          <LostPropertyMarquee
            items={lostPropertyItems}
            onPress={() => setLostBoardOpen(true)}
          />
        ) : null}
        {header}
        <View style={styles.hallBody}>
          <OrderBottomSheet
            online={approved && state.online}
            hasActiveTrip={!!state.activeOrder}
            availableOrders={state.availableOrders}
            onConfirmOrder={onConfirmOrder}
            confirmingOrderId={acceptingOrderId}
            currentDriverId={driver?.id ?? null}
            onClearLocalTrip={clearLocalTrip}
            hallFullscreen
            hallScheduledHintOnly
            hideHallListHeader
            hallDispatchReady={hallDispatchReady}
            onCancelOwnDriverPost={onCancelOwnDriverPost}
            cancellingOwnDriverPostOrderId={cancellingOwnDriverPostOrderId}
          />
        </View>
      </SafeAreaView>
      <LostPropertyBoardWebView visible={lostBoardOpen} onClose={() => setLostBoardOpen(false)} />
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
    overflow: 'hidden',
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
  pendingBanner: {
    textAlign: 'center',
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  resubmitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  resubmitLink: { paddingVertical: 4, paddingHorizontal: 8 },
  resubmitLinkText: { color: colors.brandYellow, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  brand: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
});
