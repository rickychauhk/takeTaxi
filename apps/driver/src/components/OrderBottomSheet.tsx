import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OrderOffer } from '../types/order';
import { useDriverSettings } from '../context/DriverSettingsContext';
import { isUnlimitedPickupRadius } from '../geo/orderPickupDistance';
import { useDrivingUi } from '../hooks/useDrivingUi';
import { useDriverWatchPosition } from '../hooks/useDriverWatchPosition';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useMinuteClock } from '../hooks/useMinuteClock';
import { formatPickupRadiusLabel } from '../settings/driverPickupRadius';
import { DriverHallDispatchPlaceholder } from './DriverHallDispatchPlaceholder';
import { DriverHallOrderCard } from './DriverHallOrderCard';
import {
  canStartScheduledTripNow,
  hallOrderPickupDistanceLabel,
  isOwnDriverPostedHallOrder,
  scheduledStartTripBlockedAlert,
  sortHallOrdersNearestPickupFirst,
  sortScheduledOrdersNearestFirst,
} from '../trip/driverHallOrderDisplay';
import { driverOrderPointsLines } from '../trip/driverOrderPointsLines';
import { passengerContactPreferenceLine } from '../trip/passengerContactPreferenceLine';
import { passengerPointsRedemptionLine } from '../trip/passengerPointsRedemptionLine';
import { colors } from '../theme/colors';

type DrivingUi = ReturnType<typeof useDrivingUi>;

function LegacyOrderRow({
  order: o,
  driving,
  onPress,
}: {
  order: OrderOffer;
  driving: DrivingUi;
  onPress: () => void;
}) {
  const pointsBits = [
    ...driverOrderPointsLines(o).map((line) => line.text),
    passengerPointsRedemptionLine(o),
    passengerContactPreferenceLine(o),
  ].filter(Boolean);

  return (
    <Pressable
      style={[styles.orderRow, { minHeight: driving.touchMin + 28 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.orderTopRow}>
        <Text style={[styles.orderFare, { fontSize: driving.bodySize }]}>
          HK${o.fareEstimateHkd}
        </Text>
        <Text style={[styles.orderId, { fontSize: driving.labelSize }]}>#{o.id}</Text>
      </View>
      {o.pickupDistanceKm != null && o.pickupDistanceKm > 0 ? (
        <Text style={[styles.orderPickupDist, { fontSize: driving.labelSize }]}>
          {hallOrderPickupDistanceLabel(o)} {o.pickupDistanceKm.toFixed(1)} km
        </Text>
      ) : null}
      <View style={styles.orderStops}>
        <View style={styles.orderStopBlock}>
          <Text style={[styles.orderStopTag, { fontSize: driving.labelSize }]}>上車點</Text>
          <Text style={[styles.orderRoute, { fontSize: driving.secondaryTextSize }]} numberOfLines={3}>
            {o.pickupLabel}
          </Text>
        </View>
        <View style={styles.orderStopBlock}>
          <Text style={[styles.orderStopTag, { fontSize: driving.labelSize }]}>目的地</Text>
          <Text style={[styles.orderRoute, { fontSize: driving.secondaryTextSize }]} numberOfLines={3}>
            {o.dropoffLabel}
          </Text>
        </View>
      </View>
      {pointsBits.length > 0 ? (
        <Text style={[styles.orderPoints, { fontSize: driving.labelSize }]} numberOfLines={2}>
          {pointsBits.join(' · ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

type Props = {
  online: boolean;
  hasActiveTrip: boolean;
  availableOrders?: OrderOffer[];
  onPickOrder?: (order: OrderOffer) => void;
  /** 大廳「確定接單」 */
  onConfirmOrder?: (order: OrderOffer) => void;
  confirmingOrderId?: string | null;
  /** 大廳「我出嘅」標記 */
  currentDriverId?: string | null;
  onClearLocalTrip?: () => void;
  /** 橫屏側欄內嵌（唔用 absolute bottom） */
  embedded?: boolean;
  /** 橫屏全屏接單大廳：列表區可捲動 */
  hallFullscreen?: boolean;
  /** 列表標題（預設「大廳」） */
  listTitle?: string;
  /** 預約 Tab：按預約時間排序 */
  orderSort?: 'newest' | 'scheduledNearest';
  confirmButtonLabel?: string;
  /** 大廳：預約柯打按鈕顯示「接受預約」（仍走 onConfirmOrder 接單邏輯） */
  hallScheduledHintOnly?: boolean;
  /** 全屏大廳：唔顯示左上角標題／待派說明兩行 */
  hideHallListHeader?: boolean;
  /** 大廳：首次待派列表未就緒 */
  hallDispatchReady?: boolean;
  /** 已接預約：取消／放出 */
  onCancelReservedOrder?: (order: OrderOffer) => void;
  onReleaseReservedOrder?: (order: OrderOffer) => void;
  cancellingReservedOrderId?: string | null;
  releasingReservedOrderId?: string | null;
  /** 自己出嘅貨主柯打：取消放出 */
  onCancelOwnDriverPost?: (order: OrderOffer) => void;
  cancellingOwnDriverPostOrderId?: string | null;
  /** 預約 Tab：用車前 45 分鐘內才可「開始接客」 */
  scheduledStartTrip45MinGate?: boolean;
};

function isDriverReservedScheduledOrder(order: OrderOffer): boolean {
  return order.orderStatus === 'accepted' && !!order.scheduledAt?.trim();
}

export function OrderBottomSheet({
  online,
  hasActiveTrip,
  availableOrders = [],
  onPickOrder,
  onConfirmOrder,
  confirmingOrderId = null,
  currentDriverId = null,
  onClearLocalTrip,
  embedded,
  hallFullscreen,
  listTitle,
  orderSort = 'newest',
  confirmButtonLabel,
  hallScheduledHintOnly = false,
  hideHallListHeader = false,
  hallDispatchReady = true,
  onCancelReservedOrder,
  onReleaseReservedOrder,
  cancellingReservedOrderId = null,
  releasingReservedOrderId = null,
  onCancelOwnDriverPost,
  cancellingOwnDriverPostOrderId = null,
  scheduledStartTrip45MinGate = false,
}: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const nowMs = useMinuteClock();
  const driving = useDrivingUi();
  const { isLandscape } = useLayoutMode();
  const { pickupRadiusKm } = useDriverSettings();
  const { coord: driverCoord } = useDriverWatchPosition(!hasActiveTrip);

  let title = listTitle ?? '大廳';
  let body = '登入並通過審批後即可在此接收柯打。';
  let icon: ComponentProps<typeof Ionicons>['name'] = 'hourglass-outline';

  if (online && !hasActiveTrip) {
    const radiusLimited = !isUnlimitedPickupRadius(pickupRadiusKm);
    if (radiusLimited && !driverCoord) {
      body = `已設定 ${formatPickupRadiusLabel(pickupRadiusKm)}。定位中… 範圍內柯打會顯示於下列列表（App 在前景時不彈提示）。`;
    } else if (radiusLimited && availableOrders.length === 0) {
      body = `已設定 ${formatPickupRadiusLabel(pickupRadiusKm)}，範圍內暫無柯打。`;
    } else if (availableOrders.length > 0) {
      body =
        orderSort === 'scheduledNearest'
          ? radiusLimited
            ? `${formatPickupRadiusLabel(pickupRadiusKm)} · 預約 ${availableOrders.length} 單 · 按時間由近到遠`
            : `預約 ${availableOrders.length} 單 · 按時間由近到遠 · 點選後確認接單`
          : radiusLimited
            ? `${formatPickupRadiusLabel(pickupRadiusKm)} · 待派 ${availableOrders.length} 單 · 點選後確認接單`
            : `待派 ${availableOrders.length} 單 · 點選後確認接單`;
    } else {
      body =
        orderSort === 'scheduledNearest'
          ? radiusLimited
            ? `${formatPickupRadiusLabel(pickupRadiusKm)} · 暫無預約柯打`
            : '暫無預約柯打'
          : radiusLimited
            ? `${formatPickupRadiusLabel(pickupRadiusKm)} · 監聽新柯打中…（前景僅列表，背景才彈提示）`
            : '監聽新柯打中…（前景僅列表，背景才彈提示）';
    }
    icon = orderSort === 'scheduledNearest' ? 'calendar-outline' : 'list-outline';
  }
  if (hasActiveTrip) {
    title = '行程進行中';
    body = '請在行程頁更新狀態。';
    icon = 'car-sport-outline';
  }

  const overlayMaxHeight = isLandscape ? undefined : '58%';

  const ordersToShow = useMemo(() => {
    const sorted =
      orderSort === 'scheduledNearest'
        ? sortScheduledOrdersNearestFirst(availableOrders)
        : sortHallOrdersNearestPickupFirst(availableOrders);
    return hallFullscreen ? sorted : sorted.slice(0, 12);
  }, [availableOrders, hallFullscreen, orderSort]);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (!ordersToShow.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [ordersToShow, selectedOrderId]);

  useEffect(() => {
    if (hasActiveTrip) setSelectedOrderId(null);
  }, [hasActiveTrip]);

  const orderCards = online && !hasActiveTrip && ordersToShow.length > 0
    ? ordersToShow.map((o) => {
        const startTripTooEarly =
          scheduledStartTrip45MinGate &&
          !!o.scheduledAt?.trim() &&
          !canStartScheduledTripNow(o.scheduledAt, nowMs);
        return hallFullscreen ? (
          <DriverHallOrderCard
            key={o.id}
            order={o}
            isOwnDriverPost={isOwnDriverPostedHallOrder(o, currentDriverId)}
            selected={selectedOrderId === o.id}
            confirming={confirmingOrderId === o.id}
            onPress={() => {
              setSelectedOrderId((prev) => (prev === o.id ? null : o.id));
            }}
            onConfirm={() => {
              if (startTripTooEarly && o.scheduledAt?.trim()) {
                const { title, message } = scheduledStartTripBlockedAlert(o.scheduledAt);
                Alert.alert(title, message);
                return;
              }
              onConfirmOrder?.(o);
            }}
            confirmButtonLabel={
              confirmButtonLabel ??
              (hallScheduledHintOnly && o.scheduledAt?.trim() ? '接受預約' : undefined)
            }
            confirmMuted={startTripTooEarly}
            showReservedActions={isDriverReservedScheduledOrder(o)}
            onCancelOrder={() => onCancelReservedOrder?.(o)}
            onReleaseOrder={() => onReleaseReservedOrder?.(o)}
            cancelling={cancellingReservedOrderId === o.id}
            releasing={releasingReservedOrderId === o.id}
            onCancelOwnDriverPost={() => onCancelOwnDriverPost?.(o)}
            cancellingOwnDriverPost={cancellingOwnDriverPostOrderId === o.id}
          />
        ) : (
          <LegacyOrderRow
            key={o.id}
            order={o}
            driving={driving}
            onPress={() => onPickOrder?.(o)}
          />
        );
      })
    : null;

  const hallShowLoading =
    hallFullscreen && online && !hasActiveTrip && !hallDispatchReady;
  const hallShowEmpty =
    hallFullscreen &&
    online &&
    !hasActiveTrip &&
    hallDispatchReady &&
    ordersToShow.length === 0;
  const radiusHint =
    !isUnlimitedPickupRadius(pickupRadiusKm) ? formatPickupRadiusLabel(pickupRadiusKm) : null;

  if (hallFullscreen) {
    if (hallShowLoading || hallShowEmpty) {
      return (
        <View style={styles.hallRoot}>
          <DriverHallDispatchPlaceholder
            mode={hallShowLoading ? 'loading' : 'empty'}
            radiusHint={radiusHint}
          />
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.hallRoot}
        contentContainerStyle={styles.hallScrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {hideHallListHeader ? null : (
          <View style={styles.hallHeader}>
            <View style={styles.row}>
              <Ionicons name={icon} size={driving.iconSize - 4} color={colors.brandYellow} />
              <Text style={[styles.title, { fontSize: driving.titleSize - 2 }]}>{title}</Text>
            </View>
            <Text style={[styles.hallBody, { fontSize: driving.metaSize }]}>{body}</Text>
          </View>
        )}

        {orderCards}

        {hasActiveTrip && onClearLocalTrip ? (
          <Pressable
            style={[styles.clearBtn, styles.hallClearBtn, { minHeight: driving.touchMin }]}
            onPress={onClearLocalTrip}
            accessibilityRole="button"
          >
            <Text style={[styles.clearBtnText, { fontSize: driving.secondaryTextSize }]}>
              離開行程／返回接單
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.sheet,
        embedded ? styles.sheetEmbedded : styles.sheetOverlay,
        !embedded && overlayMaxHeight ? { maxHeight: overlayMaxHeight } : null,
      ]}
    >
      {!embedded ? <View style={styles.handle} /> : null}
      <View style={styles.row}>
        <Ionicons name={icon} size={driving.iconSize - 4} color={colors.brandYellow} />
        <Text style={[styles.title, { fontSize: driving.titleSize - 2 }]}>{title}</Text>
      </View>
      <Text style={[styles.body, { fontSize: driving.metaSize, marginBottom: orderCards ? 6 : 10 }]}>
        {body}
      </Text>

      {orderCards ? <View style={styles.list}>{orderCards}</View> : null}

      {hasActiveTrip && onClearLocalTrip ? (
        <Pressable
          style={[styles.clearBtn, { minHeight: driving.touchMin }]}
          onPress={onClearLocalTrip}
          accessibilityRole="button"
        >
          <Text style={[styles.clearBtnText, { fontSize: driving.secondaryTextSize }]}>
            離開行程／返回接單
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.panelBg,
    borderColor: colors.borderSubtle,
  },
  sheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  sheetEmbedded: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  hallRoot: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  hallHeader: {
    flexShrink: 0,
    paddingBottom: 6,
  },
  hallBody: {
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: 4,
  },
  hallScrollContent: {
    gap: 14,
    paddingBottom: 24,
  },
  hallClearBtn: {
    marginTop: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#444',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { color: colors.text, fontWeight: '800', flexShrink: 1 },
  body: { color: colors.textMuted, lineHeight: 22, marginBottom: 10 },
  list: { gap: 10, marginTop: 4 },
  orderRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  orderId: { color: colors.textMuted, fontWeight: '600' },
  orderPickupDist: { color: colors.textMuted, fontWeight: '700', marginBottom: 4 },
  orderStops: { gap: 8, marginTop: 2 },
  orderStopBlock: { gap: 2 },
  orderStopTag: { color: colors.textMuted, fontWeight: '700' },
  orderRoute: { color: colors.text, fontWeight: '600', lineHeight: 22 },
  orderFare: { color: colors.brandYellow, fontWeight: '800' },
  orderPoints: { color: '#9cdc9c', marginTop: 6, lineHeight: 20 },
  clearBtn: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  clearBtnText: { color: colors.textMuted, fontWeight: '700' },
});
