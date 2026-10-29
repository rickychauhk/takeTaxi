import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchPassengerOrderHistory,
  hidePassengerOrderFromHistory,
  type PassengerOrderHistoryRow,
} from '../api/passengerOrderHistory';
import { formatHkd } from '../pricing/urbanTaxiFare';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n';
import { userFacingError } from '../i18n/userFacingError';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  pending: 'records.status.pending',
  matching: 'records.status.matching',
  accepted: 'records.status.accepted',
  en_route: 'records.status.enRoute',
  in_trip: 'records.status.inTrip',
  completed: 'records.status.completed',
  cancelled: 'records.status.cancelled',
};

function statusLabelKey(row: PassengerOrderHistoryRow): TranslationKey {
  if (row.status === 'cancelled' && row.cancelBy === 'passenger') {
    return 'records.status.cancelledByPassenger';
  }
  if (row.status === 'cancelled' && row.cancelBy === 'driver') {
    return 'records.status.cancelledByDriver';
  }
  if (row.status === 'cancelled') {
    return 'records.status.cancelled';
  }
  return STATUS_KEYS[row.status] ?? 'records.status.unknown';
}

export default function OrderRecordsScreen({ visible, onClose }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const [rows, setRows] = useState<PassengerOrderHistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNum: number, mode: 'replace' | 'append' | 'refresh') => {
    if (mode === 'replace') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'append') setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPassengerOrderHistory(pageNum);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setRows((prev) => (mode === 'append' ? [...prev, ...data.items] : data.items));
    } catch (e) {
      setError(userFacingError(e, 'records.loadFailed'));
      if (mode !== 'append') setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadPage(1, 'replace');
  }, [visible, loadPage]);

  const onRefresh = () => void loadPage(1, 'refresh');

  const onEndReached = () => {
    if (loadingMore || loading || refreshing || page >= totalPages) return;
    void loadPage(page + 1, 'append');
  };

  const confirmDelete = useCallback(
    (orderId: string) => {
      Alert.alert(t('records.deleteConfirmTitle'), t('records.deleteConfirmMessage'), [
        { text: t('schedule.cancel'), style: 'cancel' },
        {
          text: t('records.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await hidePassengerOrderFromHistory(orderId);
                setRows((prev) => prev.filter((r) => r.orderId !== orderId));
              } catch (e) {
                const msg = userFacingError(e, 'records.deleteFailed');
                if (msg.includes('進行中') || msg.includes('Active')) {
                  Alert.alert(t('records.deleteActiveTrip'), msg);
                } else {
                  Alert.alert(t('records.deleteFailed'), msg);
                }
              }
            })();
          },
        },
      ]);
    },
    [t],
  );

  const renderItem = ({ item }: { item: PassengerOrderHistoryRow }) => {
    const canRemove = !['accepted', 'en_route', 'in_trip'].includes(item.status);
    const fare =
      item.fareFinal != null && item.fareFinal !== ''
        ? formatHkd(Number(item.fareFinal))
        : item.fareEstimate != null
          ? formatHkd(Number(item.fareEstimate))
          : '—';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>#{item.orderId}</Text>
          <Text style={styles.placedAt}>{item.placedAtHk ?? '—'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{t(statusLabelKey(item))}</Text>
        </View>
        {item.driverMisaccept && item.status !== 'cancelled' ? (
          <Text style={styles.misacceptNote}>{t('records.driverMisaccept')}</Text>
        ) : null}
        <Text style={styles.routeLine} numberOfLines={2}>
          {t('records.pickup')}: {item.pickupAddress ?? '—'}
        </Text>
        <Text style={styles.routeLine} numberOfLines={2}>
          {t('records.dropoff')}: {item.dropoffAddress ?? '—'}
        </Text>
        {item.scheduledAtHk ? (
          <Text style={styles.metaLine}>{t('records.scheduled', { time: item.scheduledAtHk })}</Text>
        ) : null}
        <Text style={styles.fareLine}>{t('records.fare', { amount: fare })}</Text>
        {item.passengerPointsRedeemed != null && item.passengerPointsRedeemed > 0 ? (
          <Text style={styles.pointsUsedLine}>
            {t('records.pointsUsed', {
              points: String(item.passengerPointsRedeemed),
              amount: String(Math.round(item.passengerPointsDiscountHkd ?? 0)),
              hkd: String(Math.round(item.passengerPointsHkdPerPointAtOrder ?? 0)),
            })}
          </Text>
        ) : null}
        {canRemove ? (
          <Pressable
            onPress={() => confirmDelete(item.orderId)}
            style={styles.deleteBtn}
            accessibilityRole="button"
          >
            <Text style={styles.deleteBtnText}>{t('records.delete')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.mapDark} />
      <View style={styles.root}>
        <View style={[styles.header, headerInset, { paddingLeft: safeInsets.left + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('records.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {loading && rows.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.brandYellow} size="large" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.orderId}
            renderItem={renderItem}
            contentContainerStyle={
              rows.length === 0
                ? styles.emptyList
                : [styles.listContent, { paddingBottom: safeInsets.bottom + 32 }]
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandYellow} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              error ? (
                <Text style={styles.emptyText}>{error}</Text>
              ) : (
                <Text style={styles.emptyText}>{t('records.empty')}</Text>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={colors.brandYellow} style={styles.footerSpinner} />
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '700' },
  listContent: { padding: 16 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { color: colors.brandYellow, fontWeight: '800', fontSize: 15 },
  placedAt: { color: '#999', fontSize: 12 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,197,24,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusText: { color: colors.brandYellow, fontSize: 13, fontWeight: '700' },
  misacceptNote: { color: '#f0a040', fontSize: 12, marginBottom: 6 },
  routeLine: { color: '#ddd', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  metaLine: { color: '#aaa', fontSize: 12, marginTop: 4 },
  fareLine: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 8 },
  pointsUsedLine: { color: '#9cdc9c', fontSize: 13, marginTop: 6, lineHeight: 18 },
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deleteBtnText: { color: '#e57373', fontSize: 14, fontWeight: '600' },
  footerSpinner: { marginVertical: 16 },
});
