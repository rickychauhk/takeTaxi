import { useEffect, useMemo, useState } from 'react';
import { ensureChineseOrderLabel } from '../location/labelForOrderStorage';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { TipPickerModal } from '../components/TipPickerModal';
import BookingMoreOptionsScreen, {
  type BookingExtrasSelection,
} from './BookingMoreOptionsScreen';
import { UrbanTaxiIllustration } from '../components/UrbanTaxiIllustration';
import type { LatLng } from '../constants/latLng';
import {
  DRIVER_POST_BOUNTY_OPTIONS,
  type DriverPostBountyPoints,
} from '../api/postDriverOrder';
import {
  PASSENGER_PAYMENT_METHODS,
  type PassengerPaymentMethod,
} from '../constants/paymentMethods';
import { formatScheduleDisplay } from '../datetime/hkScheduleTime';
import { applyCompanyPriceFare } from '@taxima/shared';
import { estimateUrbanTaxiFare, formatHkd } from '../pricing/urbanTaxiFare';
import { SHOOT_UI } from './shootOrderUiConfig';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';

type Props = {
  pickup: LatLng;
  dropoff: LatLng;
  distanceMeters: number;
  durationSeconds: number;
  tunnelTollHkd?: number;
  routeLoading?: boolean;
  /** 出貨頁手動輸入之車資（不含貼士） */
  manualFareHkd?: number | null;
  pointsBalance: number;
  initialBountyPoints?: DriverPostBountyPoints;
  initialBountyChosen?: boolean;
  bookingExtras: BookingExtrasSelection;
  onBookingExtrasChange: (selection: BookingExtrasSelection) => void;
  onBack: () => void;
  onGoPurchasePoints: (requiredPoints: number) => void;
  onConfirmPost: (ctx: {
    fareEstimate: number;
    tipHkd: number;
    extras: BookingExtrasSelection;
    sixSeat: boolean;
    paymentMethods: PassengerPaymentMethod[];
    bountyPoints: DriverPostBountyPoints;
  }) => void | Promise<void>;
  postLoading?: boolean;
};

type FareOption = 'regular' | 'tip' | 'sixSeat';

function Checkbox({
  checked,
  onPress,
  label,
  disabled,
}: {
  checked: boolean;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.checkRow, disabled && styles.checkRowDisabled]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={[styles.checkLabel, disabled && styles.checkLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

export default function ShootReviewOrderScreen({
  pickup,
  dropoff,
  distanceMeters,
  durationSeconds,
  tunnelTollHkd = 0,
  routeLoading,
  manualFareHkd = null,
  pointsBalance,
  initialBountyPoints = 0,
  initialBountyChosen = false,
  bookingExtras,
  onBookingExtrasChange,
  onBack,
  onGoPurchasePoints,
  onConfirmPost,
  postLoading,
}: Props) {
  const { t, locale, pickupTag, dropoffTag } = useI18n();
  const [fareOption, setFareOption] = useState<FareOption>('regular');
  const [taxiSelected, setTaxiSelected] = useState(true);
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipAmountHkd, setTipAmountHkd] = useState(0);
  const [tipPickerVisible, setTipPickerVisible] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PassengerPaymentMethod[]>([]);
  const [bounty, setBounty] = useState<DriverPostBountyPoints>(initialBountyPoints);
  const [bountyChosen, setBountyChosen] = useState(initialBountyChosen);
  const effectiveBounty = bountyChosen ? bounty : 0;
  const [pickupLabel, setPickupLabel] = useState(pickup.label);
  const [dropoffLabel, setDropoffLabel] = useState(dropoff.label);

  useEffect(() => {
    let cancelled = false;
    void ensureChineseOrderLabel(pickup).then((p) => {
      if (!cancelled) setPickupLabel(p.label);
    });
    void ensureChineseOrderLabel(dropoff).then((d) => {
      if (!cancelled) setDropoffLabel(d.label);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup.latitude, pickup.longitude, pickup.label, dropoff.latitude, dropoff.longitude, dropoff.label]);

  const togglePaymentMethod = (key: PassengerPaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const displayFare = useMemo(() => {
    const tip = tipEnabled ? tipAmountHkd : 0;
    const meterPlusTunnel =
      estimateUrbanTaxiFare(distanceMeters) + Math.max(0, Math.round(tunnelTollHkd));
    const base =
      manualFareHkd != null ? manualFareHkd : applyCompanyPriceFare(meterPlusTunnel);
    return base + tip;
  }, [distanceMeters, tipEnabled, tipAmountHkd, tunnelTollHkd, manualFareHkd]);

  const tipCheckboxLabel =
    tipEnabled && tipAmountHkd > 0
      ? t('review.tipWithAmount', { amount: formatHkd(tipAmountHkd) })
      : t('review.tip');

  const handleTipPress = () => {
    setTipPickerVisible(true);
  };

  const handleTipConfirm = (amount: number) => {
    setTipPickerVisible(false);
    setTipAmountHkd(amount);
    if (amount <= 0) {
      setTipEnabled(false);
      setFareOption('regular');
    } else {
      setTipEnabled(true);
      setFareOption('tip');
    }
  };

  const handleTipCancel = () => {
    setTipPickerVisible(false);
  };

  if (moreOptionsOpen) {
    return (
      <>
        <BookingMoreOptionsScreen
          initialSelection={bookingExtras}
          tipEnabled={tipEnabled}
          tipAmountHkd={tipAmountHkd}
          onBack={() => setMoreOptionsOpen(false)}
          onConfirm={(sel) => {
            onBookingExtrasChange(sel);
            setMoreOptionsOpen(false);
          }}
          onPressRegular={() => {
            setFareOption('regular');
            setTipEnabled(false);
            setTipAmountHkd(0);
          }}
          onPressTip={() => setTipPickerVisible(true)}
        />
        <TipPickerModal
          visible={tipPickerVisible}
          initialAmount={tipAmountHkd > 0 ? tipAmountHkd : 10}
          onCancel={() => setTipPickerVisible(false)}
          onConfirm={handleTipConfirm}
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScreenSafeArea style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('review.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.tripCard}>
            <Text style={styles.watermark}>{t('home.brand')}</Text>
            <View style={styles.tripRow}>
              <View style={styles.tripIconCol}>
                <View style={[styles.dot, styles.dotPickup]} />
                <View style={styles.tripLine} />
                <View style={[styles.dot, styles.dotDrop]} />
              </View>
              <View style={styles.tripTextCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.tripTag}>{pickupTag}</Text>
                  <Text style={styles.address} numberOfLines={2}>
                    {pickupLabel}
                  </Text>
                </View>
                <View style={[styles.labelRow, { marginTop: 16 }]}>
                  <Text style={styles.tripTag}>{dropoffTag}</Text>
                  <Text style={styles.address} numberOfLines={2}>
                    {dropoffLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.optionsBar}>
            <View style={styles.optionsBarSpacer} />
            <Pressable onPress={() => setMoreOptionsOpen(true)} hitSlop={8}>
              <Text style={styles.optionsBarLink}>{t('review.moreOptions')}</Text>
            </Pressable>
          </View>
          {bookingExtras.scheduledAt ? (
            <Text style={styles.scheduledBanner}>
              {t('review.scheduledAt', {
                time: formatScheduleDisplay(
                  bookingExtras.scheduledAt,
                  'zh-Hant',
                ),
              })}
            </Text>
          ) : null}

          <View style={styles.fareOptionsRow}>
            <Checkbox
              checked={tipEnabled && tipAmountHkd > 0}
              onPress={handleTipPress}
              label={tipCheckboxLabel}
            />
            <Checkbox
              checked={fareOption === 'sixSeat'}
              onPress={() => {
                setFareOption('sixSeat');
                setTipEnabled(false);
                setTipAmountHkd(0);
              }}
              label={t('review.sixSeater')}
            />
          </View>

          <Pressable
            style={styles.taxiRow}
            onPress={() => setTaxiSelected((v) => !v)}
            accessibilityRole="button"
          >
            <UrbanTaxiIllustration />
            <View style={styles.taxiMeta}>
              <Text style={styles.taxiName}>{t('review.taxiUrban')}</Text>
            </View>
            <View style={[styles.checkBox, taxiSelected && styles.checkBoxOn]}>
              {taxiSelected ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          </Pressable>

          <View style={styles.bountySection}>
            <Text style={styles.bountyTitle}>{t('shoot.bountySection')}</Text>
            <Text style={styles.bountyHint}>{t('shoot.bountyHint')}</Text>
            <View style={styles.bountyRow}>
              {DRIVER_POST_BOUNTY_OPTIONS.map((n) => {
                const selected = bountyChosen && bounty === n;
                return (
                  <Pressable
                    key={n}
                    style={[styles.bountyChip, selected && styles.bountyChipOn]}
                    onPress={() => {
                      setBountyChosen(true);
                      setBounty(n);
                    }}
                  >
                    <Text style={[styles.bountyChipText, selected && styles.bountyChipTextOn]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>{t('review.ePayment')}</Text>
            <Text style={styles.paymentHint}>{t('review.payHint')}</Text>
            <View style={styles.paymentIcons}>
              {PASSENGER_PAYMENT_METHODS.map((key) => {
                const selected = paymentMethods.includes(key);
                return (
                  <Pressable
                    key={key}
                    style={[styles.paymentBadge, selected && styles.paymentBadgeSelected]}
                    onPress={() => togglePaymentMethod(key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text
                      style={[styles.paymentBadgeText, selected && styles.paymentBadgeTextSelected]}
                    >
                      {t(`review.pay.${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.callBtn,
              (!taxiSelected || routeLoading || postLoading) && styles.callBtnDisabled,
            ]}
            onPress={() =>
              onConfirmPost({
                fareEstimate: displayFare,
                tipHkd: tipEnabled ? tipAmountHkd : 0,
                extras: bookingExtras,
                sixSeat: fareOption === 'sixSeat',
                paymentMethods,
                bountyPoints: effectiveBounty,
              })
            }
            disabled={!taxiSelected || routeLoading || postLoading}
          >
            {postLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.callBtnText}>{t('shoot.postNow')}</Text>
            )}
          </Pressable>
        </View>
      </ScreenSafeArea>

      <TipPickerModal
        visible={tipPickerVisible}
        initialAmount={tipAmountHkd > 0 ? tipAmountHkd : 10}
        onCancel={handleTipCancel}
        onConfirm={handleTipConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  title: { color: colors.brandYellow, fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  tripCard: {
    backgroundColor: colors.panelBgSolid,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  watermark: {
    position: 'absolute',
    right: 8,
    top: '30%',
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-12deg' }],
  },
  tripRow: { flexDirection: 'row' },
  tripIconCol: { width: 24, alignItems: 'center', paddingTop: 2 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  dotPickup: { backgroundColor: colors.pickupDot },
  dotDrop: { backgroundColor: colors.dropoffDot, borderRadius: 2, width: 12, height: 12 },
  tripLine: { width: 2, flex: 1, backgroundColor: '#666', marginVertical: 4, minHeight: 32 },
  tripTextCol: { flex: 1, paddingHorizontal: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tripTag: { fontSize: 16, fontWeight: '700', color: '#f5f5f5', minWidth: 28 },
  address: { flex: 1, fontSize: 16, color: '#f0f0f0', lineHeight: 22 },
  optionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  optionsBarLeft: { color: '#ccc', fontSize: 15 },
  optionsBarSpacer: { flex: 1 },
  optionsBarLink: { color: colors.brandYellow, fontSize: 15, fontWeight: '600' },
  scheduledBanner: {
    color: colors.brandYellow,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  fareOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkRowDisabled: { opacity: 0.45 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.brandYellow, borderColor: colors.brandYellow },
  checkMark: { color: colors.onPrimary, fontSize: 14, fontWeight: '800', marginTop: -1 },
  checkLabel: { color: '#eee', fontSize: 15 },
  checkLabelDisabled: { color: '#999' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  infoIcon: { color: '#aaa', fontSize: 16 },
  infoText: { flex: 1, color: '#999', fontSize: 12, lineHeight: 17 },
  taxiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  taxiMeta: { flex: 1 },
  taxiName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  taxiSub: { color: '#999', fontSize: 13, marginTop: 4 },
  tunnelSub: { color: colors.brandYellow, fontSize: 12, marginTop: 4 },
  fareCol: { alignItems: 'flex-end', minWidth: 72 },
  fareLabel: { color: '#aaa', fontSize: 12 },
  fareAmount: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 2 },
  bountySection: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.panelBgSolid,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  bountyTitle: { color: '#eee', fontSize: 16, fontWeight: '700' },
  bountyHint: { color: '#999', fontSize: 12, marginTop: 6, lineHeight: 17 },
  bountyBalance: { color: colors.brandYellow, fontSize: 14, marginTop: 8 },
  bountyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  bountyChip: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  bountyChipOn: {
    backgroundColor: SHOOT_UI.red,
    borderColor: '#ffffff',
    borderWidth: 2,
  },
  bountyChipOff: { opacity: 0.35 },
  bountyChipText: { color: '#eee', fontWeight: '700' },
  bountyChipTextOn: { color: '#ffffff', fontWeight: '800' },
  bountyInlineHint: {
    marginTop: 10,
    color: colors.brandYellow,
    fontSize: 13,
    lineHeight: 18,
  },
  paymentSection: { marginTop: 28, paddingHorizontal: 4 },
  paymentTitle: { color: '#eee', fontSize: 16, marginBottom: 6 },
  paymentHint: { color: '#888', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  paymentIcons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentBadge: {
    backgroundColor: '#3a3a3a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3a3a3a',
  },
  paymentBadgeSelected: {
    backgroundColor: colors.brandTintBg,
    borderColor: colors.brandYellow,
  },
  paymentBadgeText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  paymentBadgeTextSelected: { color: colors.brandYellow },
  footer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  callBtn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  callBtnDisabled: { opacity: 0.5 },
  callBtnText: { fontSize: 18, fontWeight: '800', color: colors.onPrimary },
});
