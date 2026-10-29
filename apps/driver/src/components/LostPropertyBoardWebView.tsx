import { Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { lostPropertyBoardUrl } from '../api/lostProperty';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LostPropertyBoardWebView({ visible, onClose }: Props) {
  const url = lostPropertyBoardUrl();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>失物協助</Text>
          <View style={styles.backBtn} />
        </View>
        <WebView source={{ uri: url }} style={styles.web} startInLoadingState />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  title: { color: colors.brandYellow, fontSize: 17, fontWeight: '700' },
  web: { flex: 1, backgroundColor: '#111' },
});
