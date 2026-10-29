import { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import {
  signInWithPhoneNumber,
  type ApplicationVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
import { formatHongKongPhoneInputValue } from '@taxima/shared';
import { passengerApiErrorMessage, passengerFetch } from '../api/passengerClient';
import { usePassengerAuth } from '../auth/PassengerAuthContext';
import { loadRememberPhone, saveRememberPhone } from '../auth/session';
import { firebaseAuthErrorKey } from '../firebase/authErrors';
import { firebaseAuth } from '../firebase/app';
import { firebaseConfig } from '../firebase/config';
import { toE164HongKong, validateHongKongPhoneInput } from '../firebase/phone';
import { useI18n } from '../i18n/I18nProvider';
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

export default function PassengerLoginScreen() {
  const { t, locale, setLanguageMode } = useI18n();
  const insets = useSafeAreaInsets();
  const { loginWithFirebase } = usePassengerAuth();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneE164, setPhoneE164] = useState('');
  const [registeredHint, setRegisteredHint] = useState<'new' | 'existing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadRememberPhone().then((saved) => setPhone(formatHongKongPhoneInputValue(saved)));
  }, []);

  const authErrorMessage = (err: unknown, fallback: string) => {
    const key = firebaseAuthErrorKey(err);
    return key ? t(key) : err instanceof Error ? err.message : fallback;
  };

  const sendOtp = async () => {
    setError(null);
    const phoneErr = validateHongKongPhoneInput(phone, locale);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setLoading(true);
    try {
      const e164 = toE164HongKong(phone);
      setPhoneE164(e164);
      await saveRememberPhone(phone);

      const checkRes = await passengerFetch('/passenger/auth/check-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: e164 }),
      });
      if (checkRes.ok) {
        const check = (await checkRes.json()) as { registered?: boolean };
        setRegisteredHint(check.registered ? 'existing' : 'new');
      } else if (checkRes.status !== 404) {
        const text = await checkRes.text();
        throw new Error(passengerApiErrorMessage(checkRes.status, text, t('auth.sendOtpFailed')));
      }

      if (!recaptchaRef.current) {
        throw new Error(t('auth.sendOtpFailed'));
      }
      const verifier = recaptchaRef.current as unknown as ApplicationVerifier;
      confirmationRef.current = await withTimeout(
        signInWithPhoneNumber(firebaseAuth, e164, verifier),
        SEND_OTP_TIMEOUT_MS,
        t('auth.sendOtpTimeout'),
      );
      setStep('otp');
    } catch (e) {
      setError(authErrorMessage(e, t('auth.sendOtpFailed')));
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
      setError(authErrorMessage(e, t('auth.verifyFailed')));
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    void setLanguageMode(locale === 'en' ? 'zh-Hant' : 'en');
  };

  const hintText =
    step === 'otp'
      ? null
      : registeredHint === 'new'
        ? t('auth.hintNew')
        : registeredHint === 'existing'
          ? t('auth.hintExisting')
          : t('auth.hint');

  return (
    <SafeAreaView style={styles.root}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={false}
        title={t('auth.recaptchaTitle')}
        cancelLabel={t('auth.recaptchaCancel')}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>{t('auth.brand')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
          {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'phone' ? (
            <>
              <Text style={styles.label}>{t('auth.phoneLabel')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setRegisteredHint(null);
                }}
                keyboardType="phone-pad"
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor="#999"
              />
              <Pressable style={styles.primaryBtn} onPress={() => void sendOtp()} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>
                    {registeredHint === 'new'
                      ? t('auth.sendOtpRegister')
                      : registeredHint === 'existing'
                        ? t('auth.sendOtpLogin')
                        : t('auth.sendOtp')}
                  </Text>
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
                placeholderTextColor="#999"
              />
              <Pressable style={styles.primaryBtn} onPress={() => void confirmOtp()} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>{t('auth.loginContinue')}</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.languageToggleA11y')}
        style={[styles.langBtn, { bottom: Math.max(insets.bottom, 12) + 8 }]}
        onPress={toggleLanguage}
        hitSlop={8}
      >
        <Text style={styles.langBtnText}>{locale === 'en' ? '中' : 'EN'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapDark },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '900', color: colors.brand, marginBottom: 8 },
  subtitle: { fontSize: 17, color: colors.text, marginBottom: 8, lineHeight: 24 },
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 20 },
  label: { color: colors.textMuted, marginBottom: 8, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.panelBgSolid,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: colors.brandYellow,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 17 },
  sent: { color: colors.text, marginBottom: 12, lineHeight: 20 },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.brandYellow, fontWeight: '700', textDecorationLine: 'underline' },
  error: { color: '#c62828', marginBottom: 12, lineHeight: 20 },
  langBtn: {
    position: 'absolute',
    right: 16,
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.panelBgSolid,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  langBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
});
