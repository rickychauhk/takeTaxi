import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

export const RATING_SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

type Props = {
  visible: boolean;
  title: string;
  hint: string;
  submitLabel: string;
  skipLabel: string;
  commentLabel?: string;
  commentPlaceholder?: string;
  defaultScore?: number;
  initialScore?: number | null;
  initialComment?: string | null;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (score: number, comment?: string) => Promise<void>;
};

export default function TripRatingModal({
  visible,
  title,
  hint,
  submitLabel,
  skipLabel,
  commentLabel,
  commentPlaceholder,
  defaultScore = 5,
  initialScore,
  initialComment,
  onClose,
  onSkip,
  onSubmit,
}: Props) {
  const [score, setScore] = useState(defaultScore);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setScore(initialScore ?? defaultScore);
    setComment(initialComment?.trim() ?? '');
    setSubmitting(false);
  }, [visible, initialScore, initialComment, defaultScore]);

  const submit = () => {
    if (submitting) return;
    void (async () => {
      setSubmitting(true);
      try {
        const trimmed = comment.trim();
        await onSubmit(score, trimmed || undefined);
        onClose();
      } catch {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
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
              {commentLabel ? (
                <>
                  <Text style={styles.commentLabel}>{commentLabel}</Text>
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={commentPlaceholder}
                    placeholderTextColor="#999"
                    multiline
                    textAlignVertical="top"
                    editable={!submitting}
                    maxLength={500}
                  />
                </>
              ) : null}
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
              <Pressable
                style={styles.skipBtn}
                onPress={onSkip}
                disabled={submitting}
                accessibilityRole="button"
              >
                <Text style={styles.skipBtnText}>{skipLabel}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
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
  keyboardWrap: { width: '100%' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  hint: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  scoreChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 52,
    alignItems: 'center',
  },
  scoreChipOn: { backgroundColor: colors.brandYellow },
  scoreChipText: { fontSize: 15, fontWeight: '700', color: '#444' },
  scoreChipTextOn: { color: colors.onPrimary },
  selectedLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  commentLabel: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 8 },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    minHeight: 88,
    maxHeight: 140,
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
  skipBtnText: { fontSize: 15, fontWeight: '600', color: '#888' },
});
