import axios from 'axios';
import { FirebaseError } from 'firebase/app';

function nestMessageFromAxios(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const raw = err.response?.data?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw)) {
    const joined = raw.map(String).join(' ');
    return joined.trim() || null;
  }
  return null;
}

/** CRM 登入頁：API check-phone + Firebase OTP 共用 */
export function loginFlowErrorMessage(err: unknown): string {
  const apiMsg = nestMessageFromAxios(err);
  if (apiMsg) return apiMsg;
  return firebaseAuthErrorMessage(err);
}

export function firebaseAuthErrorMessage(err: unknown): string {
  let code: string | null =
    err instanceof FirebaseError
      ? err.code
      : typeof err === 'object' &&
          err &&
          'code' in err &&
          typeof (err as { code: unknown }).code === 'string'
        ? (err as { code: string }).code
        : null;
  if (!code && err instanceof Error) {
    const m = err.message.match(/auth\/[\w-]+/);
    if (m) code = m[0];
  }

  switch (code) {
    case 'auth/too-many-requests':
      return '此電話或此裝置短時間內請求 OTP 次數過多，Firebase 已暫時封鎖。請約 15–60 分鐘後再試，或聯絡管理員在 Firebase 設定測試號碼。';
    case 'auth/invalid-phone-number':
      return '電話號碼格式無效，請確認香港號碼。';
    case 'auth/unauthorized-domain':
      return '此網域未在 Firebase 授權（Authentication → Settings → Authorized domains）。PROD 請加入 app.hktaketaxi.online。';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA 驗證失敗，請重新整理頁面後再試。';
    case 'auth/quota-exceeded':
      return 'SMS 配額已用盡，請稍後再試或聯絡管理員。';
    case 'auth/code-expired':
      return '驗證碼已過期，請重新發送。';
    case 'auth/invalid-verification-code':
      return '驗證碼錯誤，請再試一次。';
    case 'auth/billing-not-enabled':
      return 'Firebase 專案未啟用 Blaze 按量付費，無法發送電話 SMS OTP。請到 Firebase Console → 專案設定 → Usage and billing → 升級 Blaze（需連結 Google Cloud 帳單帳戶）。';
    case 'auth/operation-not-allowed':
      return 'Firebase 未允許電話 OTP（Authentication → Sign-in method 啟用 Phone；Settings → SMS region policy 加入 HK；專案需 Blaze 帳單）。';
    case 'auth/invalid-app-credential':
    case 'auth/app-not-authorized':
      return 'Firebase 應用設定錯誤（API key／域名與專案不一致）。請確認 CRM 使用 hktaketaxidriver 且已授權 app.hktaketaxi.online。';
    case 'auth/network-request-failed':
      return '無法連線 Firebase，請檢查網絡後再試。';
    default:
      break;
  }

  if (err instanceof Error && err.message && !err.message.startsWith('Firebase: Error')) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    const stripped = err.message.replace(/^Firebase: Error \([^)]+\)\.?\s*/i, '').trim();
    if (stripped) return stripped;
    if (code) return `Firebase 登入失敗（${code}），請稍後再試。`;
    return '登入失敗，請稍後再試';
  }
  if (code) return `Firebase 登入失敗（${code}），請稍後再試。`;
  return '無法發送驗證碼，請稍後再試';
}
