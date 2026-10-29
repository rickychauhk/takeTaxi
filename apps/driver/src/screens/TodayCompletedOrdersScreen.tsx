import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchDriverTodayEarnings,
  type DriverTodayCompletedOrder,
} from '../api/driverTodayEarnings';
import { useLandscapeContentColumn } from '../hooks/useLandscapeContentColumn';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TodayCompletedOrders'>;

export default function TodayCompletedOrdersScreen({ navigation }: Props) {
  const { outer, inner } = useLandscapeContentColumn(640);
  const [items, setItems] = useState<DriverTodayCompletedOrder[]>([]);
  const [dateHk, setDateHk] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDriverTodayEarnings();
      setItems(data.items);
      setDateHk(data.dateHk);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法載入');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.root, outer]} edges={['top', 'left', 'right']}>
      <View style={inner}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.brandYellow} />
        </Pressable>
        <Text style={styles.title}>今日完成單</Text>
        <View style={styles.backBtn} />
      </View>
      {dateHk ? <Text style={styles.dateLine}>香港時間 {dateHk}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandYellow} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(row) => row.orderId}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandYellow} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{error ?? '今日尚未有完成行程'}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{item.orderId}</Text>
                <Text style={styles.fare}>HK${item.fareHkd}</Text>
              </View>
              {item.completedAtHk ? (
                <Text style={styles.time}>{item.completedAtHk}</Text>
              ) : null}
              <Text style={styles.route} numberOfLines={2}>
                起：{item.pickupAddress ?? '—'}
              </Text>
              <Text style={styles.route} numberOfLines={2}>
                終：{item.dropoffAddress ?? '—'}
              </Text>
            </View>
          )}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' },
  dateLine: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { color: colors.brandYellow, fontWeight: '800', fontSize: 15 },
  fare: { color: colors.text, fontWeight: '800', fontSize: 16 },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 6, marginBottom: 8 },
  route: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
