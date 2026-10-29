import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchDriverTodayEarnings } from '../api/driverTodayEarnings';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { useDriverSession } from '../context/DriverSessionContext';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useTodayOnlineMinutesDisplay } from '../hooks/useTodayOnlineMinutesDisplay';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

function StatCard({
  icon,
  label,
  value,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Ionicons name={icon} size={24} color={accent ?? colors.brandYellow} />
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, accent ? { color: accent } : null]}>{value}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.card}>{inner}</View>;
  }
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      {inner}
    </Pressable>
  );
}

export default function EarningsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useDriverAuth();
  const { state } = useDriverSession();
  const { isLandscape } = useLayoutMode();
  const [todayHkd, setTodayHkd] = useState(0);
  const [tripCount, setTripCount] = useState(0);
  const { onlineMinutes } = state.earnings;
  const displayOnlineMinutes = useTodayOnlineMinutesDisplay(
    onlineMinutes,
    state.online,
    state.onlineSince,
  );
  const hours = (displayOnlineMinutes / 60).toFixed(1);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchDriverTodayEarnings()
        .then((data) => {
          if (cancelled) return;
          setTodayHkd(data.totalHkd);
          setTripCount(data.tripCount);
        })
        .catch(() => {
          if (cancelled) return;
          setTodayHkd(state.earnings.todayHkd);
          setTripCount(state.earnings.tripCount);
        });
      return () => {
        cancelled = true;
      };
    }, [state.earnings.todayHkd, state.earnings.tripCount]),
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
        <Text style={styles.title}>收入</Text>
        <Text style={styles.subtitle}>今日統計（收入／單數來自 API；線上時數按本機上線時間）</Text>

        <View style={[styles.summaryBlock, isLandscape && styles.summaryBlockLandscape]}>
          <View style={[styles.hero, isLandscape && styles.heroLandscape]}>
            <Text style={styles.heroLabel}>今日總收入</Text>
            <Text style={styles.heroValue}>HK${todayHkd.toFixed(0)}</Text>
          </View>

          <View style={[styles.grid, isLandscape && styles.gridLandscape]}>
            <StatCard
              icon="receipt-outline"
              label="完成單數"
              value={`${tripCount} 單`}
              onPress={() => navigation.navigate('TodayCompletedOrders')}
            />
            <StatCard
              icon="time-outline"
              label="線上時數"
              value={`${hours} 小時`}
              accent="#60a5fa"
            />
          </View>
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.tipText}>
            完成「完成行程」後可下拉刷新收入頁；點「完成單數」可查看今日每單詳情。
          </Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
          <Text style={styles.logoutText}>登出</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 20, lineHeight: 20 },
  summaryBlock: { gap: 16 },
  summaryBlockLandscape: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  hero: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLandscape: { flex: 1, justifyContent: 'center' },
  heroLabel: { color: colors.textMuted, fontSize: 14 },
  heroValue: { color: colors.brandYellow, fontSize: 36, fontWeight: '900', marginTop: 8 },
  grid: { flexDirection: 'row', gap: 12 },
  gridLandscape: { flex: 1, flexDirection: 'column' },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    minWidth: 120,
  },
  cardLabel: { color: colors.textMuted, fontSize: 13 },
  cardValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  cardPressed: { opacity: 0.85 },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    padding: 14,
    backgroundColor: '#151515',
    borderRadius: 12,
  },
  tipText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  logoutBtn: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
});
