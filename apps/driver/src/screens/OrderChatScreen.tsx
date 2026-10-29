import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTopSafePadding } from '../components/ScreenSafeArea';
import { useLandscapeContentColumn } from '../hooks/useLandscapeContentColumn';
import {
  fetchDriverOrderChatMessages,
  markDriverOrderChatRead,
  sendDriverOrderChatMessage,
  type OrderChatMessage,
} from '../api/orderChat';
import type { RootStackParamList } from '../navigation/types';
import { DRIVER_CHAT_PRESET_MESSAGES } from '../trip/driverQuickChatMessages';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderChat'>;

export default function OrderChatScreen({ route, navigation }: Props) {
  const { orderId, headerTitle, headerSubtitle } = route.params;
  const topPad = useTopSafePadding(8);
  const { outer, inner } = useLandscapeContentColumn(560);
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
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  const sendText = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await sendDriverOrderChatMessage(orderId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const send = () => void sendText(draft);

  return (
    <View style={[styles.root, outer, { paddingTop: topPad }]}>
      <View style={inner}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          {headerSubtitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandYellow} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
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
          <View style={styles.presetWrap}>
            {DRIVER_CHAT_PRESET_MESSAGES.map((label) => (
              <Pressable
                key={label}
                style={[styles.presetChip, sending && styles.presetChipDisabled]}
                disabled={sending}
                onPress={() => void sendText(label)}
              >
                <Text style={styles.presetChipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="回覆乘客…"
              placeholderTextColor="#888"
              multiline
            />
            <Pressable
              style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}
              disabled={!draft.trim() || sending}
              onPress={() => void send()}
            >
              <Text style={styles.sendText}>傳送</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
      </View>
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  back: { fontSize: 22, fontWeight: '700', color: colors.brandYellow, width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 13, color: '#666', marginTop: 2 },
  headerSpacer: { width: 36 },
  list: { padding: 16, flexGrow: 1 },
  row: { marginBottom: 8, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 14, padding: 10 },
  bubbleMine: { backgroundColor: colors.brandYellow },
  bubbleTheirs: { backgroundColor: '#f0f0f0' },
  textMine: { color: '#fff', fontSize: 17, lineHeight: 24 },
  textTheirs: { color: '#111', fontSize: 17, lineHeight: 24 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 17 },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  presetChip: {
    borderWidth: 1.5,
    borderColor: colors.brandYellow,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  presetChipDisabled: { opacity: 0.5 },
  presetChipText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 96,
    fontSize: 16,
  },
  send: {
    backgroundColor: colors.brandYellow,
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
  sendText: { fontWeight: '800', color: '#fff' },
});
