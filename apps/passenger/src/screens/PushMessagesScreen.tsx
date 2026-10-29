import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchPassengerCrmMessages } from '../api/passengerMessages';
import { readPassengerPushInbox } from '../storage/passengerPushInbox';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import { colors } from '../theme/colors';

export type PassengerMessageRow = {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  sortTime: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

function formatLocalTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mergeMessageRows(
  crm: Awaited<ReturnType<typeof fetchPassengerCrmMessages>>,
  local: Awaited<ReturnType<typeof readPassengerPushInbox>>,
): PassengerMessageRow[] {
  const rows: PassengerMessageRow[] = [];
  const seenApiIds = new Set<string>();
  const seenContent = new Set<string>();

  for (const c of crm) {
    seenApiIds.add(c.id);
    const key = `${c.title}\0${c.body}`;
    seenContent.add(key);
    rows.push({
      id: `crm-${c.id}`,
      title: c.title,
      body: c.body,
      timeLabel: c.createdAtHk ?? formatLocalTime(new Date(c.createdAt).getTime()),
      sortTime: new Date(c.createdAt).getTime(),
    });
  }

  for (const l of local) {
    if (seenApiIds.has(l.id)) continue;
    const key = `${l.title}\0${l.body}`;
    if (seenContent.has(key)) continue;
    rows.push({
      id: `local-${l.id}`,
      title: l.title || '—',
      body: l.body,
      timeLabel: formatLocalTime(l.receivedAt),
      sortTime: l.receivedAt,
    });
  }

  rows.sort((a, b) => b.sortTime - a.sortTime);
  return rows;
}

export default function PushMessagesScreen({ visible, onClose }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const [rows, setRows] = useState<PassengerMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PassengerMessageRow | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const local = await readPassengerPushInbox();
      let crm: Awaited<ReturnType<typeof fetchPassengerCrmMessages>> = [];
      try {
        crm = await fetchPassengerCrmMessages();
      } catch (e) {
        if (local.length === 0) throw e;
      }
      setRows(mergeMessageRows(crm, local));
    } catch (e) {
      setError(userFacingError(e, t('messages.loadFailed')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      return;
    }
    void load();
  }, [visible, load]);

  const listView = (
    <>
      {loading && rows.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandYellow} />
        </View>
      ) : error && rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>{t('messages.retry')}</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('messages.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandYellow} />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: safeInsets.bottom + 16 }]}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setSelected(item)}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.rowTime}>{item.timeLabel}</Text>
            </Pressable>
          )}
        />
      )}
    </>
  );

  const detailView = selected ? (
    <View style={[styles.detailWrap, { paddingBottom: safeInsets.bottom + 16 }]}>
      <Text style={styles.detailTitle}>{selected.title}</Text>
      <Text style={styles.detailTime}>{selected.timeLabel}</Text>
      <Text style={styles.detailBody}>{selected.body || '—'}</Text>
    </View>
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.bg} />
      <View style={styles.root}>
        <View style={[styles.header, headerInset, { paddingLeft: safeInsets.left + 8 }]}>
          <Pressable
            onPress={() => {
              if (selected) {
                setSelected(null);
                return;
              }
              onClose();
            }}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {selected ? t('messages.detailTitle') : t('messages.title')}
          </Text>
          <View style={styles.backBtn} />
        </View>
        {selected ? detailView : listView}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, alignItems: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 22, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' },
  listContent: { paddingVertical: 8 },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  rowTime: { color: colors.textMuted, fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  errorText: { color: '#f88', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: colors.brandYellow, fontWeight: '700' },
  detailWrap: { flex: 1, padding: 20 },
  detailTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  detailTime: { color: colors.textMuted, fontSize: 13, marginBottom: 20 },
  detailBody: { color: colors.text, fontSize: 16, lineHeight: 26 },
});
