import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { openExternalMap } from '../navigation/externalMaps';
import { getPreferredExternalMapApp } from '../navigation/preferredNavigationApp';
import type { NavigationTarget } from '../navigation/navigationTarget';
import type { OrderOffer, TripPhase } from '../types/order';
import { passengerOrderTripChatEnabled } from '@taxima/shared';
import { colors } from '../theme/colors';
import {
  driverPostedTripOwnerPhone,
  driverPostedTripPassengerPhone,
  formatHallPointsBadge,
  hallOrderExtraLinesForDisplay,
  isDriverPostedHallOrder,
} from '../trip/driverHallOrderDisplay';
import { ActiveTripInlineChat } from './ActiveTripInlineChat';
import { DRIVER_QUICK_CHAT } from '../trip/driverQuickChatMessages';

type Props = {
  order: OrderOffer;
  phase: TripPhase;
  pickupTarget: NavigationTarget;
  dropoffTarget: NavigationTarget;
  onCancel?: () => void;
  cancelling?: boolean;
  onProceed?: () => void;
  proceeding?: boolean;
  onRelease?: () => void;
  releasing?: boolean;
  onSendQuickChat?: (body: string) => void;
  onCallPassenger?: () => void;
  onCallShootGuest?: () => void;
  onCallShootOwner?: () => void;
  quickChatSending?: boolean;
};

export function ActiveTripPanel({
  order,
  phase,
  pickupTarget,
  dropoffTarget,
  onCancel,
  cancelling,
  onProceed,
  proceeding,
  onRelease,
  releasing,
  onSendQuickChat,
  onCallPassenger,
  onCallShootGuest,
  onCallShootOwner,
  quickChatSending,
}: Props) {
  const { isLandscape } = useLayoutMode();
  const isShoot = isDriverPostedHallOrder(order);
  const badge = formatHallPointsBadge(order);
  const busy = !!(cancelling || proceeding || releasing || quickChatSending);
  const proceedLabel = phase === 'to_dropoff' ? '完成行程' : '進行訂單';
  const detailLines = hallOrderExtraLinesForDisplay(order);
  const extraLine = detailLines.join(' · ');
  const tripChatEnabled =
    !isShoot &&
    passengerOrderTripChatEnabled({
      passengerContactCall: order.passengerContactCall,
      passengerContactSms: order.passengerContactSms,
    });
  const hasPassengerPhone = Boolean(order.passengerPhone?.trim());
  const showPassengerQuickActions = !isShoot && (tripChatEnabled || hasPassengerPhone);
  const shootPassengerPhone = isShoot ? driverPostedTripPassengerPhone(order) : null;
  const shootOwnerPhone = isShoot ? driverPostedTripOwnerPhone(order) : null;
  const showShootCallActions =
    isShoot && Boolean(onCallShootGuest || onCallShootOwner);

  const openNavigation = useCallback(async (target: NavigationTarget) => {
    const provider = await getPreferredExternalMapApp();
    await openExternalMap(provider, target);
  }, []);

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
      <View style={styles.summaryCard}>
        {isShoot ? (
          <View style={styles.shootBanner}>
            <Text style={styles.shootBannerText}>射柯打</Text>
          </View>
        ) : null}
        <View style={styles.summaryMain}>
          <View style={styles.routeRow}>
            <Text style={styles.routeEnd} numberOfLines={2} ellipsizeMode="tail">
              {order.pickupLabel.trim()}
            </Text>

            <View
              style={[
                styles.scorePill,
                badge.tone === 'red' ? styles.scorePillRed : styles.scorePillYellow,
              ]}
            >
              <Text
                style={[
                  styles.scoreText,
                  badge.tone === 'red' ? styles.scoreTextOnRed : styles.scoreTextOnYellow,
                ]}
              >
                {badge.text}
              </Text>
            </View>

            <Text
              style={[styles.routeEnd, styles.routeEndRight]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {order.dropoffLabel.trim()}
            </Text>
          </View>
        </View>

        {detailLines.length > 0 ? (
          <View style={styles.summaryFooter}>
            {isShoot ? (
              detailLines.map((line) => (
                <Text key={line} style={styles.footerTagLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.footerTag}>{extraLine}</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.navRow}>
        <Pressable
          style={styles.navBtn}
          onPress={() => void openNavigation(pickupTarget)}
          accessibilityRole="button"
          accessibilityLabel="導航起點"
        >
          <Text style={styles.navBtnTitle}>導航</Text>
          <Text style={styles.navBtnSub} numberOfLines={2}>
            起點
          </Text>
        </Pressable>
        <Pressable
          style={styles.navBtn}
          onPress={() => void openNavigation(dropoffTarget)}
          accessibilityRole="button"
          accessibilityLabel="導航目的地"
        >
          <Text style={styles.navBtnTitle}>導航</Text>
          <Text style={styles.navBtnSub} numberOfLines={2}>
            目的地
          </Text>
        </Pressable>
      </View>

      {showShootCallActions ? (
        <View style={styles.quickActions}>
          <View style={styles.shootCallRow}>
            {onCallShootGuest ? (
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionCallPassenger,
                  styles.shootCallBtn,
                  busy && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="乘客電話"
                disabled={busy}
                onPress={onCallShootGuest}
              >
                <Text style={styles.actionTextLight}>乘客電話</Text>
              </Pressable>
            ) : null}
            {onCallShootOwner ? (
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionCallOwner,
                  styles.shootCallBtn,
                  busy && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="致電貨主"
                disabled={busy}
                onPress={onCallShootOwner}
              >
                <Text style={styles.actionTextLight}>致電貨主</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {showPassengerQuickActions ? (
        <View style={styles.quickActions}>
          {tripChatEnabled ? (
            <>
              <Pressable
                style={[styles.ghostCallMeBtn, busy && styles.actionDisabled]}
                accessibilityRole="button"
                accessibilityLabel="致電給我"
                disabled={busy || !onSendQuickChat}
                onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.callMe)}
              >
                <Text style={styles.ghostCallMeText}>致電給我</Text>
              </Pressable>

              <View style={styles.actionGrid}>
                <View style={styles.actionCol}>
                  <Pressable
                    style={[styles.actionBtn, styles.actionArrived, busy && styles.actionDisabled]}
                    accessibilityRole="button"
                    disabled={busy || !onSendQuickChat}
                    onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.arrived)}
                  >
                    <Text style={styles.actionTextLight}>到達現場</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionThreeMin, busy && styles.actionDisabled]}
                    accessibilityRole="button"
                    disabled={busy || !onSendQuickChat}
                    onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.threeMin)}
                  >
                    <Text style={styles.actionTextLight}>三分鐘到</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionSevenMin, busy && styles.actionDisabled]}
                    accessibilityRole="button"
                    disabled={busy || !onSendQuickChat}
                    onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.sevenNineMin)}
                  >
                    <Text style={styles.actionTextDark}>7-9分鐘</Text>
                  </Pressable>
                </View>
                <View style={styles.actionCol}>
                  <Pressable
                    style={[styles.actionBtn, styles.actionOneMin, busy && styles.actionDisabled]}
                    accessibilityRole="button"
                    disabled={busy || !onSendQuickChat}
                    onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.oneMin)}
                  >
                    <Text style={styles.actionTextLight}>一分鐘到</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionFourMin, busy && styles.actionDisabled]}
                    accessibilityRole="button"
                    disabled={busy || !onSendQuickChat}
                    onPress={() => onSendQuickChat?.(DRIVER_QUICK_CHAT.fourSixMin)}
                  >
                    <Text style={styles.actionTextDark}>4-6分鐘</Text>
                  </Pressable>
                  {hasPassengerPhone ? (
                    <Pressable
                      style={[
                        styles.actionBtn,
                        styles.actionCallPassenger,
                        busy && styles.actionDisabled,
                      ]}
                      accessibilityRole="button"
                      disabled={busy || !onCallPassenger}
                      onPress={onCallPassenger}
                    >
                      <Text style={styles.actionTextLight}>致電乘客</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            <Pressable
              style={[styles.actionBtn, styles.callOnlyBtn, busy && styles.actionDisabled]}
              accessibilityRole="button"
              accessibilityLabel="乘客電話"
              disabled={busy || !onCallPassenger}
              onPress={onCallPassenger}
            >
              <Text style={styles.actionTextLight}>乘客電話</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {tripChatEnabled ? (
        <ActiveTripInlineChat
          orderId={order.id}
          style={isLandscape ? styles.inlineChatLandscape : styles.inlineChatPortrait}
          externalBusy={busy}
        />
      ) : null}

      <View style={styles.bottomBar}>
        {onCancel ? (
          <Pressable
            style={[styles.bottomBtn, styles.bottomCancel, busy && styles.bottomBtnDisabled]}
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="取消訂單"
          >
            <Text style={styles.bottomBtnTextLight}>
              {cancelling ? '取消中…' : '取消訂單'}
            </Text>
          </Pressable>
        ) : null}
        {onRelease ? (
          <Pressable
            style={[styles.bottomBtn, styles.bottomRelease, busy && styles.bottomBtnDisabled]}
            onPress={onRelease}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="放出柯打"
          >
            <Text style={styles.bottomBtnTextLight}>{releasing ? '放出中…' : '放出'}</Text>
          </Pressable>
        ) : null}
        {onProceed ? (
          <Pressable
            style={[styles.bottomBtn, styles.bottomProceed, busy && styles.bottomBtnDisabled]}
            onPress={onProceed}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={proceedLabel}
          >
            <Text style={styles.bottomBtnTextDark}>
              {proceeding ? '更新中…' : proceedLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
    gap: 0,
  },
  summaryCard: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#4a4a4a',
  },
  shootBanner: {
    backgroundColor: '#1565c0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  shootBannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryMain: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeEnd: {
    flex: 1,
    color: '#6eb5ff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeEndRight: {
    textAlign: 'right',
  },
  scorePill: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePillYellow: {
    backgroundColor: colors.brandYellow,
  },
  scorePillRed: {
    backgroundColor: '#e53935',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreTextOnYellow: {
    color: '#1a1a1a',
  },
  scoreTextOnRed: {
    color: '#fff',
  },
  summaryFooter: {
    backgroundColor: '#5c5c5c',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  footerTag: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  footerTagLine: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  shootCallRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shootCallHint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  actionCallOwner: { backgroundColor: '#5e35b1' },
  shootCallBtn: { flex: 1 },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  navBtn: {
    flex: 1,
    minHeight: 72,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  navBtnTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  navBtnSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  quickActions: {
    marginTop: 16,
    gap: 12,
  },
  ghostCallMeBtn: {
    alignSelf: 'center',
    minWidth: 200,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostCallMeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCol: {
    flex: 1,
    gap: 10,
  },
  actionBtn: {
    minHeight: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  actionArrived: { backgroundColor: '#00b050' },
  actionThreeMin: { backgroundColor: '#e91e8c' },
  actionSevenMin: { backgroundColor: '#c9a227' },
  actionOneMin: { backgroundColor: '#42a5f5' },
  actionFourMin: { backgroundColor: '#ffeb3b' },
  actionCallPassenger: { backgroundColor: '#e53935' },
  callOnlyBtn: {
    backgroundColor: '#e53935',
    minHeight: 56,
    alignSelf: 'stretch',
  },
  actionDisabled: { opacity: 0.5 },
  actionTextLight: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionTextDark: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  inlineChatPortrait: {
    marginTop: 12,
    marginBottom: 8,
    minHeight: 140,
    maxHeight: 260,
  },
  inlineChatLandscape: {
    marginTop: 10,
    marginBottom: 8,
    minHeight: 72,
    maxHeight: 120,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  bottomBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  bottomBtnDisabled: { opacity: 0.55 },
  bottomCancel: { backgroundColor: '#e53935' },
  bottomRelease: { backgroundColor: '#7b1fa2' },
  bottomProceed: { backgroundColor: '#00b050' },
  bottomBtnTextLight: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomBtnTextDark: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
