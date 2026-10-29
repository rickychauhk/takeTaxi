import { messageFromDriverApiErrorBody } from '../api/parseDriverApiError';

const DEFAULT_REVOKED_MSG = '帳戶已在另一部裝置登入，此裝置已登出。';

let handler: ((message: string) => void) | null = null;

export function registerDriverSessionRevokedHandler(fn: ((message: string) => void) | null) {
  handler = fn;
}

export function notifyDriverSessionRevoked(message: string) {
  handler?.(formatSessionRevokedMessage(message));
}

/** 401／被踢登出：只顯示可讀文字，唔顯示 JSON */
export function formatSessionRevokedMessage(bodyText: string): string {
  const fromApi = messageFromDriverApiErrorBody(bodyText);
  if (fromApi) return fromApi;
  const t = bodyText.trim();
  if (t && !t.startsWith('{') && t.length < 400) return t;
  return DEFAULT_REVOKED_MSG;
}

export function parseSessionRevokedMessage(bodyText: string): string | null {
  if (!bodyText.trim()) return null;
  return formatSessionRevokedMessage(bodyText);
}
