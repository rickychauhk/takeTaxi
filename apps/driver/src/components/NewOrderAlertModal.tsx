import { useEffect, useMemo } from 'react';
import { BackHandler, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { OrderOffer } from '../types/order';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useDrivingUi } from '../hooks/useDrivingUi';
import { driverOrderPointsLines } from '../trip/driverOrderPointsLines';
import { passengerContactPreferenceLine } from '../trip/passengerContactPreferenceLine';
import { passengerPointsRedemptionLine } from '../trip/passengerPointsRedemptionLine';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  offer: OrderOffer | null;
  secondsLeft: number;
  totalSeconds?: number;
  accepting?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onTick: () => void;
};

function shortenForDriving(label: string, maxLen: number): string {
  const t = label.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export function NewOrderAlertModal({
  visible,
  offer,
  secondsLeft,
  totalSeconds = 10,
  accepting = false,
  onAccept,
  onReject,
  onTick,
}: Props) {
  const { isLandscape, width } = useLayoutMode();
  const driving = useDrivingUi();
  const androidFullScreen = Platform.OS === 'android';

  useEffect(() => {
    if (!visible || !offer) return;
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
  }, [visible, offer, onTick]);

  useEffect(() => {
    if (!androidFullScreen || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [androidFullScreen, visible]);

  const pointsOneLine = useMemo(() => {
    if (!offer) return '';
    const lines = driverOrderPointsLines(offer).map((l) => l.text);
    const redeem = passengerPointsRedemptionLine(offer);
    if (redeem) lines.push(redeem);
    return lines.join(' · ');
  }, [offer]);

  const contactLine = useMemo(
    () => (offer ? passengerContactPreferenceLine(offer) : null),
    [offer],
  );

  if (!offer) return null;

  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const cardMaxWidth = isLandscape ? Math.min(520, width * 0.55) : width;

  const distanceBits: string[] = [];
  if (offer.pickupDistanceKm != null && offer.pickupDistanceKm > 0) {
    const distLabel = offer.pickupDistanceIsDriving ? '距你行車約' : '距你直線約';
    distanceBits.push(`${distLabel} ${offer.pickupDistanceKm.toFixed(1)} km`);
  }
  if (offer.distanceKm > 0) {
    distanceBits.push(`行程 ${offer.distanceKm.toFixed(1)} km`);
  }

  return (
    <Modal
      visible={visible}
      transparent={!androidFullScreen}
      animationType={androidFullScreen ? 'fade' : 'slide'}
      presentationStyle={androidFullScreen ? 'fullScreen' : undefined}
      statusBarTranslucent
      supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
    >
      <View style={[styles.backdrop, androidFullScreen && styles.backdropAndroidFull]}>
        <SafeAreaView
          edges={androidFullScreen ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
          style={[
            styles.safe,
            androidFullScreen && styles.safeAndroidFull,
            isLandscape && styles.safeLandscape,
          ]}
        >
          <View
            style={[
              styles.card,
              { maxWidth: cardMaxWidth },
              androidFullScreen && styles.cardAndroidFull,
              isLandscape ? styles.cardLandscape : styles.cardPortrait,
            ]}
          >
            <View style={styles.topRow}>
              <View style={styles.titleRow}>
                <Ionicons name="notifications" size={driving.iconSize} color={colors.brandYellow} />
                <Text style={[styles.alertTitle, { fontSize: driving.titleSize }]}>新柯打</Text>
              </View>
              <Text style={[styles.countdown, { fontSize: driving.alertCountdownSize }]}>
                {secondsLeft}s
              </Text>
            </View>

            <View style={[styles.progressTrack, { height: Math.round(10 * driving.scale) }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            <Text style={[styles.fareHero, { fontSize: driving.alertFareSize }]}>
              估 HK${offer.fareEstimateHkd}
            </Text>
            {distanceBits.length > 0 ? (
              <Text style={[styles.distanceLine, { fontSize: driving.metaSize }]}>
                {distanceBits.join('  ·  ')}
              </Text>
            ) : null}

            <View style={styles.pickupBlock}>
              <Text style={[styles.pickupLabel, { fontSize: driving.labelSize }]}>上車</Text>
              <Text
                style={[styles.pickupValue, { fontSize: driving.alertPickupSize, lineHeight: driving.alertPickupSize * 1.35 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {shortenForDriving(offer.pickupLabel, 48)}
              </Text>
            </View>
            <Text
              style={[styles.dropoffValue, { fontSize: driving.alertDropoffSize, lineHeight: driving.alertDropoffSize * 1.35 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              去 {shortenForDriving(offer.dropoffLabel, 36)}
            </Text>
            {pointsOneLine ? (
              <Text style={[styles.pointsSummary, { fontSize: driving.metaSize }]} numberOfLines={1}>
                {pointsOneLine}
              </Text>
            ) : null}
            {contactLine ? (
              <Text style={[styles.contactPref, { fontSize: driving.metaSize }]} numberOfLines={2}>
                {contactLine}
              </Text>
            ) : null}

            {accepting ? (
              <Text style={[styles.acceptingHint, { fontSize: driving.bodySize }]}>
                正在接單…
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.rejectBtn,
                  { minHeight: driving.alertBtnHeight },
                  (pressed || accepting) && styles.btnPressed,
                  accepting && styles.btnDisabled,
                ]}
                onPress={onReject}
                disabled={accepting}
                accessibilityRole="button"
                accessibilityLabel="拒絕柯打"
              >
                <Text style={[styles.rejectText, { fontSize: driving.alertBtnTextSize }]}>拒絕</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.acceptBtn,
                  { minHeight: driving.alertBtnHeight },
                  (pressed || accepting) && styles.btnPressed,
                  accepting && styles.btnDisabled,
                ]}
                onPress={onAccept}
                disabled={accepting}
                accessibilityRole="button"
                accessibilityLabel="接受柯打"
              >
                <Text style={[styles.acceptText, { fontSize: driving.alertBtnTextSize }]}>
                  {accepting ? '接單中…' : '接受'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropAndroidFull: {
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  safe: {
    width: '100%',
    alignItems: 'center',
  },
  safeAndroidFull: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  safeLandscape: {
    justifyContent: 'center',
    flex: 1,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  cardAndroidFull: {
    flex: 1,
    maxWidth: '100%',
    borderRadius: 0,
    borderWidth: 0,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  cardPortrait: {
    alignSelf: 'stretch',
  },
  cardLandscape: {
    borderRadius: 20,
    borderBottomWidth: 1,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertTitle: { color: colors.text, fontWeight: '800' },
  countdown: { color: colors.brandYellow, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: {
    borderRadius: 6,
    backgroundColor: '#333',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: { height: '100%', backgroundColor: colors.brandYellow },
  fareHero: { color: colors.brandYellow, fontWeight: '900', marginBottom: 4 },
  distanceLine: { color: colors.textMuted, fontWeight: '700', marginBottom: 12 },
  pickupBlock: { marginBottom: 6 },
  pickupLabel: { color: colors.textMuted, fontWeight: '800', marginBottom: 4 },
  pickupValue: { color: colors.text, fontWeight: '800' },
  dropoffValue: { color: colors.textMuted, fontWeight: '600', marginBottom: 10 },
  pointsSummary: { color: '#9cdc9c', fontWeight: '600', marginBottom: 8 },
  contactPref: { color: colors.brandYellow, fontWeight: '700', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  rejectText: { color: colors.text, fontWeight: '800' },
  acceptBtn: {
    flex: 1.15,
    borderRadius: 18,
    backgroundColor: colors.brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: colors.onPrimary, fontWeight: '900' },
  btnPressed: { opacity: 0.88 },
  btnDisabled: { opacity: 0.55 },
  acceptingHint: {
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
});
