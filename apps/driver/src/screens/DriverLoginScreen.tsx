import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthStack';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import {
  signInWithPhoneNumber,
  type ApplicationVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import { apiFetch } from '../api/client';
import { getApiBaseUrl } from '../api/config';
import { useDriverAuth } from '../auth/DriverAuthContext';
import { loadRememberPhone, saveRememberPhone } from '../auth/session';
import { formatHongKongPhoneInputValue } from '@taxima/shared';
import { firebaseAuth } from '../firebase/app';
import { firebaseConfig } from '../firebase/config';
import { toE164HongKong, validateHongKongPhoneInput } from '../firebase/phone';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { colors } from '../theme/colors';

const SEND_OTP_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function parseApiError(text: string, status?: number): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    const m = j.message;
    const msg = Array.isArray(m) ? m.join(' ') : m;
    if (msg?.includes('Cannot POST') && msg.includes('driver/auth/phone-login')) {
      return (
        `後端未有司機 phone-login API（${getApiBaseUrl()}）。` +
        '請 deploy 最新 API 到 UAT／PROD，或本機啟動 API 後重新開 App。'
      );
    }
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  if (status === 404) {
    return `API 找不到（404）：${getApiBaseUrl()}。請確認後端已部署最新司機 auth。`;
  }
  return text || '登入失敗';
}

export default function DriverLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { loginWithFirebase } = useDriverAuth();
  const { isLandscape, width } = useLayoutMode();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneE164, setPhoneE164] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadRememberPhone().then((saved) => setPhone(formatHongKongPhoneInputValue(saved)));
  }, []);

  const sendOtp = async () => {
    setError(null);
    const phoneErr = validateHongKongPhoneInput(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setLoading(true);
    try {
      const e164 = toE164HongKong(phone);
      const check = await apiFetch('/driver/auth/check-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: e164 }),
      });
      if (!check.ok) {
        throw new Error(parseApiError(await check.text(), check.status));
      }
      const body = (await check.json()) as {
        exists?: boolean;
        phone?: string;
        useWorkPhone?: boolean;
      };
      if (body.useWorkPhone) {
        setError('請使用開工電話登入（收工電話不能登入）');
        return;
      }
      if (body.exists === false) {
        navigation.navigate('Register', { phone });
        return;
      }
      setPhoneE164(e164);
      await saveRememberPhone(phone);
      if (!recaptchaRef.current) {
        throw new Error(t('auth.sendOtpFailed'));
      }
      const verifier = recaptchaRef.current as unknown as ApplicationVerifier;
      confirmationRef.current = await withTimeout(
        signInWithPhoneNumber(firebaseAuth, e164, verifier),
        SEND_OTP_TIMEOUT_MS,
        '發送驗證碼逾時，請完成 reCAPTCHA 後再試；模擬器建議改用實機。',
      );
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.sendOtpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const conf = confirmationRef.current;
      if (!conf) throw new Error(t('auth.otpExpired'));
      await conf.confirm(code.trim());
      const idToken = await firebaseAuth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error(t('auth.tokenFailed'));
      await loginWithFirebase(idToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formMaxWidth = isLandscape ? Math.min(480, width * 0.55) : undefined;

  return (
    <SafeAreaView style={styles.root}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={false}
        title="人機驗證"
        cancelLabel="取消"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && styles.scrollContentLandscape,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.form, formMaxWidth ? { maxWidth: formMaxWidth, width: '100%' } : null]}>
            <Text style={styles.brand}>{t('auth.brand')}</Text>
            <Text style={styles.subtitle}>輸入開工電話，以 SMS 驗證碼登入；新司機會前往登記頁</Text>
            <Text style={styles.hint}>登入後除非按「登出」，否則保持登入。</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {step === 'phone' ? (
              <>
                <Text style={styles.label}>開工電話</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="91234567"
                  placeholderTextColor="#666"
                />
                <Pressable style={styles.primaryBtn} onPress={() => void sendOtp()} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryText}>{t('auth.sendOtp')}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sent}>
                  {t('auth.sentTo', { phone: phoneE164.replace('+852', '') })}
                </Text>
                <Text style={styles.label}>{t('auth.otpLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder={t('auth.otpPlaceholder')}
                  placeholderTextColor="#666"
                />
                <Pressable style={styles.primaryBtn} onPress={() => void confirmOtp()} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryText}>{t('auth.registerContinue')}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => {
                    setStep('phone');
                    setCode('');
                    confirmationRef.current = null;
                  }}
                >
                  <Text style={styles.linkText}>{t('auth.changePhone')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  scrollContentLandscape: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  form: { alignSelf: 'stretch' },
  brand: { color: colors.brandYellow, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: colors.text, fontSize: 16, marginBottom: 8, lineHeight: 22 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 24 },
  label: { color: colors.textMuted, marginBottom: 8, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: colors.brandYellow,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 17 },
  sent: { color: colors.text, marginBottom: 12, lineHeight: 20 },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.brandYellow, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: 12, lineHeight: 20 },
});
