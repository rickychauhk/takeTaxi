import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../constants/modalOrientations';
import { colors } from '../theme/colors';

export const RATING_SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

type Props = {
  visible: boolean;
  title: string;
  hint: string;
  submitLabel: string;
  skipLabel: string;
  defaultScore?: number;
  initialScore?: number | null;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (score: number) => Promise<void>;
};

export function TripRatingModal({
  visible,
  title,
  hint,
  submitLabel,
  skipLabel,
  defaultScore = 5,
  initialScore,
  onClose,
  onSkip,
  onSubmit,
}: Props) {
  const [score, setScore] = useState(defaultScore);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setScore(initialScore ?? defaultScore);
    setSubmitting(false);
  }, [visible, initialScore, defaultScore]);

  const submit = () => {
    if (submitting) return;
    void (async () => {
      setSubmitting(true);
      try {
        await onSubmit(score);
        onClose();
      } catch {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.scoreRow}>
            {RATING_SCORE_OPTIONS.map((v) => {
              const selected = score === v;
              return (
                <Pressable
                  key={v}
                  style={[styles.scoreChip, selected && styles.scoreChipOn]}
                  onPress={() => setScore(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.scoreChipText, selected && styles.scoreChipTextOn]}>
                    {v.toFixed(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.selectedLabel}>★ {score.toFixed(1)}</Text>
          <Pressable
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>{submitLabel}</Text>
            )}
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={onSkip} disabled={submitting} accessibilityRole="button">
            <Text style={styles.skipBtnText}>{skipLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  scoreChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    minWidth: 52,
    alignItems: 'center',
  },
  scoreChipOn: { backgroundColor: colors.brandYellow },
  scoreChipText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  scoreChipTextOn: { color: colors.onPrimary },
  selectedLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
  skipBtn: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  skipBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
