import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { useLandscapeContentColumn } from '../hooks/useLandscapeContentColumn';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchDriverPassengerRating, submitDriverPassengerRating } from '../api/ratings';
import { TripRatingModal } from '../components/TripRatingModal';
import { useDriverSession } from '../context/DriverSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { passengerPointsRedemptionLine } from '../trip/passengerPointsRedemptionLine';

type Props = NativeStackScreenProps<RootStackParamList, 'TripCompleted'>;

export default function TripCompletedScreen({ navigation, route }: Props) {
  const { orderId, pickupLabel, dropoffLabel, fareHkd, ...pointsFields } = route.params;
  const pointsLine = passengerPointsRedemptionLine({
    passengerPointsRedeemed: pointsFields.passengerPointsRedeemed,
    passengerPointsDiscountHkd: pointsFields.passengerPointsDiscountHkd,
    passengerPointsHkdPerPointAtOrder: pointsFields.passengerPointsHkdPerPointAtOrder,
  });
  const { advanceTrip } = useDriverSession();
  const { outer, inner } = useLandscapeContentColumn(560);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const snap = await fetchDriverPassengerRating(orderId);
        if (snap.score != null) setMyRating(snap.score);
      } catch {
        /* ignore */
      }
    })();
  }, [orderId]);

  const finish = useCallback(() => {
    advanceTrip();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }, [advanceTrip, navigation]);

  const submitRating = async (score: number) => {
    try {
      const snap = await submitDriverPassengerRating(orderId, score);
      setMyRating(snap.score ?? score);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '無法提交評分';
      Alert.alert('評分失敗', msg);
      throw e;
    }
  };

  return (
    <View style={[styles.root, outer]}>
      <ScreenSafeArea style={[styles.safe, inner]} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.title}>行程完成</Text>
          <Text style={styles.subtitle}>已落客，收入已計入今日統計。</Text>

          <View style={styles.card}>
            <Text style={styles.fareCaption}>車資（估計）</Text>
            <Text style={styles.fareAmount}>HK${fareHkd}</Text>
            <Text style={styles.metaLine}>柯打編號 #{orderId}</Text>
            {pointsLine ? <Text style={styles.pointsLine}>{pointsLine}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>行程</Text>
            <Text style={styles.routeLine}>上車 · {pickupLabel}</Text>
            <Text style={styles.routeLine}>落客 · {dropoffLabel}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>乘客評分</Text>
            {myRating != null ? (
              <Text style={styles.ratedText}>已評分 ★ {myRating.toFixed(1)}</Text>
            ) : (
              <Text style={styles.ratedHint}>預設 5.0 分，可選不評分</Text>
            )}
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setRatingOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>
                {myRating != null ? '修改評分' : '為乘客評分'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryBtn} onPress={finish} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>返回接單</Text>
          </Pressable>
        </ScrollView>
      </ScreenSafeArea>

      <TripRatingModal
        visible={ratingOpen}
        title="為乘客評分"
        hint="1.0–5.0（0.5 為單位），預設 5.0"
        submitLabel="提交評分"
        skipLabel="不評分"
        initialScore={myRating}
        onClose={() => setRatingOpen(false)}
        onSkip={() => setRatingOpen(false)}
        onSubmit={submitRating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fareCaption: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  fareAmount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 4 },
  metaLine: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  pointsLine: { fontSize: 14, color: '#2e7d32', fontWeight: '600', marginTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10 },
  routeLine: { fontSize: 15, color: colors.text, marginBottom: 6, lineHeight: 20 },
  ratedText: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  ratedHint: { fontSize: 14, color: colors.textMuted, marginBottom: 12 },
  secondaryBtn: {
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '800', color: colors.text },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
});
