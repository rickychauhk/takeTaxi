import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import {
  fetchOrderChatMessages,
  fetchPassengerChatQuickReplies,
  markOrderChatRead,
  sendPassengerOrderChatMessage,
  type OrderChatMessage,
  type PassengerChatQuickReply,
} from '../api/orderChat';
import { fetchPassengerOrderTrack } from '../api/passengerOrder';

type Props = {
  orderId: string;
  driverName: string;
  vehiclePlate: string;
  onBack: () => void;
  /** 柯打取消／完成或聊天已關閉 */
  onOrderEnded?: () => void;
  onReleasedToHall?: () => void;
};

function chatUnavailableBecauseOrderEnded(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /不可使用訊息|已取消|已無法|cancelled|not found/i.test(msg);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString('zh-Hant', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function OrderTripChatScreen({
  orderId,
  driverName,
  vehiclePlate,
  onBack,
  onOrderEnded,
  onReleasedToHall,
}: Props) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 28)
        : 0;
  const listRef = useRef<FlatList<OrderChatMessage>>(null);
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<PassengerChatQuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [msgs, qr] = await Promise.all([
        fetchOrderChatMessages(orderId),
        fetchPassengerChatQuickReplies(),
      ]);
      setMessages(msgs);
      setQuickReplies(qr);
      setError(null);
      await markOrderChatRead(orderId);
    } catch (e) {
      if (chatUnavailableBecauseOrderEnded(e)) {
        onOrderEnded?.();
        return;
      }
      setError(userFacingError(e, 'trip.chatLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [orderId, onOrderEnded, t]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const pollOrder = () => {
      void fetchPassengerOrderTrack(orderId)
        .then((tr) => {
          if (tr.status === 'cancelled' || tr.status === 'completed') {
            onOrderEnded?.();
          }
        })
        .catch(() => {});
    };
    pollOrder();
    const id = setInterval(pollOrder, 2500);
    return () => clearInterval(id);
  }, [orderId, onOrderEnded]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async (input: { quickReplyId: number }) => {
    setSending(true);
    try {
      const result = await sendPassengerOrderChatMessage(orderId, input);
      setMessages((prev) => [...prev, result.message]);
      if (result.cancelOrder) {
        onOrderEnded?.();
      } else if (result.releaseToHall) {
        onReleasedToHall?.();
      } else {
        await markOrderChatRead(orderId);
      }
    } catch (e) {
      if (chatUnavailableBecauseOrderEnded(e)) {
        onOrderEnded?.();
        return;
      }
      setError(userFacingError(e, 'trip.chatSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const quickLabel = (q: PassengerChatQuickReply) =>
    locale === 'en' && q.labelEn?.trim() ? q.labelEn.trim() : q.labelZh;

  const renderItem = ({ item, index }: { item: OrderChatMessage; index: number }) => {
    const prev = index > 0 ? messages[index - 1] : null;
    const showDay =
      !prev || formatDayLabel(prev.createdAt) !== formatDayLabel(item.createdAt);
    const mine = item.senderRole === 'passenger';
    return (
      <View>
        {showDay ? (
          <View style={styles.dayPillWrap}>
            <Text style={styles.dayPill}>{formatDayLabel(item.createdAt)}</Text>
          </View>
        ) : null}
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.body}
            </Text>
            <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: topInset, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {driverName}
          </Text>
          <Text style={styles.headerPlate} numberOfLines={1}>
            {vehiclePlate}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>{t('trip.chatEmpty')}</Text>
            }
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={[styles.quickWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {quickReplies.map((q) => (
              <Pressable
                key={q.id}
                style={[styles.quickChip, sending && styles.quickChipDisabled]}
                disabled={sending}
                onPress={() => void send({ quickReplyId: q.id })}
              >
                <Text style={styles.quickChipText}>{quickLabel(q)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: colors.brand },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { fontSize: 17, fontWeight: '800', color: '#111' },
  headerPlate: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 2 },
  headerSpacer: { width: 44 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  dayPillWrap: { alignItems: 'center', marginVertical: 12 },
  dayPill: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bubbleRow: { marginBottom: 8, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#f3f3f3', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: '#111' },
  time: { fontSize: 11, marginTop: 4 },
  timeMine: { color: 'rgba(255,255,255,0.85)', textAlign: 'right' },
  timeTheirs: { color: '#888' },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  quickChipDisabled: { opacity: 0.5 },
  quickChipText: { fontSize: 14, color: colors.brand, fontWeight: '700' },
  error: { color: '#c62828', textAlign: 'center', fontSize: 13, paddingBottom: 4 },
});
