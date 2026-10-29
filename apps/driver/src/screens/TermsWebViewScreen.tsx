import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea } from '../components/ScreenSafeArea';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { fetchTermsHtml } from '../api/legal';
import { colors } from '../theme/colors';
import { wrapWebviewHtml } from '../utils/webviewHtml';

export default function TermsWebViewScreen() {
  const navigation = useNavigation();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchTermsHtml().then((content) => {
      setHtml(content || null);
      setLoading(false);
    });
  }, []);

  return (
    <ScreenSafeArea style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>使用條款</Text>
        <View style={styles.backSpacer} />
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
          <Text style={styles.err}>尚未設定使用條款，請聯絡後台。</Text>
        </View>
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.brandYellow, fontSize: 16, fontWeight: '600', minWidth: 72 },
  backSpacer: { minWidth: 72 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  web: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
