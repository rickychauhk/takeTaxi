import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { TipPickerModal } from '../components/TipPickerModal';
import BookingMoreOptionsScreen, {
  type BookingExtrasSelection,
} from './BookingMoreOptionsScreen';
import { UrbanTaxiIllustration } from '../components/UrbanTaxiIllustration';
import type { LatLng } from '../constants/demoDestinations';
import {
  PASSENGER_PAYMENT_METHODS,
  type PassengerPaymentMethod,
} from '../constants/paymentMethods';
import { formatScheduleDisplay } from '../datetime/hkScheduleTime';
import {
  applyCompanyPriceFare,
  defaultPassengerAutoTipHkdPublic,
  formatHongKongPhoneInputValue,
  formatHongKongPhoneValidationMessage,
  validateHongKongLocalPhone,
} from '@taxima/shared';
import { CompanyPriceConfirmModal } from '../components/CompanyPriceConfirmModal';
import { estimateUrbanTaxiFare, estimateUrbanTaxiTotal, formatHkd } from '../pricing/urbanTaxiFare';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';
import { fetchBookingOptions, type BookingOptionCategoryDto } from '../api/bookingOptions';
import { fetchPassengerAutoTipConfig, type PassengerAutoTipConfig } from '../api/passengerAutoTip';
import { computeRequiredPassengerAutoTipHkd } from '../booking/passengerAutoTipApply';
import { bookingExtrasRequireRegularPrice } from '../booking/regularPriceRules';

type Props = {
  pickup: LatLng;
  dropoff: LatLng;
  distanceMeters: number;
  durationSeconds: number;
  tunnelTollHkd?: number;
  routeLoading?: boolean;
  pointsBalance?: number;
  pointsHkdPerPoint?: number;
  pointsRedeemEnabled?: boolean;
  bookingExtras: BookingExtrasSelection;
  onBookingExtrasChange: (selection: BookingExtrasSelection) => void;
  onBack: () => void;
  onCallCar: (ctx: {
    fareEstimate: number;
    tipHkd: number;
    extras: BookingExtrasSelection;
    sixSeat: boolean;
    paymentMethods: PassengerPaymentMethod[];
    pointsToRedeem: number;
    passengerContactCall: boolean;
    passengerContactSms: boolean;
    orderContactPhone?: string;
    companyPrice: boolean;
    safeDriving: boolean;
  }) => void | Promise<void>;
  callLoading?: boolean;
};

function computePointsRedemption(
  grossFareHkd: number,
  pointsBalance: number,
  pointsRequested: number,
  hkdPerPoint: number,
) {
  const gross = Math.max(0, grossFareHkd);
  if (hkdPerPoint <= 0 || gross <= 0) {
    return { pointsRedeemed: 0, discountHkd: 0, netFareHkd: gross };
  }
  const balance = Math.max(0, Math.floor(pointsBalance));
  const requested = Math.max(0, Math.floor(pointsRequested));
  const maxByFare = Math.floor(gross / hkdPerPoint);
  const pointsRedeemed = Math.min(requested, balance, maxByFare);
  const discountHkd = Math.round(pointsRedeemed * hkdPerPoint * 100) / 100;
  const netFareHkd = Math.max(0, Math.round((gross - discountHkd) * 100) / 100);
  return { pointsRedeemed, discountHkd, netFareHkd };
}

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

export default function ReviewOrderScreen({
  pickup,
  dropoff,
  distanceMeters,
  durationSeconds,
  tunnelTollHkd = 0,
  routeLoading,
  pointsBalance = 0,
  pointsHkdPerPoint = 1,
  pointsRedeemEnabled = true,
  bookingExtras,
  onBookingExtrasChange,
  onBack,
  onCallCar,
  callLoading,
}: Props) {
  const { t, locale, pickupTag, dropoffTag } = useI18n();
  const [fareOption, setFareOption] = useState<FareOption>('regular');
  const [taxiSelected, setTaxiSelected] = useState(true);
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipAmountHkd, setTipAmountHkd] = useState(0);
  const [tipPickerVisible, setTipPickerVisible] = useState(false);
  const [tipPickerInitialHkd, setTipPickerInitialHkd] = useState(10);
  const prevRequiredAutoTipRef = useRef(0);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PassengerPaymentMethod[]>([]);
  const [passengerContactCall, setPassengerContactCall] = useState(true);
  const [passengerContactSms, setPassengerContactSms] = useState(false);
  const [bookingForOthers, setBookingForOthers] = useState(false);
  const [orderContactPhone, setOrderContactPhone] = useState('');
  const [useRegularPrice, setUseRegularPrice] = useState(true);
  const [companyPriceAcknowledged, setCompanyPriceAcknowledged] = useState(false);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [safeDriving, setSafeDriving] = useState(false);
  const [bookingOptionCategories, setBookingOptionCategories] = useState<BookingOptionCategoryDto[]>(
    [],
  );
  const [autoTipConfig, setAutoTipConfig] = useState<PassengerAutoTipConfig>(() =>
    defaultPassengerAutoTipHkdPublic(),
  );

  useEffect(() => {
    let cancelled = false;
    void fetchBookingOptions().then((data) => {
      if (!cancelled) setBookingOptionCategories(data.categories);
    });
    void fetchPassengerAutoTipConfig().then((cfg) => {
      if (!cancelled) setAutoTipConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const extrasRequireRegularPrice = useMemo(
    () => bookingExtrasRequireRegularPrice(bookingOptionCategories, bookingExtras.selectedOptionIds),
    [bookingOptionCategories, bookingExtras.selectedOptionIds],
  );

  const requiresRegularPrice =
    safeDriving || fareOption === 'sixSeat' || extrasRequireRegularPrice;

  const reviewSixSeatSelected = fareOption === 'sixSeat';

  const requiredAutoTipHkd = useMemo(
    () =>
      computeRequiredPassengerAutoTipHkd(
        autoTipConfig,
        bookingOptionCategories,
        bookingExtras.selectedOptionIds,
        safeDriving,
        reviewSixSeatSelected,
      ),
    [
      autoTipConfig,
      bookingOptionCategories,
      bookingExtras.selectedOptionIds,
      safeDriving,
      reviewSixSeatSelected,
    ],
  );

  useEffect(() => {
    const prev = prevRequiredAutoTipRef.current;
    prevRequiredAutoTipRef.current = requiredAutoTipHkd;
    if (requiredAutoTipHkd <= 0) return;
    if (requiredAutoTipHkd > prev && !tipEnabled) {
      setTipPickerInitialHkd(requiredAutoTipHkd);
      setTipPickerVisible(true);
    }
  }, [requiredAutoTipHkd, tipEnabled]);

  useEffect(() => {
    if (!requiresRegularPrice) return;
    setUseRegularPrice(true);
    setCompanyPriceAcknowledged(false);
    setCompanyModalVisible(false);
  }, [requiresRegularPrice]);

  const togglePaymentMethod = (key: PassengerPaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const displayFare = useMemo(() => {
    const tip = tipEnabled ? tipAmountHkd : 0;
    const meterPlusTunnel = estimateUrbanTaxiFare(distanceMeters) + Math.max(0, Math.round(tunnelTollHkd));
    const subtotal = useRegularPrice ? meterPlusTunnel : applyCompanyPriceFare(meterPlusTunnel);
    return subtotal + tip;
  }, [distanceMeters, tipEnabled, tipAmountHkd, tunnelTollHkd, useRegularPrice]);

  const maxRedeemablePoints = useMemo(() => {
    const hkd = pointsHkdPerPoint > 0 ? pointsHkdPerPoint : 0;
    if (hkd <= 0) return 0;
    return Math.min(
      Math.floor(pointsBalance),
      Math.floor(displayFare / hkd),
    );
  }, [displayFare, pointsBalance, pointsHkdPerPoint]);

  useEffect(() => {
    setPointsToUse((prev) => Math.min(Math.max(0, prev), maxRedeemablePoints));
  }, [maxRedeemablePoints]);

  const redemption = useMemo(
    () =>
      computePointsRedemption(
        displayFare,
        pointsBalance,
        pointsToUse,
        pointsHkdPerPoint > 0 ? pointsHkdPerPoint : 0,
      ),
    [displayFare, pointsBalance, pointsHkdPerPoint, pointsToUse],
  );

  const payableFare = redemption.netFareHkd;

  const tipCheckboxLabel =
    tipEnabled && tipAmountHkd > 0
      ? t('review.tipWithAmount', { amount: formatHkd(tipAmountHkd) })
      : t('review.tip');

  const openTipPicker = (seedHkd?: number) => {
    const seed =
      seedHkd ??
      (requiredAutoTipHkd > 0 ? requiredAutoTipHkd : tipAmountHkd > 0 ? tipAmountHkd : 10);
    setTipPickerInitialHkd(seed);
    setTipPickerVisible(true);
  };

  const handleTipPress = () => {
    openTipPicker();
  };

  const handleTipConfirm = (amount: number) => {
    setTipPickerVisible(false);
    setTipAmountHkd(amount);
    if (amount <= 0) {
      setTipEnabled(false);
      if (fareOption === 'tip') setFareOption('regular');
    } else {
      setTipEnabled(true);
      if (fareOption !== 'sixSeat') setFareOption('tip');
    }
  };

  const handleTipCancel = () => {
    setTipPickerVisible(false);
  };

  const durationMin = Math.max(1, Math.round(durationSeconds / 60));

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
          onPressTip={() => openTipPicker()}
          autoTipConfig={autoTipConfig}
          onOpenTipPicker={(seed) => openTipPicker(seed)}
        />
        <TipPickerModal
          visible={tipPickerVisible}
          initialAmount={tipPickerInitialHkd}
          onCancel={handleTipCancel}
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
                    {pickup.label}
                  </Text>
                </View>
                <View style={[styles.labelRow, { marginTop: 16 }]}>
                  <Text style={styles.tripTag}>{dropoffTag}</Text>
                  <Text style={styles.address} numberOfLines={2}>
                    {dropoff.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.optionsBar}>
            <Text style={styles.optionsBarLeft}>{t('review.regularPrice')}</Text>
            <Pressable onPress={() => setMoreOptionsOpen(true)} hitSlop={8}>
              <Text style={styles.optionsBarLink}>{t('review.moreOptions')}</Text>
            </Pressable>
          </View>
          {bookingExtras.scheduledAt ? (
            <Text style={styles.scheduledBanner}>
              {t('review.scheduledAt', {
                time: formatScheduleDisplay(
                  bookingExtras.scheduledAt,
                  locale === 'en' ? 'en' : 'zh-Hant',
                ),
              })}
            </Text>
          ) : null}

          <View style={styles.fareOptionsRow}>
            <Checkbox
              checked={useRegularPrice && !(tipEnabled && tipAmountHkd > 0)}
              disabled={requiresRegularPrice}
              onPress={() => {
                if (requiresRegularPrice) {
                  Alert.alert(t('review.regularPrice'), t('review.regularPriceRequired'));
                  return;
                }
                if (useRegularPrice) {
                  setUseRegularPrice(false);
                  setCompanyPriceAcknowledged(false);
                  setCompanyModalVisible(true);
                  setFareOption('regular');
                  setTipEnabled(false);
                  setTipAmountHkd(0);
                } else {
                  setUseRegularPrice(true);
                  setCompanyPriceAcknowledged(false);
                }
              }}
              label={t('review.regularPrice')}
            />
            <Checkbox
              checked={tipEnabled && tipAmountHkd > 0}
              onPress={handleTipPress}
              label={tipCheckboxLabel}
            />
            <Checkbox
              checked={fareOption === 'sixSeat'}
              onPress={() => {
                if (fareOption === 'sixSeat') {
                  setFareOption('regular');
                  return;
                }
                setFareOption('sixSeat');
                queueMicrotask(() =>
                  openTipPicker(Math.max(0, Math.round(autoTipConfig.sixSeatTipHkd)) || 10),
                );
              }}
              label={t('review.sixSeater')}
            />
            <Checkbox
              checked={safeDriving}
              onPress={() => {
                if (safeDriving) {
                  setSafeDriving(false);
                  return;
                }
                setSafeDriving(true);
                queueMicrotask(() =>
                  openTipPicker(Math.max(0, Math.round(autoTipConfig.safeDrivingTipHkd)) || 10),
                );
              }}
              label={t('review.safeDriving')}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>ⓘ</Text>
            <Text style={styles.infoText}>{t('review.fareDisclaimer')}</Text>
          </View>

          <Pressable
            style={styles.taxiRow}
            onPress={() => setTaxiSelected((v) => !v)}
            accessibilityRole="button"
          >
            <UrbanTaxiIllustration />
            <View style={styles.taxiMeta}>
              <Text style={styles.taxiName}>{t('review.taxiUrban')}</Text>
              <Text style={styles.taxiSub}>
                {routeLoading
                  ? t('review.calculatingRoute')
                  : t('review.routeMeta', {
                      km: (distanceMeters / 1000).toFixed(1),
                      min: String(durationMin),
                    })}
              </Text>
              {!routeLoading && tunnelTollHkd > 0 ? (
                <Text style={styles.tunnelSub}>
                  {t('review.tunnelSurcharge', { amount: formatHkd(tunnelTollHkd) })}
                </Text>
              ) : null}
            </View>
            <View style={styles.fareCol}>
              <Text style={styles.fareLabel}>
                {useRegularPrice ? t('review.estimate') : t('review.companyPrice')}
              </Text>
              {routeLoading ? (
                <ActivityIndicator color={colors.brandYellow} size="small" />
              ) : (
                <Text style={styles.fareAmount}>{formatHkd(displayFare)}</Text>
              )}
            </View>
            <View style={[styles.checkBox, taxiSelected && styles.checkBoxOn]}>
              {taxiSelected ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          </Pressable>

          {pointsRedeemEnabled && maxRedeemablePoints > 0 ? (
            <View style={styles.pointsSection}>
              <Text style={styles.pointsTitle}>
                {t('review.pointsPickerTitle', {
                  balance: String(Math.floor(pointsBalance)),
                  max: String(maxRedeemablePoints),
                })}
              </Text>
              <View style={styles.pointsStepperRow}>
                <Pressable
                  style={[styles.pointsStepBtn, pointsToUse <= 0 && styles.pointsStepBtnDisabled]}
                  onPress={() => setPointsToUse((n) => Math.max(0, n - 1))}
                  disabled={pointsToUse <= 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('review.pointsDecrease')}
                >
                  <Text style={styles.pointsStepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.pointsStepValue}>{pointsToUse}</Text>
                <Pressable
                  style={[
                    styles.pointsStepBtn,
                    pointsToUse >= maxRedeemablePoints && styles.pointsStepBtnDisabled,
                  ]}
                  onPress={() => setPointsToUse((n) => Math.min(maxRedeemablePoints, n + 1))}
                  disabled={pointsToUse >= maxRedeemablePoints}
                  accessibilityRole="button"
                  accessibilityLabel={t('review.pointsIncrease')}
                >
                  <Text style={styles.pointsStepBtnText}>+</Text>
                </Pressable>
                <Text style={styles.pointsStepUnit}>{t('review.pointsUnit')}</Text>
              </View>
              {redemption.discountHkd > 0 ? (
                <>
                  <Text style={styles.pointsDiscount}>
                    {t('review.pointsDiscount', {
                      points: String(redemption.pointsRedeemed),
                      amount: formatHkd(redemption.discountHkd),
                    })}
                  </Text>
                  <Text style={styles.payableFare}>
                    {t('review.payableFare', { amount: formatHkd(payableFare) })}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

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
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>{t('review.contactPrefTitle')}</Text>
            <Text style={styles.contactHint}>{t('review.contactPrefHint')}</Text>
            <View style={styles.contactChecks}>
              <Checkbox
                checked={passengerContactCall}
                onPress={() => setPassengerContactCall((v) => !v)}
                label={t('review.contactCall')}
              />
              <Checkbox
                checked={passengerContactSms}
                onPress={() => setPassengerContactSms((v) => !v)}
                label={t('review.contactSms')}
              />
            </View>
            <View style={styles.bookingForOthersBlock}>
              <Checkbox
                checked={bookingForOthers}
                onPress={() => {
                  setBookingForOthers((v) => {
                    const next = !v;
                    if (!next) setOrderContactPhone('');
                    return next;
                  });
                }}
                label={t('review.bookingForOthers')}
              />
              {bookingForOthers ? (
                <>
                  <Text style={styles.orderContactLabel}>{t('review.orderContactPhoneLabel')}</Text>
                  <Text style={styles.orderContactHint}>{t('review.orderContactPhoneHint')}</Text>
                  <TextInput
                    style={styles.orderContactInput}
                    value={orderContactPhone}
                    onChangeText={(v) => setOrderContactPhone(formatHongKongPhoneInputValue(v))}
                    placeholder={t('review.orderContactPhonePlaceholder')}
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                    maxLength={8}
                    accessibilityLabel={t('review.orderContactPhoneLabel')}
                  />
                </>
              ) : null}
            </View>
          </View>
          <Pressable
            style={[
              styles.callBtn,
              (!taxiSelected || routeLoading || callLoading) && styles.callBtnDisabled,
            ]}
            onPress={() => {
              if (requiresRegularPrice && !useRegularPrice) {
                Alert.alert(t('review.regularPrice'), t('review.regularPriceRequired'));
                return;
              }
              if (!useRegularPrice && !companyPriceAcknowledged) {
                setCompanyModalVisible(true);
                return;
              }
              let contactPhoneForOrder: string | undefined;
              if (bookingForOthers) {
                const phoneV = validateHongKongLocalPhone(orderContactPhone);
                if (!phoneV.ok) {
                  Alert.alert(
                    t('review.orderContactPhoneLabel'),
                    formatHongKongPhoneValidationMessage(
                      phoneV,
                      locale === 'en' ? 'en' : 'zh-Hant',
                    ),
                  );
                  return;
                }
                contactPhoneForOrder = phoneV.local8;
              }
              onCallCar({
                fareEstimate: displayFare,
                tipHkd: tipEnabled ? tipAmountHkd : 0,
                extras: bookingExtras,
                sixSeat: fareOption === 'sixSeat',
                paymentMethods,
                pointsToRedeem: redemption.pointsRedeemed,
                passengerContactCall,
                passengerContactSms,
                orderContactPhone: contactPhoneForOrder,
                companyPrice: requiresRegularPrice ? false : !useRegularPrice,
                safeDriving,
              });
            }}
            disabled={
              !taxiSelected ||
              routeLoading ||
              callLoading ||
              (!requiresRegularPrice && !useRegularPrice && !companyPriceAcknowledged)
            }
          >
            {callLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.callBtnText}>{t('review.callNow')}</Text>
            )}
          </Pressable>
        </View>
      </ScreenSafeArea>

      <TipPickerModal
        visible={tipPickerVisible}
        initialAmount={tipPickerInitialHkd}
        onCancel={handleTipCancel}
        onConfirm={handleTipConfirm}
      />

      <CompanyPriceConfirmModal
        visible={companyModalVisible}
        onCancel={() => {
          setCompanyModalVisible(false);
          setUseRegularPrice(true);
          setCompanyPriceAcknowledged(false);
        }}
        onConfirm={() => {
          if (requiresRegularPrice) {
            setCompanyModalVisible(false);
            setUseRegularPrice(true);
            setCompanyPriceAcknowledged(false);
            Alert.alert(t('review.regularPrice'), t('review.regularPriceRequired'));
            return;
          }
          setCompanyModalVisible(false);
          setCompanyPriceAcknowledged(true);
        }}
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
  pointsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.panelBgSolid,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  pointsTitle: { color: '#ddd', fontSize: 15, lineHeight: 22 },
  pointsStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  pointsStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.mapDark,
    borderWidth: 1,
    borderColor: colors.brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsStepBtnDisabled: { opacity: 0.35 },
  pointsStepBtnText: { color: colors.brandYellow, fontSize: 26, fontWeight: '600', lineHeight: 30 },
  pointsStepValue: {
    minWidth: 40,
    textAlign: 'center',
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  pointsStepUnit: { color: '#aaa', fontSize: 15 },
  pointsDiscount: { color: '#9cdc9c', fontSize: 14, marginTop: 12 },
  payableFare: { color: colors.brandYellow, fontSize: 17, fontWeight: '800', marginTop: 6 },
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
  contactSection: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  contactTitle: { color: '#eee', fontSize: 16, marginBottom: 4 },
  contactHint: { color: '#888', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  contactChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  bookingForOthersBlock: { marginTop: 14, gap: 8 },
  orderContactLabel: { color: '#ddd', fontSize: 15, marginTop: 4 },
  orderContactHint: { color: '#888', fontSize: 12, lineHeight: 17 },
  orderContactInput: {
    marginTop: 4,
    backgroundColor: colors.panelBgSolid,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
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
