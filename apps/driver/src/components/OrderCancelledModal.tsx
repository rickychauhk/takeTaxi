import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import { colors } from '../theme/colors';
import { useDrivingUi } from '../hooks/useDrivingUi';

type Props = {
  visible: boolean;
  onConfirm: () => void;
};

/** 乘客／系統取消柯打時提示，確認後返回接單首頁 */
export function OrderCancelledModal({ visible, onConfirm }: Props) {
  const driving = useDrivingUi();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="close-circle" size={driving.iconSize + 2} color="#f87171" />
            <Text style={[styles.title, { fontSize: driving.titleSize }]}>柯打已取消</Text>
          </View>
          <Text style={[styles.message, { fontSize: driving.bodySize }]}>
            乘客已取消此柯打，你將返回接單首頁。
          </Text>
          <Pressable
            style={[styles.btn, { minHeight: driving.primaryBtnHeight }]}
            onPress={onConfirm}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, { fontSize: driving.primaryTextSize }]}>返回主頁</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: { color: colors.text, fontWeight: '800' },
  message: {
    color: colors.textMuted,
    lineHeight: 26,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnText: { color: colors.onPrimary, fontWeight: '800' },
});
