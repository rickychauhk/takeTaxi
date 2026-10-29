import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalOverlayInsets } from '../components/ScreenSafeArea';
import { submitPassengerFeedback } from '../api/submitFeedback';
import type { PassengerMemberProfile } from '../api/passengerProfile';
import { useI18n } from '../i18n/I18nProvider';
import { userFacingError } from '../i18n/userFacingError';
import { formatHongKongPhoneInputValue } from '@taxima/shared';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  memberProfile: PassengerMemberProfile | null;
};

export default function FeedbackScreen({ visible, onClose, memberProfile }: Props) {
  const { t } = useI18n();
  const headerInset = useModalOverlayInsets({ top: 4, right: 0 });
  const safeInsets = useSafeAreaInsets();
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSenderName(memberProfile?.displayName?.trim() ?? '');
    setSenderPhone(
      memberProfile?.phone?.trim()
        ? formatHongKongPhoneInputValue(memberProfile.phone)
        : '',
    );
    setMessage('');
  }, [visible, memberProfile?.displayName, memberProfile?.phone]);

  const onSubmit = async () => {
    const name = senderName.trim();
    const phone = senderPhone.trim();
    const body = message.trim();
    if (!body) {
      Alert.alert(t('feedback.title'), t('feedback.messageRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await submitPassengerFeedback({
        senderName: name || t('feedback.anonymousName'),
        senderPhone: phone || '—',
        message: body,
      });
      Alert.alert(t('feedback.title'), t('feedback.submitSuccess'), [
        { text: t('common.ok'), onPress: onClose },
      ]);
    } catch (e) {
      Alert.alert(t('feedback.title'), userFacingError(e, t('feedback.submitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor={colors.mapDark} />
      <View style={styles.root}>
        <View
          style={[
            styles.header,
            headerInset,
            { paddingLeft: safeInsets.left + 8, paddingRight: safeInsets.right + 8 },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn} disabled={submitting}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.title}>{t('feedback.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingLeft: safeInsets.left + 20, paddingRight: safeInsets.right + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>{t('feedback.hint')}</Text>

            <Text style={styles.label}>{t('feedback.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('feedback.namePlaceholder')}
              placeholderTextColor="#666"
              value={senderName}
              onChangeText={setSenderName}
              editable={!submitting}
              autoCapitalize="words"
            />

            <Text style={styles.label}>{t('feedback.phoneLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('feedback.phonePlaceholder')}
              placeholderTextColor="#666"
              value={senderPhone}
              onChangeText={setSenderPhone}
              editable={!submitting}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t('feedback.messageLabel')}</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder={t('feedback.messagePlaceholder')}
              placeholderTextColor="#666"
              value={message}
              onChangeText={setMessage}
              editable={!submitting}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingLeft: safeInsets.left + 20, paddingRight: safeInsets.right + 20, paddingBottom: safeInsets.bottom + 24 },
            ]}
          >
            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={styles.submitText}>{t('feedback.submit')}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.brandYellow, fontSize: 28, fontWeight: '600' },
  title: { color: colors.brandYellow, fontSize: 18, fontWeight: '700' },
  scroll: { paddingBottom: 24 },
  hint: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  label: { color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#eee',
    fontSize: 16,
    marginBottom: 18,
  },
  messageInput: { minHeight: 140, paddingTop: 12 },
  footer: {},
  submitBtn: {
    backgroundColor: colors.brandYellow,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#111', fontSize: 17, fontWeight: '700' },
});
