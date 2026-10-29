import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useModalOverlayInsets } from './ScreenSafeArea';
import { WebView } from 'react-native-webview';
import { fetchAdWebviewHtml } from '../api/ads';
import { useI18n } from '../i18n/I18nProvider';

type Props = {
  visible: boolean;
  adId: number;
  onClose: () => void;
};

export function AdWebViewModal({ visible, adId, onClose }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    void fetchAdWebviewHtml(adId).then((content) => {
      if (!cancelled) {
        setHtml(content);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, adId]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="#fff" />
      <View style={styles.root}>
        <View style={[styles.header, headerInset]}>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('ads.closeA11y')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : html ? (
          <WebView originWhitelist={['*']} source={{ html }} style={styles.web} />
        ) : (
          <View style={styles.center}>
            <Text style={styles.err}>{t('ads.loadFailed')}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { fontSize: 18, fontWeight: '700', color: '#333' },
  web: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  err: { color: '#666' },
});
