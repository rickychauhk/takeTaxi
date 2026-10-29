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
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRideTipsHtml } from '../api/rideTips';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import { useI18n } from '../i18n/I18nProvider';
import { colors } from '../theme/colors';
import { wrapWebviewHtml } from '../utils/webviewHtml';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function RideTipsScreen({ visible, onClose }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    void fetchRideTipsHtml().then((content) => {
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
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.bg} />
      <View style={styles.root}>
        <View
          style={[
            styles.header,
            headerInset,
            { paddingLeft: safeInsets.left + 8, paddingRight: safeInsets.right + 8 },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('menu.rideTips')}</Text>
          <View style={styles.backBtn} />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandYellow} />
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
            <Text style={styles.empty}>{t('rideTips.empty')}</Text>
          </View>
        )}
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
    backgroundColor: colors.bg,
  },
  backBtn: { width: 44, alignItems: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 22, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' },
  web: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
