import { FirebaseError } from 'firebase/app';
import type { TranslationKey } from '../i18n';

export function firebaseAuthErrorKey(err: unknown): TranslationKey | null {
  const code = firebaseAuthCode(err);
  switch (code) {
    case 'auth/too-many-requests':
      return 'auth.errorTooManyRequests';
    case 'auth/invalid-phone-number':
      return 'auth.errorInvalidPhone';
    case 'auth/quota-exceeded':
      return 'auth.errorQuota';
    case 'auth/code-expired':
      return 'auth.otpExpired';
    case 'auth/invalid-verification-code':
      return 'auth.errorInvalidCode';
    case 'auth/billing-not-enabled':
      return 'auth.errorBilling';
    case 'auth/operation-not-allowed':
      return 'auth.errorOperationNotAllowed';
    case 'auth/network-request-failed':
      return 'auth.errorNetwork';
    default:
      return null;
  }
}

function firebaseAuthCode(err: unknown): string | null {
  return (
    err instanceof FirebaseError
      ? err.code
      : typeof err === 'object' &&
          err &&
          'code' in err &&
          typeof (err as { code: unknown }).code === 'string'
        ? (err as { code: string }).code
        : null
  ) ?? (err instanceof Error ? err.message.match(/auth\/[\w-]+/)?.[0] ?? null : null);
}
