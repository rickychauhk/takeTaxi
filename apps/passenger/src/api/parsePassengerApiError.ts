import { t } from '../i18n';

/** NestJS 400 回應 → 乘客可讀訊息 */
export function messageFromPassengerApiErrorBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const data = JSON.parse(trimmed) as { message?: string | string[]; error?: string };
    const raw = data.message;
    const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (parts.length === 0) return null;
    const joined = parts.join(' ');
    if (/should not exist/i.test(joined)) {
      return t('error.apiOutdated');
    }
    return parts.slice(0, 2).join('\n');
  } catch {
    return null;
  }
}
