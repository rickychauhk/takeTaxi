import { messageFromPassengerApiErrorBody } from '../api/parsePassengerApiError';
import { t, type TranslationKey } from './index';

/** 將 API／網路 Error 轉成使用者可讀、已翻譯訊息（避免裸 HTTP 英文） */
export function userFacingError(e: unknown, fallbackKey: TranslationKey): string {
  if (!(e instanceof Error)) return t(fallbackKey);
  const msg = e.message.trim();
  if (!msg) return t(fallbackKey);

  const apiMsg = messageFromPassengerApiErrorBody(msg);
  if (apiMsg) return apiMsg;

  const http = /^HTTP (\d{3})(?:\s|$)/.exec(msg);
  if (http) return t('error.http', { code: http[1]! });

  if (msg === 'timeout') return t('error.timeout');

  if (/abort/i.test(msg)) return t('error.timeout');

  if (
    /Missing token|Invalid token|Passenger not found|請先完成電話驗證|appClientId 與登入帳戶不符/i.test(
      msg,
    )
  ) {
    return t('error.relogin');
  }

  if (
    /Google Directions|OSRM|no route|Directions HTTP|network request failed/i.test(msg)
  ) {
    return t('error.routeFailed');
  }

  if (msg.length > 0 && msg.length <= 400 && !msg.startsWith('{') && !/^HTTP \d/.test(msg)) {
    return msg;
  }

  return t(fallbackKey);
}
