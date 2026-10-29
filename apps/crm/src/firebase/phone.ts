import {
  formatHongKongPhoneValidationMessage,
  validateHongKongLocalPhone,
} from '@taxima/shared';

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

/** CRM 列表／詳情顯示：去掉 +852，只顯示 8 位本地號碼 */
export function formatHongKongPhoneDisplay(phone: string | null | undefined): string {
  if (!phone?.trim()) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('852')) return digits.slice(3);
  if (digits.length === 8) return digits;
  if (phone.startsWith('+852')) return phone.slice(4);
  return phone.replace(/^\+852/, '');
}

function antdHongKongPhoneValidator(value: string) {
  const v = validateHongKongLocalPhone(value ?? '');
  if (v.ok) return Promise.resolve();
  return Promise.reject(new Error(formatHongKongPhoneValidationMessage(v)));
}

/** Ant Design Form：香港 8 位電話（必填） */
export function antdHongKongPhoneRules(label = '電話') {
  return [
    { required: true, message: `請輸入${label}` },
    { validator: (_: unknown, value: string) => antdHongKongPhoneValidator(value) },
  ] as const;
}

/** 有填才驗 8 位（修改乘客等可留空） */
export function antdHongKongPhoneRulesOptional() {
  return [
    {
      validator: (_: unknown, value: string) => {
        const s = (value ?? '').trim();
        if (!s) return Promise.resolve();
        return antdHongKongPhoneValidator(s);
      },
    },
  ] as const;
}
