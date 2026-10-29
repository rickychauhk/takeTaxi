/** Normalize HK mobile to E.164 (+852xxxxxxxx) */
export function normalizePhoneE164(input: string): string {
  const v = validateHongKongLocalPhone(input);
  if (!v.ok) {
    throw new Error(formatHongKongPhoneValidationMessage(v));
  }
  return `+852${v.local8}`;
}

export type HongKongPhoneValidation =
  | { ok: true; local8: string }
  | { ok: false; kind: 'empty' | 'too_short' | 'too_long'; digitCount: number };

/** 香港本地 8 位數字（可含 +852 / 852 前綴） */
export function validateHongKongLocalPhone(input: string): HongKongPhoneValidation {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, kind: 'empty', digitCount: 0 };
  const raw = trimmed.replace(/\D/g, '');
  if (!raw) return { ok: false, kind: 'empty', digitCount: 0 };
  const local = raw.startsWith('852') ? raw.slice(3) : raw;
  if (local.length < 8) return { ok: false, kind: 'too_short', digitCount: local.length };
  if (local.length > 8) return { ok: false, kind: 'too_long', digitCount: local.length };
  return { ok: true, local8: local };
}

export function isHongKong8DigitPhone(input: string): boolean {
  return validateHongKongLocalPhone(input).ok;
}

/** TextInput／記憶號碼：只留香港 8 位本地數字（不含 +852） */
export function formatHongKongPhoneInputValue(input: string): string {
  const v = validateHongKongLocalPhone(input);
  if (v.ok) return v.local8;
  const digits = input.trim().replace(/\D/g, '');
  if (digits.startsWith('852') && digits.length >= 11) return digits.slice(3, 11);
  return digits.slice(0, 8);
}

/** 乘客／司機 App UI 顯示：本地 8 位「XXXX XXXX」，不含國碼 */
export function formatHongKongPhoneDisplay(input: string): string {
  const local = formatHongKongPhoneInputValue(input);
  if (local.length === 8) return `${local.slice(0, 4)} ${local.slice(4)}`;
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\+852\s?/i, '').trim();
}

export function formatHongKongPhoneValidationMessage(
  result: Extract<HongKongPhoneValidation, { ok: false }>,
  lang: 'zh-Hant' | 'en' = 'zh-Hant',
): string {
  if (result.kind === 'empty') {
    return lang === 'en' ? 'Please enter a phone number.' : '請輸入電話號碼';
  }
  if (result.kind === 'too_short') {
    const n = result.digitCount;
    return lang === 'en'
      ? `Phone number must be exactly 8 digits (${n} entered, ${8 - n} too few).`
      : `電話須為 8 位數字（目前 ${n} 位，少了 ${8 - n} 位）`;
  }
  const n = result.digitCount;
  return lang === 'en'
    ? `Phone number must be exactly 8 digits (${n} entered, ${n - 8} too many).`
    : `電話須為 8 位數字（目前 ${n} 位，多了 ${n - 8} 位）`;
}
