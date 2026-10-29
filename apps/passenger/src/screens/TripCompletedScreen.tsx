import { useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { submitPassengerDriverRating } from '../api/ratings';
import type { PassengerOrderTrack } from '../api/passengerOrder';
import TripRatingModal from '../components/TripRatingModal';
import { useI18n } from '../i18n/I18nProvider';
import { colors } from '../theme/colors';

type Props = {
  track: PassengerOrderTrack;
  pickupLabel: string;
  dropoffLabel: string;
  onDone: () => void;
};

function formatFareHkd(raw: string | null | undefined): string | null {
  const n = raw?.trim();
  if (!n) return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return n;
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

export default function TripCompletedScreen({
  track,
  pickupLabel,
  dropoffLabel,
  onDone,
}: Props) {
  const { t, pickupTag, dropoffTag } = useI18n();
  const driver = track.driver;
  const fare =
    formatFareHkd(track.fareFinal) ?? formatFareHkd(track.fareEstimate) ?? '—';
  const plate = driver?.vehiclePlate?.trim() || '—';
  const rating =
    driver?.ratingAvg != null ? t('trip.ratingAvg', { score: driver.ratingAvg.toFixed(1) }) : null;
  const formatWhole = (n: number) => String(Math.round(n));
  const tripKm =
    track.tripDistanceKm != null && Number.isFinite(track.tripDistanceKm)
      ? formatWhole(track.tripDistanceKm)
      : null;
  const pointsEarned =
    track.pointsEarnedThisTrip != null && Number.isFinite(track.pointsEarnedThisTrip)
      ? Math.round(track.pointsEarnedThisTrip)
      : 0;
  const pointsBalance =
    track.passengerPointsBalance != null && Number.isFinite(track.passengerPointsBalance)
      ? Math.round(track.passengerPointsBalance)
      : null;
  const [myRating, setMyRating] = useState<number | null>(track.passengerRating?.score ?? null);
  const [myRatingComment, setMyRatingComment] = useState<string | null>(
    track.passengerRating?.comment ?? null,
  );
  const [ratingOpen, setRatingOpen] = useState(false);

  const submitRating = async (score: number, comment?: string) => {
    try {
      const snap = await submitPassengerDriverRating(track.orderId, score, comment);
      setMyRating(snap.score ?? score);
      setMyRatingComment(snap.comment ?? comment?.trim() ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('trip.rateFailed');
      Alert.alert(t('trip.rateDriver'), msg);
      throw e;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScreenSafeArea style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.title}>{t('trip.completedTitle')}</Text>
          <Text style={styles.subtitle}>{t('trip.completedMessage')}</Text>

          <View style={styles.card}>
            <Text style={styles.fareCaption}>{t('trip.completedFareLabel')}</Text>
            <Text style={styles.fareAmount}>HK${fare}</Text>
            {track.completedAtHk ? (
              <Text style={styles.metaLine}>{t('trip.completedAt', { time: track.completedAtHk })}</Text>
            ) : null}
            <Text style={styles.metaLine}>{t('trip.completedOrderNo', { id: track.orderId })}</Text>
          </View>

          {driver ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('trip.completedDriverSection')}</Text>
              <View style={styles.driverRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{driver.displayName.slice(0, 1)}</Text>
                </View>
                <View style={styles.driverMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.driverName}>{driver.displayName}</Text>
                    {rating ? <Text style={styles.rating}>★ {rating}</Text> : null}
                  </View>
                  <Text style={styles.plate}>{t('trip.vehiclePlate', { plate })}</Text>
                </View>
              </View>
              {myRating != null ? (
                <>
                  <Text style={styles.myRating}>{t('trip.rateSubmitted', { score: myRating.toFixed(1) })}</Text>
                  {myRatingComment?.trim() ? (
                    <Text style={styles.myRatingComment}>{myRatingComment.trim()}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.myRatingHint}>{t('trip.rateDefaultHint')}</Text>
              )}
              <Pressable
                style={styles.rateBtn}
                onPress={() => setRatingOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.rateBtnText}>
                  {myRating != null ? t('trip.rateDriverEdit') : t('trip.rateDriver')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {track.passengerPointsRedeemed != null && track.passengerPointsRedeemed > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('trip.completedPointsUsedSection')}</Text>
              <Text style={styles.pointsLine}>
                {t('trip.completedPointsUsed', {
                  points: formatWhole(track.passengerPointsRedeemed),
                  amount: formatWhole(track.passengerPointsDiscountHkd ?? 0),
                })}
              </Text>
              {track.passengerPointsHkdPerPointAtOrder != null ? (
                <Text style={styles.pointsBalance}>
                  {t('trip.completedPointsRateAtOrder', {
                    hkd: formatWhole(track.passengerPointsHkdPerPointAtOrder),
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('trip.completedPointsSection')}</Text>
            {tripKm != null ? (
              <Text style={styles.pointsLine}>{t('trip.completedTripKm', { km: tripKm })}</Text>
            ) : null}
            <Text style={styles.pointsEarned}>
              {t('trip.completedPointsEarned', { points: formatWhole(pointsEarned) })}
            </Text>
            {pointsBalance != null ? (
              <Text style={styles.pointsBalance}>
                {t('trip.completedPointsBalance', { points: formatWhole(pointsBalance) })}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('trip.completedRouteSection')}</Text>
            <View style={styles.stopRow}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.stopText}>
                <Text style={styles.stopTag}>{pickupTag}</Text>
                <Text style={styles.stopLabel}>{pickupLabel}</Text>
              </View>
            </View>
            <View style={styles.stopRow}>
              <View style={[styles.dot, styles.dotDrop]} />
              <View style={styles.stopText}>
                <Text style={styles.stopTag}>{dropoffTag}</Text>
                <Text style={styles.stopLabel}>{dropoffLabel}</Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={onDone} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{t('trip.backToHome')}</Text>
          </Pressable>
        </ScrollView>
      </ScreenSafeArea>

      <TripRatingModal
        visible={ratingOpen}
        title={t('trip.rateDriverTitle')}
        hint={t('trip.rateDriverHint')}
        submitLabel={t('trip.rateSubmit')}
        skipLabel={t('trip.rateSkip')}
        commentLabel={t('trip.rateCommentLabel')}
        commentPlaceholder={t('trip.rateCommentPlaceholder')}
        initialScore={myRating}
        initialComment={myRatingComment}
        onClose={() => setRatingOpen(false)}
        onSkip={() => setRatingOpen(false)}
        onSubmit={submitRating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  check: {
    alignSelf: 'center',
    fontSize: 48,
    fontWeight: '800',
    color: '#2e7d32',
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.panelBgSolid,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  fareCaption: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  fareAmount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 4 },
  metaLine: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  pointsLine: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  pointsEarned: { fontSize: 20, fontWeight: '800', color: colors.brand, marginTop: 10 },
  pointsBalance: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#444' },
  driverMeta: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  driverName: { fontSize: 17, fontWeight: '800', color: colors.text },
  rating: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  plate: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  myRating: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 14 },
  myRatingComment: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  myRatingHint: { fontSize: 13, color: colors.textMuted, marginTop: 14 },
  rateBtn: {
    marginTop: 10,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandTintBg,
  },
  rateBtnText: { fontSize: 16, fontWeight: '800', color: colors.brand },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stopText: { flex: 1, marginLeft: 10 },
  stopTag: { fontSize: 12, color: '#888', fontWeight: '700' },
  stopLabel: { fontSize: 15, color: colors.text, marginTop: 2, lineHeight: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  dotPickup: { backgroundColor: colors.pickupDot },
  dotDrop: { backgroundColor: colors.dropoffDot, borderRadius: 2 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
});
