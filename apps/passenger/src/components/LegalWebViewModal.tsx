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
import { ScreenSafeArea } from './ScreenSafeArea';
import { WebView } from 'react-native-webview';
import { fetchTermsHtml } from '../api/legal';
import { useI18n } from '../i18n/I18nProvider';
import { wrapWebviewHtml } from '../utils/webviewHtml';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LegalWebViewModal({ visible, onClose }: Props) {
  const { t } = useI18n();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    void fetchTermsHtml('passenger').then((content) => {
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <ScreenSafeArea style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.termsTitle')}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#c62828" />
          </View>
        ) : html ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: wrapWebviewHtml(html) }}
            style={styles.web}
            setSupportMultipleWindows={false}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.err}>{t('settings.termsEmpty')}</Text>
          </View>
        )}
      </ScreenSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  close: { color: '#ccc', fontSize: 22, fontWeight: '600' },
  web: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { color: '#aaa', textAlign: 'center', lineHeight: 22 },
});
