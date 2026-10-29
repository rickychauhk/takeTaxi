import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchCompanyPriceNoticeHtml } from '../api/companyPriceNotice';
import { wrapWebviewHtml } from '../utils/webviewHtml';

const ACCENT = '#F4C430';
const ACCENT_BORDER = '#E5B82A';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CompanyPriceConfirmModal({ visible, onCancel, onConfirm }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    void fetchCompanyPriceNoticeHtml().then((content) => {
      if (!cancelled) {
        setHtml(content || null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>確認公司價訂單（只限的士）</Text>
          <View style={styles.body}>
            {loading ? (
              <ActivityIndicator size="large" color={ACCENT} style={styles.loader} />
            ) : html ? (
              <WebView
                originWhitelist={['*']}
                source={{ html: wrapWebviewHtml(html) }}
                style={styles.web}
                scrollEnabled
                nestedScrollEnabled
              />
            ) : (
              <Text style={styles.fallback}>無法載入公司價說明，請稍後再試。</Text>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                (loading || !html) && styles.confirmBtnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
              disabled={loading || !html}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>公司價 Call 車</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  body: {
    height: 320,
    backgroundColor: '#fff',
  },
  web: { flex: 1, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  fallback: { padding: 20, color: '#666', textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    borderRadius: 10,
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: '#111' },
  confirmBtn: {
    flex: 2,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 10,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: { fontSize: 16, fontWeight: '800', color: '#111' },
  pressed: { opacity: 0.88 },
});
