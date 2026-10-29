import {
  formatHongKongPhoneValidationMessage,
  isHongKong8DigitPhone,
  validateHongKongLocalPhone,
} from '@taxima/shared';

export { isHongKong8DigitPhone, formatHongKongPhoneValidationMessage, validateHongKongLocalPhone };

export function toE164HongKong(input: string): string {
  const v = validateHongKongLocalPhone(input);
  if (v.ok) return `+852${v.local8}`;
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('852') && digits.length >= 11) return `+${digits}`;
  if (digits.length === 8) return `+852${digits}`;
  return `+${digits}`;
}

export function validateHongKongPhoneInput(input: string): string | null {
  const v = validateHongKongLocalPhone(input);
  if (v.ok) return null;
  return formatHongKongPhoneValidationMessage(v, 'zh-Hant');
}

export function validateHongKongPhoneField(label: string, input: string): string | null {
  if (!input.trim()) return `請輸入${label}`;
  const err = validateHongKongPhoneInput(input);
  if (!err) return null;
  if (err === '請輸入電話號碼') return `請輸入${label}`;
  return `${label}：${err}`;
}
