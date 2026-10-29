import {
  DRIVER_CANCEL_REPORT_CODES,
  DRIVER_CANCEL_REPORT_LABELS,
  type DriverCancelReportCode,
} from '@taxima/shared';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  /** 不需回報，直接取消 */
  onDirectCancel: () => void;
  /** 選擇回報原因後取消 */
  onCancelWithReport: (code: DriverCancelReportCode) => void;
};

export function DriverCancelOrderSheet({
  visible,
  busy = false,
  onClose,
  onDirectCancel,
  onCancelWithReport,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>取消訂單</Text>
          <Text style={styles.subtitle}>是否需要回報問題？</Text>

          <Pressable
            style={[styles.btn, styles.btnMuted, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={onDirectCancel}
          >
            <Text style={styles.btnTextDark}>不需回報，直接取消</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>回報問題（選一項後取消）</Text>
          {DRIVER_CANCEL_REPORT_CODES.map((code) => (
            <Pressable
              key={code}
              style={[styles.btn, styles.btnReport, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => onCancelWithReport(code)}
            >
              <Text style={styles.btnTextLight}>{DRIVER_CANCEL_REPORT_LABELS[code]}</Text>
            </Pressable>
          ))}

          <Pressable
            style={[styles.btn, styles.btnContinue, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={onClose}
          >
            <Text style={styles.btnTextDark}>我不取消柯打繼續</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  btn: {
    minHeight: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnMuted: {
    backgroundColor: '#e53935',
  },
  btnReport: {
    backgroundColor: '#5c5c5c',
  },
  btnContinue: {
    backgroundColor: colors.brandYellow,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnTextLight: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnTextDark: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
