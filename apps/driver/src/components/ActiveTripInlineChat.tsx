import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  fetchDriverOrderChatMessages,
  markDriverOrderChatRead,
  sendDriverOrderChatMessage,
  type OrderChatMessage,
} from '../api/orderChat';
import { useOrderChatIncomingSound } from '../hooks/useOrderChatIncomingSound';
import { colors } from '../theme/colors';

type Props = {
  orderId: string;
  style?: StyleProp<ViewStyle>;
  externalBusy?: boolean;
};

export function ActiveTripInlineChat({ orderId, style, externalBusy }: Props) {
  const listRef = useRef<FlatList<OrderChatMessage>>(null);
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');

  const refresh = useCallback(async () => {
    try {
      const msgs = await fetchDriverOrderChatMessages(orderId);
      setMessages(msgs);
      await markDriverOrderChatRead(orderId);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  useOrderChatIncomingSound(orderId, messages);

  const sendText = async (text: string) => {
    const body = text.trim();
    if (!body || sending || externalBusy) return;
    setSending(true);
    try {
      const msg = await sendDriverOrderChatMessage(orderId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '無法傳送訊息';
      Alert.alert('訊息', msg);
    } finally {
      setSending(false);
    }
  };

  const busy = sending || !!externalBusy;

  return (
    <View style={[styles.box, style]}>
      {loading && messages.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.brandYellow} />
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.senderRole === 'driver';
            return (
              <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{item.body}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>暫無訊息</Text>}
        />
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="回覆乘客…"
          placeholderTextColor="#888"
          multiline
          editable={!busy}
        />
        <Pressable
          style={[styles.send, (!draft.trim() || busy) && styles.sendOff]}
          disabled={!draft.trim() || busy}
          onPress={() => void sendText(draft)}
        >
          <Text style={styles.sendText}>傳送</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
    minHeight: 120,
  },
  loader: { marginVertical: 24 },
  list: { flex: 1 },
  listContent: { padding: 10, flexGrow: 1 },
  row: { marginBottom: 6, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.brandYellow },
  bubbleTheirs: { backgroundColor: '#e8e8e8' },
  textMine: { color: '#fff', fontSize: 15, lineHeight: 21 },
  textTheirs: { color: '#111', fontSize: 15, lineHeight: 21 },
  empty: { textAlign: 'center', color: '#999', marginTop: 16, fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#555',
    backgroundColor: '#333',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 72,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  send: {
    backgroundColor: colors.brandYellow,
    borderRadius: 18,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
  sendText: { fontWeight: '800', color: '#fff', fontSize: 15 },
});
