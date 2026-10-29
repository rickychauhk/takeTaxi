import { formatHongKongPhoneDisplay } from '@taxima/shared';

type TelUriOptions = { /** iOS 先顯示撥號確認 */ prompt?: boolean };

/** 將 CRM／DB 電話轉成 `tel:` / `telprompt:` URI（香港 8 位自動加 +852） */
export function phoneToTelUri(raw: string, opts?: TelUriOptions): string {
  const scheme = opts?.prompt ? 'telprompt' : 'tel';
  const trimmed = raw.trim();
  if (!trimmed) return `${scheme}:`;
  if (trimmed.startsWith('+')) {
    return `${scheme}:${trimmed.replace(/[\s-]/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8 && /^[569]/.test(digits)) {
    return `${scheme}:+852${digits}`;
  }
  if (digits.startsWith('852') && digits.length >= 11) {
    return `${scheme}:+${digits}`;
  }
  return `${scheme}:${digits}`;
}

/** 乘客 UI 顯示用（本地 8 位，不含 +852） */
export function formatPhoneDisplay(raw: string): string {
  return formatHongKongPhoneDisplay(raw);
}
