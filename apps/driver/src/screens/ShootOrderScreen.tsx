import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { applyCompanyPriceFare, formatHongKongPhoneDisplay } from '@taxima/shared';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { postDriverOrder } from '../api/postDriverOrder';
import type { LatLng } from '../constants/latLng';
import { useShootOrderVoice } from '../hooks/useShootOrderVoice';
import { sanitizePhoneDigitsInput } from '../voice/voiceTranscriptToDigits';
import {
  resolveShootPlaceFromLabel,
  resolveShootPlacesForPost,
  shootPlaceFromLabel,
} from '../location/shootPlaceFromLabel';
import {
  DRIVER_POST_BOUNTY_OPTIONS,
  type DriverPostBountyPoints,
} from '../api/postDriverOrder';
import { I18nProvider } from '../i18n/I18nProvider';
import { ensureChineseOrderLabel } from '../location/labelForOrderStorage';
import { fetchDrivingRoute, type DrivingRouteResult } from '../routing/fetchDrivingRoute';
import { DRIVER_PENDING_APPROVAL_MSG, isDriverApproved } from '../constants/driverApproval';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import type { BookingExtrasSelection } from './BookingMoreOptionsScreen';
import { useTunnelRoutePreference } from '../hooks/useTunnelRoutePreference';
import { fetchBookingOptions } from '../api/bookingOptions';
import type { PassengerPaymentMethod } from '../constants/paymentMethods';
import { estimateUrbanTaxiTotal } from '../pricing/urbanTaxiFare';
import ShootLocationSearchScreen from './ShootLocationSearchScreen';
import ShootReviewOrderScreen from './ShootReviewOrderScreen';
import { ScheduleTimePickerModal } from '../components/ScheduleTimePickerModal';
import {
  SHOOT_BOUNTY_ROW_LABEL,
  SHOOT_DIRECT_ACTIONS,
  SHOOT_DIRECT_COMPANY_PRICE_KINDS,
  SHOOT_DIRECT_LABEL,
  SHOOT_GRID_OPTION_CODES,
  SHOOT_GRID_ROWS,
  SHOOT_UI,
  type ShootDirectAction,
  type ShootDirectKind,
} from './shootOrderUiConfig';

type Step = 'form' | 'confirm';

const TAB_BAR_STYLE = {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
} as const;

function ShootGridChip({
  label,
  selected,
  disabled,
  onPress,
  flexStyle,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  flexStyle?: object;
}) {
  return (
    <Pressable
      style={[
        styles.gridChip,
        flexStyle,
        selected && styles.gridChipOn,
        disabled && !selected && styles.gridChipDisabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.gridChipText, selected && styles.gridChipTextOn]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function ShootDirectMiniButton({
  action,
  disabled,
  onPress,
}: {
  action: ShootDirectAction;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.miniDirect, { backgroundColor: action.backgroundColor }]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={action.darkText ? styles.miniDirectTextDark : styles.miniDirectTextLight}
        numberOfLines={2}
      >
        {action.miniLabel}
      </Text>
    </Pressable>
  );
}

function ShootDirectBottomButton({
  action,
  disabled,
  onPress,
}: {
  action: ShootDirectAction;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.bottomBtn, { backgroundColor: action.backgroundColor }]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={action.darkText ? styles.bottomBtnTextDark : styles.bottomBtnTextLight}
        numberOfLines={2}
      >
        {action.bottomLabel}
      </Text>
    </Pressable>
  );
}

function ShootPhoneField({
  placeholder,
  value,
  onChangeDigits,
  micActive,
  onMicPress,
}: {
  placeholder: string;
  value: string;
  onChangeDigits: (digits: string) => void;
  micActive: boolean;
  onMicPress: () => void;
}) {
  return (
    <View style={styles.phoneInputShell}>
      <TextInput
        style={[styles.input, styles.phoneInputInner]}
        placeholder={placeholder}
        placeholderTextColor={SHOOT_UI.inputPlaceholder}
        value={value}
        onChangeText={(text) => onChangeDigits(sanitizePhoneDigitsInput(text))}
        keyboardType="phone-pad"
      />
      <Pressable
        style={[styles.phoneMicInside, micActive && styles.phoneMicInsideActive]}
        onPress={onMicPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="語音輸入電話數字"
      >
        <Text style={styles.phoneMicIcon}>{micActive ? '🔴' : '🎤'}</Text>
      </Pressable>
    </View>
  );
}

function buildRemarkParts(input: {
  extraRemark: string;
  ownerPhone: string;
  passengerPhone: string;
  directKind?: ShootDirectKind;
  greenTaxi: boolean;
  gridLabels: string[];
}): string {
  const parts: string[] = [];
  if (input.directKind) parts.push(`直出·${SHOOT_DIRECT_LABEL[input.directKind]}`);
  if (input.greenTaxi) parts.push('綠的');
  if (input.ownerPhone.trim()) {
    parts.push(`貨主電話：${formatHongKongPhoneDisplay(input.ownerPhone)}`);
  }
  if (input.passengerPhone.trim()) {
    parts.push(`客人電話：${formatHongKongPhoneDisplay(input.passengerPhone)}`);
  }
  parts.push(...input.gridLabels);
  const extra = input.extraRemark.trim();
  if (extra) parts.push(extra);
  return parts.join(' · ');
}

function parseManualFareHkd(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Math.round(Number(t.replace(/,/g, '')));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const TRIP_VOICE_EXAMPLE = '觀塘去沙田';

function normalizeTripVoiceRawDisplay(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, '');
  if (!t || !/去/.test(t)) return null;
  return t;
}

/** 語音收音 overlay：必須含「去」字 */
function formatTripVoiceLiveHint(
  parsed: { pickup?: string; dropoff?: string },
  raw: string,
): string {
  const pickup = parsed.pickup?.trim();
  const dropoff = parsed.dropoff?.trim();
  if (pickup && dropoff) return `${pickup}去${dropoff}`;
  if (pickup) return `${pickup}去…`;
  if (dropoff) return `…去${dropoff}`;
  const rawDisplay = normalizeTripVoiceRawDisplay(raw);
  if (rawDisplay) return rawDisplay;
  return TRIP_VOICE_EXAMPLE;
}

function shootBaseFareHkd(
  meterTotal: number,
  directKind: ShootDirectKind | undefined,
  manualBase: number | null,
): number {
  if (manualBase != null) return manualBase;
  if (directKind && SHOOT_DIRECT_COMPANY_PRICE_KINDS.has(directKind)) {
    return applyCompanyPriceFare(meterTotal);
  }
  return meterTotal;
}

export default function ShootOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { isLandscape } = useLayoutMode();
  const { driver, refreshProfile } = useDriverAuth();
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng>({ latitude: 22.3193, longitude: 114.1694, label: '' });
  const [step, setStep] = useState<Step>('form');
  const [posting, setPosting] = useState(false);
  const [searchMode, setSearchMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const pickupFocused = useRef(false);
  const dropoffFocused = useRef(false);
  const placeResolveGen = useRef({ pickup: 0, dropoff: 0 });
  const [route, setRoute] = useState<DrivingRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [extraRemark, setExtraRemark] = useState('');
  const [manualFareText, setManualFareText] = useState('');
  const [tripVoiceLiveHint, setTripVoiceLiveHint] = useState<string | null>(null);
  const [greenTaxi, setGreenTaxi] = useState(false);
  const [bountyPoints, setBountyPoints] = useState<DriverPostBountyPoints>(0);
  const [gridOn, setGridOn] = useState<Record<string, boolean>>({});
  const [bountyChosen, setBountyChosen] = useState(false);
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const [optionIdByCode, setOptionIdByCode] = useState<Map<string, number>>(new Map());
  const [bookingExtras, setBookingExtras] = useState<BookingExtrasSelection>({
    selectedOptionIds: [],
    remark: '',
    scheduledAt: null,
  });
  const {
    preference: tunnelPreference,
    tunnelSelectionKey,
    ready: tunnelPreferenceReady,
  } = useTunnelRoutePreference(bookingExtras.selectedOptionIds);

  useLayoutEffect(() => {
    const tabNav = navigation.getParent();
    if (!tabNav) return;
    tabNav.setOptions({
      tabBarStyle: isLandscape ? { display: 'none' } : TAB_BAR_STYLE,
    });
    return () => {
      tabNav.setOptions({ tabBarStyle: TAB_BAR_STYLE });
    };
  }, [isLandscape, navigation]);

  const alertShootGeocodeError = useCallback((kind: 'pickup' | 'dropoff') => {
    Alert.alert(
      '出貨',
      kind === 'pickup'
        ? '無法定位出發地，請輸入更完整地址或按搜尋揀選地點。'
        : '無法定位目的地，請輸入更完整地址或按搜尋揀選地點。',
    );
  }, []);

  const resetShootForm = useCallback(() => {
    setStep('form');
    setPickup(null);
    setDropoff({ latitude: 22.3193, longitude: 114.1694, label: '' });
    setPickupText('');
    setDropoffText('');
    setRoute(null);
    setOwnerPhone('');
    setPassengerPhone('');
    setExtraRemark('');
    setManualFareText('');
    setGreenTaxi(false);
    setBountyPoints(0);
    setGridOn({});
    setBountyChosen(false);
    setTripVoiceLiveHint(null);
    setBookingExtras({ selectedOptionIds: [], remark: '', scheduledAt: null });
    placeResolveGen.current = { pickup: 0, dropoff: 0 };
  }, []);

  const syncPlaceFromText = useCallback((kind: 'pickup' | 'dropoff', text: string) => {
    const t = text.trim();
    if (kind === 'pickup') {
      if (!t) {
        setPickup(null);
        return;
      }
      setPickup(shootPlaceFromLabel(t));
      const gen = ++placeResolveGen.current.pickup;
      void resolveShootPlaceFromLabel(t).then((resolved) => {
        if (placeResolveGen.current.pickup !== gen) return;
        setPickup(resolved);
      });
      return;
    }
    if (!t) {
      setDropoff({ latitude: 22.3193, longitude: 114.1694, label: '' });
      return;
    }
    setDropoff(shootPlaceFromLabel(t));
    const gen = ++placeResolveGen.current.dropoff;
    void resolveShootPlaceFromLabel(t).then((resolved) => {
      if (placeResolveGen.current.dropoff !== gen) return;
      setDropoff(resolved);
    });
  }, []);

  const { listening: voiceListeningState, toggleTripVoice, togglePhoneVoice } = useShootOrderVoice({
    onTripSessionStart: () => setTripVoiceLiveHint(TRIP_VOICE_EXAMPLE),
    onPartial: (parsed, raw) => {
      setTripVoiceLiveHint(formatTripVoiceLiveHint(parsed, raw));
      if (parsed.pickup) setPickupText(parsed.pickup);
      if (parsed.dropoff) setDropoffText(parsed.dropoff);
    },
    onFinal: (parsed, raw) => {
      setTripVoiceLiveHint(formatTripVoiceLiveHint(parsed, raw));
      if (parsed.pickup) {
        setPickupText(parsed.pickup);
        syncPlaceFromText('pickup', parsed.pickup);
      }
      if (parsed.dropoff) {
        setDropoffText(parsed.dropoff);
        syncPlaceFromText('dropoff', parsed.dropoff);
      }
    },
    onTripSessionEnd: () => setTripVoiceLiveHint(null),
  });
  const voiceListening = voiceListeningState?.mode === 'trip';

  useEffect(() => {
    void fetchBookingOptions().then(({ categories }) => {
      const map = new Map<string, number>();
      for (const cat of categories) {
        for (const opt of cat.options) map.set(opt.code, opt.id);
      }
      setOptionIdByCode(map);
      const nowId = map.get('now');
      if (nowId) {
        setBookingExtras((prev) =>
          prev.selectedOptionIds.length ? prev : { ...prev, selectedOptionIds: [nowId] },
        );
      }
    });
  }, []);

  useEffect(() => {
    if (step === 'confirm') void refreshProfile();
  }, [step, refreshProfile]);

  useEffect(() => {
    if (!pickup) {
      setRoute(null);
      setRouteLoading(false);
      return;
    }
    if (!tunnelPreferenceReady) return;
    let cancelled = false;
    setRouteLoading(true);
    void fetchDrivingRoute(pickup, dropoff, { tunnelPreference })
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, tunnelSelectionKey, tunnelPreference, tunnelPreferenceReady]);

  const gridLabels = useMemo(() => {
    const labels: string[] = [];
    for (const row of SHOOT_GRID_ROWS) {
      for (const cell of row) {
        if (!gridOn[cell.key]) continue;
        labels.push(cell.label);
      }
    }
    return labels;
  }, [gridOn]);

  const selectedOptionIdsFromGrid = useMemo(() => {
    const ids = new Set<number>(bookingExtras.selectedOptionIds);
    for (const [key, code] of Object.entries(SHOOT_GRID_OPTION_CODES)) {
      if (!gridOn[key] || !code) continue;
      const id = optionIdByCode.get(code);
      if (id != null) ids.add(id);
    }
    return [...ids];
  }, [gridOn, optionIdByCode, bookingExtras.selectedOptionIds]);

  const paymentMethods = useMemo((): PassengerPaymentMethod[] => {
    if (!gridOn.electronic_pay) return [];
    return ['octopus', 'alipay', 'wechat', 'fps'];
  }, [gridOn.electronic_pay]);

  const tipHkd = gridOn.tips ? 10 : 0;
  const sixSeat = !!gridOn.seats_6;

  const toggleGrid = (key: string) => {
    setGridOn((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validatePlaces = (): boolean => {
    if (!pickupText.trim()) {
      Alert.alert('出貨', '請填寫出發地');
      return false;
    }
    if (!dropoffText.trim()) {
      Alert.alert('出貨', '請填寫目的地');
      return false;
    }
    return true;
  };

  const effectiveBountyPoints = bountyChosen ? bountyPoints : 0;
  const pointsBalance = driver?.pointsBalance ?? 0;

  const directDispatch = useCallback(
    async (kind: ShootDirectKind) => {
      if (!driver?.id || posting) return;
      if (!validatePlaces()) return;
      syncPlaceFromText('pickup', pickupText);
      syncPlaceFromText('dropoff', dropoffText);
      if (!isDriverApproved(driver.verificationStatus)) {
        Alert.alert('待審批', DRIVER_PENDING_APPROVAL_MSG);
        return;
      }
      setPosting(true);
      try {
        const resolved = await resolveShootPlacesForPost(pickupText.trim(), dropoffText.trim());
        if ('error' in resolved) {
          alertShootGeocodeError(resolved.error);
          return;
        }
        const pickupPlace = resolved.pickup;
        const dropoffPlace = resolved.dropoff;
        setPickup(pickupPlace);
        setDropoff(dropoffPlace);
        const [pickupZh, dropoffZh] = await Promise.all([
          ensureChineseOrderLabel(pickupPlace),
          ensureChineseOrderLabel(dropoffPlace),
        ]);
        const dist = route?.distanceMeters ?? 0;
        const tunnel = route?.tunnelTollHkd ?? 0;
        const meterTotal = estimateUrbanTaxiTotal(dist, 0, tunnel);
        const manualBase = parseManualFareHkd(manualFareText);
        const fareEstimate = shootBaseFareHkd(meterTotal, kind, manualBase) + tipHkd;
        const remark = buildRemarkParts({
          extraRemark,
          ownerPhone,
          passengerPhone,
          directKind: kind,
          greenTaxi,
          gridLabels,
        });
        const result = await postDriverOrder({
          driverId: driver.id,
          pickup: { lat: pickupZh.latitude, lng: pickupZh.longitude, label: pickupZh.label },
          dropoff: { lat: dropoffZh.latitude, lng: dropoffZh.longitude, label: dropoffZh.label },
          fareEstimate,
          estimateDistanceMeters: Math.round(dist),
          bountyPoints: effectiveBountyPoints,
          tipHkd,
          remark,
          selectedOptionIds: selectedOptionIdsFromGrid,
          sixSeat,
          paymentMethods,
          scheduledAt: bookingExtras.scheduledAt ?? undefined,
        });
        await refreshProfile();
        resetShootForm();
        Alert.alert('已發出柯打', `#${result.id} 已送到大廳，等候其他司機接單。`);
      } catch (e) {
        Alert.alert('無法發出', e instanceof Error ? e.message : '請稍後再試');
      } finally {
        setPosting(false);
      }
    },
    [
      driver,
      posting,
      resetShootForm,
      pickup,
      dropoff,
      route,
      tipHkd,
      extraRemark,
      ownerPhone,
      passengerPhone,
      greenTaxi,
      gridLabels,
      selectedOptionIdsFromGrid,
      sixSeat,
      paymentMethods,
      bookingExtras.scheduledAt,
      effectiveBountyPoints,
      bountyChosen,
      pickupText,
      dropoffText,
      manualFareText,
      syncPlaceFromText,
      refreshProfile,
      alertShootGeocodeError,
    ],
  );

  const manualFareHkd = useMemo(() => parseManualFareHkd(manualFareText), [manualFareText]);

  const proceedToConfirmWithSchedule = useCallback(
    (iso: string) => {
      const schedId = optionIdByCode.get('scheduled');
      const nowId = optionIdByCode.get('now');
      setBookingExtras((prev) => {
        let ids = [...prev.selectedOptionIds];
        if (nowId != null) ids = ids.filter((id) => id !== nowId);
        if (schedId != null && !ids.includes(schedId)) ids.push(schedId);
        return { ...prev, scheduledAt: iso, selectedOptionIds: ids };
      });
      void (async () => {
        const resolved = await resolveShootPlacesForPost(pickupText.trim(), dropoffText.trim());
        if ('error' in resolved) {
          alertShootGeocodeError(resolved.error);
          return;
        }
        const [pZh, dZh] = await Promise.all([
          ensureChineseOrderLabel(resolved.pickup),
          ensureChineseOrderLabel(resolved.dropoff),
        ]);
        setPickup(pZh);
        setDropoff(dZh);
        setStep('confirm');
      })();
    },
    [alertShootGeocodeError, dropoffText, optionIdByCode, pickupText],
  );

  const openSchedule = () => {
    if (!validatePlaces()) return;
    setSchedulePickerVisible(true);
  };

  if (step === 'confirm' && pickup) {
    return (
      <I18nProvider>
        <ShootReviewOrderScreen
          pickup={pickup}
          dropoff={dropoff}
          distanceMeters={route?.distanceMeters ?? 0}
          durationSeconds={route?.durationSeconds ?? 0}
          tunnelTollHkd={route?.tunnelTollHkd ?? 0}
          routeLoading={routeLoading}
          manualFareHkd={manualFareHkd}
          pointsBalance={pointsBalance}
          initialBountyPoints={bountyPoints}
          initialBountyChosen={bountyChosen}
          bookingExtras={{
            ...bookingExtras,
            remark: buildRemarkParts({
              extraRemark: bookingExtras.remark || extraRemark,
              ownerPhone,
              passengerPhone,
              greenTaxi,
              gridLabels,
            }),
            selectedOptionIds: selectedOptionIdsFromGrid,
          }}
          onBookingExtrasChange={setBookingExtras}
          onBack={() => setStep('form')}
          onGoPurchasePoints={(requiredPoints) =>
            navigation.navigate('PurchasePoints', { requiredPoints })
          }
          postLoading={posting}
          onConfirmPost={async ({
            fareEstimate,
            tipHkd: tip,
            extras,
            sixSeat: six,
            paymentMethods: pay,
            bountyPoints,
          }) => {
            if (!driver?.id || posting) return;
            if (!isDriverApproved(driver.verificationStatus)) {
              Alert.alert('待審批', DRIVER_PENDING_APPROVAL_MSG);
              return;
            }
            setPosting(true);
            try {
              const pickupLabelForResolve = pickupText.trim() || pickup.label.trim();
              const dropoffLabelForResolve = dropoffText.trim() || dropoff.label.trim();
              const resolved = await resolveShootPlacesForPost(
                pickupLabelForResolve,
                dropoffLabelForResolve,
              );
              if ('error' in resolved) {
                alertShootGeocodeError(resolved.error);
                return;
              }
              const [pickupZh, dropoffZh] = await Promise.all([
                ensureChineseOrderLabel(resolved.pickup),
                ensureChineseOrderLabel(resolved.dropoff),
              ]);
              const result = await postDriverOrder({
                driverId: driver.id,
                pickup: { lat: pickupZh.latitude, lng: pickupZh.longitude, label: pickupZh.label },
                dropoff: {
                  lat: dropoffZh.latitude,
                  lng: dropoffZh.longitude,
                  label: dropoffZh.label,
                },
                fareEstimate,
                estimateDistanceMeters: Math.round(route?.distanceMeters ?? 0),
                bountyPoints,
                tipHkd: tip,
                remark: extras.remark,
                selectedOptionIds: extras.selectedOptionIds,
                sixSeat: six,
                paymentMethods: pay,
                scheduledAt: extras.scheduledAt ?? undefined,
              });
              await refreshProfile();
              resetShootForm();
              Alert.alert('已成功建立柯打', `柯打編號 #${result.id} 已發出。`, [
                { text: '知道了' },
              ]);
            } catch (e) {
              Alert.alert('無法發出柯打', e instanceof Error ? e.message : '請稍後再試');
            } finally {
              setPosting(false);
            }
          }}
        />
      </I18nProvider>
    );
  }

  const inputStyle = isLandscape ? [styles.input, styles.inputLandscape] : styles.input;
  const extraInputStyle = isLandscape
    ? [styles.input, styles.extraInput, styles.extraInputLandscape]
    : [styles.input, styles.extraInput];
  const rowStyle = isLandscape ? styles.buttonRowFlex : styles.buttonRow;

  const formColumn = (
    <View style={isLandscape ? styles.landscapeLeft : styles.portraitFormWrap}>
      <View style={[styles.mainRowInner, isLandscape && styles.mainRowInnerLandscape]}>
        <View style={styles.leftCol}>
          <TextInput
            style={inputStyle}
            placeholder="出發地"
            placeholderTextColor={SHOOT_UI.inputPlaceholder}
            value={pickupText}
            onChangeText={setPickupText}
            onFocus={() => {
              pickupFocused.current = true;
            }}
            onBlur={() => {
              pickupFocused.current = false;
              syncPlaceFromText('pickup', pickupText);
            }}
            returnKeyType="next"
          />
          <TextInput
            style={inputStyle}
            placeholder="目的地"
            placeholderTextColor={SHOOT_UI.inputPlaceholder}
            value={dropoffText}
            onChangeText={setDropoffText}
            onFocus={() => {
              dropoffFocused.current = true;
            }}
            onBlur={() => {
              dropoffFocused.current = false;
              syncPlaceFromText('dropoff', dropoffText);
            }}
          />
          <ShootPhoneField
            placeholder="貨主電話 (選填)"
            value={ownerPhone}
            onChangeDigits={setOwnerPhone}
            micActive={
              voiceListeningState?.mode === 'phone' && voiceListeningState.field === 'owner'
            }
            onMicPress={() => void togglePhoneVoice('owner', setOwnerPhone)}
          />
          <ShootPhoneField
            placeholder="客人電話 (選填)"
            value={passengerPhone}
            onChangeDigits={setPassengerPhone}
            micActive={
              voiceListeningState?.mode === 'phone' && voiceListeningState.field === 'passenger'
            }
            onMicPress={() => void togglePhoneVoice('passenger', setPassengerPhone)}
          />
          <TextInput
            style={inputStyle}
            placeholder="車資 HK$ (選填)"
            placeholderTextColor={SHOOT_UI.inputPlaceholder}
            value={manualFareText}
            onChangeText={(text) => setManualFareText(text.replace(/[^\d.,]/g, ''))}
            keyboardType="number-pad"
          />
          <TextInput
            style={extraInputStyle}
            placeholder="額外要求"
            placeholderTextColor={SHOOT_UI.inputPlaceholder}
            value={extraRemark}
            onChangeText={setExtraRemark}
            multiline
          />
        </View>
        <View style={isLandscape ? styles.sideColLandscape : styles.sideCol}>
          <Pressable
            style={[
              styles.sideBtn,
              isLandscape && styles.sideBtnLandscape,
              { backgroundColor: SHOOT_UI.micBlue },
              voiceListening && styles.sideBtnActive,
            ]}
            onPress={() => void toggleTripVoice()}
          >
            <Text style={styles.sideBtnIcon}>{voiceListening ? '🔴' : '🎤'}</Text>
          </Pressable>
          <Pressable
            style={[styles.sideBtn, isLandscape && styles.sideBtnLandscape, { backgroundColor: SHOOT_UI.scheduleGrey }]}
            onPress={openSchedule}
          >
            <Text style={styles.sideBtnLabel}>預約</Text>
          </Pressable>
          <Pressable
            style={[
              styles.sideBtn,
              isLandscape && styles.sideBtnLandscape,
              { backgroundColor: SHOOT_UI.green },
              greenTaxi && styles.sideBtnActive,
            ]}
            onPress={() => setGreenTaxi((v) => !v)}
          >
            <Text style={styles.sideBtnLabel}>綠的</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const optionsBlock = (
    <View style={isLandscape ? styles.landscapeOptions : styles.fullWidthBlock}>
      <View style={rowStyle}>
        {SHOOT_DIRECT_ACTIONS.map((action) => (
          <ShootDirectMiniButton
            key={action.kind}
            action={action}
            disabled={posting}
            onPress={() => void directDispatch(action.kind)}
          />
        ))}
      </View>
      <View style={isLandscape ? styles.landscapeGridFill : undefined}>
        {SHOOT_GRID_ROWS.map((row, ri) => (
          <View key={ri} style={isLandscape ? styles.landscapeGridRowWrap : undefined}>
            <View style={rowStyle}>
              {row.map((cell) => (
                <ShootGridChip
                  key={cell.key}
                  label={cell.label}
                  selected={!!gridOn[cell.key]}
                  onPress={() => toggleGrid(cell.key)}
                  flexStyle={isLandscape ? styles.gridChipFlex : undefined}
                />
              ))}
            </View>
            {ri === 2 ? (
              <View style={styles.bountyBlock}>
                <Text style={styles.bountyRowTitle}>{SHOOT_BOUNTY_ROW_LABEL}</Text>
                <View style={rowStyle}>
                  {DRIVER_POST_BOUNTY_OPTIONS.map((n) => {
                    const selected = bountyChosen && bountyPoints === n;
                    return (
                      <ShootGridChip
                        key={n}
                        label={String(n)}
                        selected={selected}
                        onPress={() => {
                          setBountyChosen(true);
                          setBountyPoints(n);
                        }}
                        flexStyle={isLandscape ? styles.gridChipFlex : undefined}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );

  const bottomDirectBlock = (
    <View style={styles.bottomDirect}>
      <View style={rowStyle}>
        {SHOOT_DIRECT_ACTIONS.slice(0, 3).map((action) => (
          <ShootDirectBottomButton
            key={action.kind}
            action={action}
            disabled={posting}
            onPress={() => void directDispatch(action.kind)}
          />
        ))}
      </View>
      <View style={rowStyle}>
        {SHOOT_DIRECT_ACTIONS.slice(3).map((action) => (
          <ShootDirectBottomButton
            key={action.kind}
            action={action}
            disabled={posting}
            onPress={() => void directDispatch(action.kind)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScreenSafeArea style={styles.safe} edges={['top', 'left', 'right']}>
        {isLandscape ? (
          <View
            style={[
              styles.landscapeRoot,
              { paddingBottom: Math.max(insets.bottom, 4) },
            ]}
          >
            {formColumn}
            <View style={styles.landscapeRight}>
              {optionsBlock}
              {bottomDirectBlock}
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {formColumn}
            {optionsBlock}
            {bottomDirectBlock}
          </ScrollView>
        )}
      </ScreenSafeArea>

      {voiceListening && tripVoiceLiveHint ? (
        <View style={styles.tripVoiceOverlay} pointerEvents="none">
          <View style={[styles.tripVoiceHintCard, { marginBottom: Math.max(insets.bottom, 16) + 48 }]}>
            <ActivityIndicator size="large" color={SHOOT_UI.gold} />
            <Text style={styles.tripVoiceGuide}>請講上車地「去」目的地</Text>
            <Text style={styles.tripVoiceExampleLabel}>例如</Text>
            <Text style={styles.tripVoiceHintText} numberOfLines={3}>
              {tripVoiceLiveHint}
            </Text>
          </View>
        </View>
      ) : null}

      {posting ? (
        <View style={styles.postingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={SHOOT_UI.gold} />
        </View>
      ) : null}

      <Modal
        visible={searchMode != null}
        animationType="slide"
        onRequestClose={() => setSearchMode(null)}
        supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
      >
        {searchMode ? (
          <ShootLocationSearchScreen
            pointKind={searchMode}
            initialText={searchMode === 'pickup' ? (pickup?.label ?? '') : dropoff.label}
            near={pickup ?? dropoff}
            onClose={() => setSearchMode(null)}
            onSelect={(place) => {
              void ensureChineseOrderLabel(place).then((normalized) => {
                if (searchMode === 'pickup') {
                  setPickup(normalized);
                  setPickupText(normalized.label);
                } else {
                  setDropoff(normalized);
                  setDropoffText(normalized.label);
                }
                setSearchMode(null);
              });
            }}
            onUseCurrentLocation={async () => null}
            allowCurrentLocation={false}
          />
        ) : null}
      </Modal>

      <I18nProvider>
        <ScheduleTimePickerModal
          visible={schedulePickerVisible}
          initialIso={bookingExtras.scheduledAt}
          onCancel={() => setSchedulePickerVisible(false)}
          onConfirm={(iso) => {
            setSchedulePickerVisible(false);
            proceedToConfirmWithSchedule(iso);
          }}
        />
      </I18nProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 6, paddingBottom: 8, flexGrow: 1 },
  mainRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  mainRowInner: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', width: '100%' },
  leftCol: { flex: 1, minWidth: 0 },
  sideCol: { width: 72, gap: 6, alignSelf: 'stretch' },
  sideColLandscape: { width: 64, gap: 4, alignSelf: 'stretch' },
  fullWidthBlock: { width: '100%', marginTop: 2 },
  landscapeRoot: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    minHeight: 0,
  },
  portraitFormWrap: { width: '100%' },
  landscapeLeft: {
    width: '34%',
    maxWidth: 400,
    minWidth: 240,
    flexDirection: 'column',
    minHeight: 0,
  },
  mainRowInnerLandscape: { flex: 1, minHeight: 0 },
  landscapeRight: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 4 },
  landscapeOptions: { flex: 1, minHeight: 0, gap: 4 },
  landscapeGridFill: { flex: 1, minHeight: 0, gap: 4, justifyContent: 'space-between' },
  landscapeGridRowWrap: { flex: 1, minHeight: 0, justifyContent: 'center' },
  buttonRow: { flexDirection: 'row', gap: 4, marginBottom: 4, width: '100%' },
  buttonRowFlex: { flexDirection: 'row', gap: 4, flex: 1, width: '100%', minHeight: 0 },
  gridChipFlex: { flex: 1, minHeight: 0, alignSelf: 'stretch' },
  input: {
    backgroundColor: SHOOT_UI.inputBg,
    color: SHOOT_UI.inputText,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputLandscape: { paddingVertical: 8, fontSize: 14, marginBottom: 4 },
  phoneInputShell: { position: 'relative', marginBottom: 8 },
  phoneInputInner: { marginBottom: 0, paddingRight: 46 },
  phoneMicInside: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  phoneMicInsideActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  phoneMicIcon: { fontSize: 20 },
  extraInput: { minHeight: 52, textAlignVertical: 'top' },
  extraInputLandscape: { minHeight: 40, flex: 1 },
  miniDirect: {
    flex: 1,
    minHeight: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  miniDirectTextDark: { fontSize: 12, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  miniDirectTextLight: { fontSize: 12, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  bountyBlock: { marginBottom: 0 },
  bountyRowTitle: { color: '#bbb', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  gridChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 4,
    backgroundColor: SHOOT_UI.chipGrey,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  gridChipOn: {
    backgroundColor: SHOOT_UI.red,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  gridChipDisabled: { opacity: 0.35 },
  gridChipText: {
    color: SHOOT_UI.chipGreyText,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridChipTextOn: { color: '#ffffff', fontWeight: '800' },
  sideBtn: {
    minHeight: 56,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sideBtnLandscape: { minHeight: 0, flex: 1 },
  sideBtnActive: { borderWidth: 3, borderColor: '#fff' },
  sideBtnIcon: { fontSize: 26 },
  sideBtnLabel: { color: '#fff', fontSize: 17, fontWeight: '800' },
  bottomDirect: { gap: 4, width: '100%' },
  bottomBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bottomBtnTextDark: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  bottomBtnTextLight: { fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' },
  postingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripVoiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tripVoiceHintCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(45, 45, 45, 0.96)',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: SHOOT_UI.micBlue,
    maxWidth: '100%',
    minWidth: 260,
  },
  tripVoiceGuide: {
    color: '#cccccc',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  tripVoiceExampleLabel: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
  tripVoiceHintText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
