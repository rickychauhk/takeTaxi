import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OrderOffer } from '../types/order';
import { OWN_DRIVER_POSTED_ORDER_MARK } from '../constants/driverPostedOrderLabel';
import * as hallOrderDisplay from '../trip/driverHallOrderDisplay';
import { colors } from '../theme/colors';

type Props = {
  order: OrderOffer;
  selected?: boolean;
  confirming?: boolean;
  onPress?: () => void;
  onConfirm?: () => void;
  /** 預設「確定接單」；預約 Tab 用「開始接客」 */
  confirmButtonLabel?: string;
  /** 已接預約：顯示取消／放出 */
  showReservedActions?: boolean;
  onCancelOrder?: () => void;
  onReleaseOrder?: () => void;
  cancelling?: boolean;
  releasing?: boolean;
  /** 未到可開始時間：按鈕變灰，仍可點擊以顯示提示 */
  confirmMuted?: boolean;
  /** 自己出嘅貨主柯打：顯示標記、不可接單 */
  isOwnDriverPost?: boolean;
  /** 自己出嘅貨主柯打：取消放出 */
  onCancelOwnDriverPost?: () => void;
  cancellingOwnDriverPost?: boolean;
};

function renderHallFooterText(
  order: OrderOffer,
  extraText: string,
  extraHasHighlight: boolean,
  extraHasShootBlue: boolean,
) {
  const footerLeadingType = hallOrderDisplay.splitHallLobbyFooterLeadingType(extraText.trim());
  const footerShortStyle = hallOrderDisplay.hallLobbyFooterShortLabelStyle(extraText.trim());

  if (footerLeadingType.typeLabel) {
    return (
      <Text style={[styles.footerTag, styles.footerCentered]}>
        <Text
          style={[
            styles.footerTag,
            footerShortStyle === 'company'
              ? styles.footerCompanyPriceWhite
              : footerShortStyle === 'promo'
                ? styles.footerPromoBlue
                : styles.footerRegularPrice,
          ]}
        >
          {footerLeadingType.typeLabel}
        </Text>
        {footerLeadingType.remainder ? (
          <>
            {' · '}
            <Text style={styles.footerTag}>{footerLeadingType.remainder}</Text>
          </>
        ) : null}
      </Text>
    );
  }
  if (footerShortStyle === 'company') {
    return (
      <Text style={[styles.footerTag, styles.footerCompanyPriceWhite, styles.footerCentered]}>
        {extraText}
      </Text>
    );
  }
  if (footerShortStyle === 'promo') {
    return (
      <Text style={[styles.footerTag, styles.footerPromoBlue, styles.footerCentered]}>{extraText}</Text>
    );
  }
  if (footerShortStyle === 'gold' || footerShortStyle === 'regular') {
    return (
      <Text style={[styles.footerTag, styles.footerRegularPrice, styles.footerCentered]}>
        {extraText}
      </Text>
    );
  }
  if (extraHasHighlight) {
    return (
      <Text style={[styles.footerTag, styles.footerCentered]}>
        {hallOrderDisplay.splitHallFooterHighlightParts(extraText).map((part, i) => {
          if (
            part === hallOrderDisplay.HALL_FOOTER_COMPANY_PRICE_LABEL ||
            part === hallOrderDisplay.HALL_LOBBY_COMPANY_SHORT
          ) {
            return (
              <Text key={`hl-${i}`} style={styles.footerCompanyPriceWhite}>
                {part}
              </Text>
            );
          }
          if (part === hallOrderDisplay.HALL_FOOTER_REGULAR_PRICE_LABEL || part === '千足金') {
            return (
              <Text key={`hl-${i}`} style={styles.footerRegularPrice}>
                {part}
              </Text>
            );
          }
          if (extraHasShootBlue && hallOrderDisplay.hallFooterPartIsShootBlue(part)) {
            return (
              <Text key={`hl-${i}`} style={styles.footerPromoBlue}>
                {part}
              </Text>
            );
          }
          return <Text key={`hl-${i}`}>{part}</Text>;
        })}
      </Text>
    );
  }
  return <Text style={[styles.footerTag, styles.footerCentered]}>{extraText}</Text>;
}

export function DriverHallOrderCard({
  order,
  selected = false,
  confirming = false,
  onPress,
  onConfirm,
  confirmButtonLabel = '確定接單',
  showReservedActions = false,
  onCancelOrder,
  onReleaseOrder,
  cancelling = false,
  releasing = false,
  confirmMuted = false,
  isOwnDriverPost = false,
  onCancelOwnDriverPost,
  cancellingOwnDriverPost = false,
}: Props) {
  const reservedBusy = confirming || cancelling || releasing || cancellingOwnDriverPost;
  const distKm = hallOrderDisplay.hallOrderPickupDistanceKm(order);
  const badge = hallOrderDisplay.formatHallPointsBadge(order);
  const extraLines = hallOrderDisplay.hallOrderExtraLinesForDisplay(order, { forHallLobby: true });
  const extraText = extraLines.join(' · ');
  const extraHasHighlight = hallOrderDisplay.hallFooterNeedsAnyHighlight(order, extraText);
  const extraHasShootBlue = hallOrderDisplay.hallFooterHighlightsShootKeywords(order, extraText);
  const scheduledLabel =
    order.scheduledAt?.trim() ?
      hallOrderDisplay.formatHallScheduledAtLabel(order.scheduledAt)
    : null;
  const routeColorStyle = { color: hallOrderDisplay.hallOrderRouteTextColor(order) };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.mainPress}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <View style={styles.main}>
          <View style={styles.distanceRow}>
            {distKm != null ? (
              <Text style={styles.distance}>
                {hallOrderDisplay.hallOrderPickupDistanceLabel(order)} {distKm.toFixed(1)} km
              </Text>
            ) : (
              <View style={styles.distancePlaceholder} />
            )}
            {isOwnDriverPost ? (
              <View style={styles.ownPostMark}>
                <Text style={styles.ownPostMarkText}>{OWN_DRIVER_POSTED_ORDER_MARK}</Text>
              </View>
            ) : null}
          </View>

          {scheduledLabel ? (
            <Text style={styles.scheduledAt} numberOfLines={2}>
              預約 {scheduledLabel}
            </Text>
          ) : null}

          <View style={styles.routeRow}>
            <Text
              style={[styles.routeEnd, routeColorStyle, selected && styles.routeEndSelected]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
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
              style={[styles.routeEnd, styles.routeEndRight, routeColorStyle, selected && styles.routeEndSelected]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {order.dropoffLabel.trim()}
            </Text>
          </View>
        </View>

        {extraText.length > 0 ? (
          <View style={styles.footer}>
            {renderHallFooterText(order, extraText, extraHasHighlight, extraHasShootBlue)}
          </View>
        ) : null}
      </Pressable>

      {selected && !isOwnDriverPost ? (
        <>
          <Pressable
            style={[
              styles.confirmBtn,
              (reservedBusy || confirmMuted) && styles.confirmBtnDisabled,
            ]}
            onPress={onConfirm}
            disabled={reservedBusy}
            accessibilityRole="button"
            accessibilityLabel={confirmButtonLabel}
          >
            {confirming ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.confirmBtnText}>{confirmButtonLabel}</Text>
            )}
          </Pressable>
          {showReservedActions ? (
            <View style={styles.secondaryRow}>
              <Pressable
                style={[styles.secondaryBtn, styles.secondaryCancel, reservedBusy && styles.secondaryDisabled]}
                onPress={onCancelOrder}
                disabled={reservedBusy}
                accessibilityRole="button"
                accessibilityLabel="取消訂單"
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.secondaryBtnText}>取消訂單</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, styles.secondaryRelease, reservedBusy && styles.secondaryDisabled]}
                onPress={onReleaseOrder}
                disabled={reservedBusy}
                accessibilityRole="button"
                accessibilityLabel="放出"
              >
                {releasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.secondaryBtnText}>放出</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </>
      ) : selected && isOwnDriverPost ? (
        <Pressable
          style={[styles.cancelOwnPostBtn, cancellingOwnDriverPost && styles.confirmBtnDisabled]}
          onPress={onCancelOwnDriverPost}
          disabled={cancellingOwnDriverPost}
          accessibilityRole="button"
          accessibilityLabel="取消柯打"
        >
          {cancellingOwnDriverPost ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.cancelOwnPostBtnText}>取消柯打</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#4a4a4a',
  },
  mainPress: {
    width: '100%',
  },
  main: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  distance: {
    color: '#e8e8e8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  distancePlaceholder: {
    height: 21,
    flex: 1,
  },
  ownPostMark: {
    backgroundColor: colors.brandYellow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ownPostMarkText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '800',
  },
  scheduledAt: {
    color: '#ff5252',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  routeEnd: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  routeEndSelected: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.35)',
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
  footer: {
    backgroundColor: '#5c5c5c',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  footerTag: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  footerCentered: {
    textAlign: 'center',
  },
  footerCompanyPriceWhite: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerPromoBlue: {
    color: '#5D9CEC',
    fontWeight: '800',
  },
  footerRegularPrice: {
    color: '#F4D03F',
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: colors.brandYellow,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  confirmBtnDisabled: {
    opacity: 0.85,
  },
  confirmBtnText: {
    color: colors.onPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelOwnPostBtn: {
    backgroundColor: '#e53935',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelOwnPostBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  secondaryCancel: {
    backgroundColor: '#e53935',
  },
  secondaryRelease: {
    backgroundColor: '#7b1fa2',
  },
  secondaryDisabled: {
    opacity: 0.85,
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
