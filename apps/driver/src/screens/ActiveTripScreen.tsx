import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopSafePadding } from '../components/ScreenSafeArea';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatHongKongPhoneDisplay } from '@taxima/shared';
import { fetchDriverOrderTrack } from '../api/driverOrderTrack';
import { releaseDriverOrder, updateDriverOrderStatus } from '../api/orders';
import { sendDriverOrderChatMessage } from '../api/orderChat';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { toE164HongKong } from '../firebase/phone';
import { ActiveTripPanel } from '../components/ActiveTripPanel';
import { DriverCancelOrderSheet } from '../components/DriverCancelOrderSheet';
import { OrderCancelledModal } from '../components/OrderCancelledModal';
import { useDriverSession } from '../context/DriverSessionContext';
import { useActiveTripCancelWatch } from '../hooks/useActiveTripCancelWatch';
import { useDriverCancelOrderSheet } from '../hooks/useDriverCancelOrderSheet';
import { useActiveTripNavigationMap } from '../hooks/useActiveTripNavigationMap';
import { useDriverLiveLocation } from '../hooks/useDriverLiveLocation';
import { resolveNavigationTarget } from '../navigation/navigationTarget';
import type { RootStackParamList } from '../navigation/types';
import { isOrderCancelledConflictError } from '../trip/orderCancelledError';
import {
  driverPostedTripOwnerPhone,
  driverPostedTripPassengerPhone,
  isDriverPostedHallOrder,
} from '../trip/driverHallOrderDisplay';
import type { OrderOffer } from '../types/order';
import { colors } from '../theme/colors';

function dialPhone(displayLabel: string, rawPhone: string) {
  const phone = toE164HongKong(rawPhone);
  if (!phone) {
    Alert.alert(displayLabel, '電話格式不正確');
    return;
  }
  void (async () => {
    if (Constants.isDevice === false) {
      Alert.alert(displayLabel, `Simulator 無法撥號：${formatHongKongPhoneDisplay(phone)}`);
      return;
    }
    const url = Platform.OS === 'ios' ? `telprompt:${phone}` : `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(displayLabel, '此裝置無法撥號');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(displayLabel, '無法撥號');
    }
  })();
}

const EMPTY_TRIP_ORDER: OrderOffer = {
  id: '',
  pickupLabel: '',
  dropoffLabel: '',
  fareEstimateHkd: 0,
  distanceKm: 0,
};

export default function ActiveTripScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const topSafePadding = useTopSafePadding(4);
  const { driver } = useDriverAuth();
  const { state, setTripPhase, clearLocalTrip } = useDriverSession();
  const [proceeding, setProceeding] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [quickChatSending, setQuickChatSending] = useState(false);
  const order = state.activeOrder;
  const phase = state.tripPhase;
  const isShootOrder = order ? isDriverPostedHallOrder(order) : false;
  const shootPassengerPhone =
    order && isShootOrder ? driverPostedTripPassengerPhone(order) : null;
  const shootOwnerPhone =
    order && isShootOrder
      ? driverPostedTripOwnerPhone(order) || order.postedByDriverPhone?.trim() || null
      : null;

  useDriverLiveLocation(driver?.id, !!order && !!phase);
  const tripMap = useActiveTripNavigationMap(
    driver?.id,
    order ?? EMPTY_TRIP_ORDER,
    phase ?? 'to_pickup',
  );

  const navCoords = useMemo(
    () => ({
      pickupCoord: tripMap.pickupCoord,
      dropoffCoord: tripMap.dropoffCoord,
      passengerLiveCoord: tripMap.passengerDisplayCoord,
    }),
    [tripMap.pickupCoord, tripMap.dropoffCoord, tripMap.passengerDisplayCoord],
  );

  const pickupTarget = useMemo(
    () =>
      order
        ? resolveNavigationTarget(order, 'to_pickup', {
            pickupCoord: navCoords.pickupCoord,
            dropoffCoord: navCoords.dropoffCoord,
            passengerLiveCoord: navCoords.passengerLiveCoord,
          })
        : { label: '上車點' },
    [order, navCoords],
  );

  const dropoffTarget = useMemo(
    () =>
      order
        ? resolveNavigationTarget(order, 'to_dropoff', {
            pickupCoord: navCoords.pickupCoord,
            dropoffCoord: navCoords.dropoffCoord,
          })
        : { label: '目的地' },
    [order, navCoords],
  );

  const { cancelledVisible, dismissCancelled, showCancelledNotice } = useActiveTripCancelWatch(
    order?.id,
    tripMap.orderStatus,
  );
  const hallReleaseAlertShown = useRef(false);

  const sendQuickChat = useCallback(
    (body: string) => {
      if (!order?.id) return;
      void (async () => {
        setQuickChatSending(true);
        try {
          await sendDriverOrderChatMessage(order.id, body);
        } catch (e) {
          const msg = e instanceof Error ? e.message : '無法傳送訊息';
          Alert.alert('訊息', msg);
        } finally {
          setQuickChatSending(false);
        }
      })();
    },
    [order?.id],
  );

  const callPassenger = useCallback(() => {
    const phone = order?.passengerPhone?.trim();
    if (!phone) {
      Alert.alert('致電乘客', '未有乘客電話');
      return;
    }
    void (async () => {
      if (Constants.isDevice === false) {
        Alert.alert('致電乘客', `Simulator 無法撥號：${formatHongKongPhoneDisplay(phone)}`);
        return;
      }
      const url = Platform.OS === 'ios' ? `telprompt:${phone}` : `tel:${phone}`;
      try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          Alert.alert('致電乘客', '此裝置無法撥號');
          return;
        }
        await Linking.openURL(url);
      } catch {
        Alert.alert('致電乘客', '無法撥號');
      }
    })();
  }, [order?.passengerPhone]);

  const exitTripScreen = useCallback(() => {
    clearLocalTrip();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  }, [clearLocalTrip, navigation]);

  const cancelSheet = useDriverCancelOrderSheet({
    driverId: driver?.id,
    onSuccess: exitTripScreen,
    isBusy: () => proceeding || releasing,
  });
  const cancelling = cancelSheet.cancelling;

  const confirmOrderCancelled = useCallback(() => {
    dismissCancelled();
    exitTripScreen();
  }, [dismissCancelled, exitTripScreen]);

  useEffect(() => {
    if (!order?.id || isShootOrder || !tripMap.trackLost || hallReleaseAlertShown.current) return;
    hallReleaseAlertShown.current = true;
    Alert.alert(
      '乘客不等',
      '乘客已選擇等候其他師傅，柯打已返回大廳。',
      [{ text: '確定', onPress: () => exitTripScreen() }],
      { cancelable: false },
    );
  }, [order?.id, isShootOrder, tripMap.trackLost, exitTripScreen]);

  useEffect(() => {
    if (!order || !phase) navigation.goBack();
  }, [order, phase, navigation]);

  if (!order || !phase) {
    return <View style={styles.root} />;
  }

  const onRelease = () => {
    if (!order || !driver?.id || proceeding || releasing || cancelling) return;
    Alert.alert(
      isShootOrder ? '放出射柯打' : '放出柯打',
      isShootOrder
        ? '確定將此射柯打放回大廳？發單師傅會收到提醒，其他師傅可再次接單。'
        : '確定將此柯打放回大廳？乘客 App 會重新進入等候司機接單，並收到提醒。',
      [
        { text: '返回', style: 'cancel' },
        {
          text: '確定放出',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setReleasing(true);
              try {
                await releaseDriverOrder(driver.id, order.id);
                exitTripScreen();
              } catch (e) {
                const msg = e instanceof Error ? e.message : '無法放出柯打';
                Alert.alert('放出失敗', msg);
              } finally {
                setReleasing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const onCancel = () => {
    if (!order?.id || !driver?.id || proceeding || releasing || cancelling) return;
    cancelSheet.openCancelSheet(order.id);
  };

  const onProceed = () => {
    if (!order || !phase || !driver?.id || proceeding || releasing || cancelling) return;
    if (tripMap.orderStatus === 'cancelled') {
      showCancelledNotice(order.id);
      return;
    }
    void (async () => {
      setProceeding(true);
      try {
        try {
          const latest = await fetchDriverOrderTrack(driver.id, order.id);
          if (latest.status === 'cancelled') {
            showCancelledNotice(order.id);
            return;
          }
        } catch {
          /* 仍以 PATCH 結果為準 */
        }

        if (phase === 'to_dropoff') {
          await updateDriverOrderStatus(driver.id, order.id, 'completed');
          navigation.navigate('TripCompleted', {
            orderId: order.id,
            pickupLabel: order.pickupLabel,
            dropoffLabel: order.dropoffLabel,
            fareHkd: order.fareEstimateHkd,
            orderType: order.orderType,
            passengerPointsRedeemed: order.passengerPointsRedeemed,
            passengerPointsDiscountHkd: order.passengerPointsDiscountHkd,
            passengerPointsHkdPerPointAtOrder: order.passengerPointsHkdPerPointAtOrder,
          });
          return;
        }

        await updateDriverOrderStatus(driver.id, order.id, 'in_trip');
        setTripPhase('to_dropoff');
      } catch (e) {
        const raw = e instanceof Error ? e.message : '無法更新行程狀態';
        if (isOrderCancelledConflictError(raw)) {
          showCancelledNotice(order.id);
          return;
        }
        const msg =
          raw.includes('404') || raw.includes('Not Found')
            ? '伺服器尚未支援行程狀態更新。請部署最新 API 後再試。'
            : raw;
        Alert.alert('更新失敗', msg);
      } finally {
        setProceeding(false);
      }
    })();
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: topSafePadding,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <OrderCancelledModal visible={cancelledVisible} onConfirm={confirmOrderCancelled} />
      <DriverCancelOrderSheet
        visible={cancelSheet.sheetOpen}
        busy={cancelSheet.cancelling}
        onClose={cancelSheet.closeSheet}
        onDirectCancel={cancelSheet.onDirectCancel}
        onCancelWithReport={cancelSheet.onCancelWithReport}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={topSafePadding}
      >
      <ActiveTripPanel
        order={order}
        phase={phase}
        pickupTarget={pickupTarget}
        dropoffTarget={dropoffTarget}
        onCancel={onCancel}
        cancelling={cancelling}
        onProceed={onProceed}
        proceeding={proceeding}
        onRelease={onRelease}
        releasing={releasing}
        onSendQuickChat={isShootOrder ? undefined : sendQuickChat}
        onCallPassenger={
          !isShootOrder && order.passengerPhone?.trim() ? callPassenger : undefined
        }
        onCallShootGuest={
          shootPassengerPhone ? () => dialPhone('乘客電話', shootPassengerPhone) : undefined
        }
        onCallShootOwner={
          shootOwnerPhone ? () => dialPhone('致電貨主', shootOwnerPhone) : undefined
        }
        quickChatSending={quickChatSending}
      />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
