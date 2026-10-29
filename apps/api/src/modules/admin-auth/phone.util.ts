import { BadRequestException } from '@nestjs/common';
import {
  formatHongKongPhoneValidationMessage,
  validateHongKongLocalPhone,
} from '@taxima/shared';

export function normalizePhoneE164(input: string): string {
  const v = validateHongKongLocalPhone(input);
  if (!v.ok) {
    throw new BadRequestException(formatHongKongPhoneValidationMessage(v));
  }
  return `+852${v.local8}`;
}

/** Match drivers.phone stored as 8-digit HK, E.164, etc. */
export function phoneLookupVariants(input: string): string[] {
  const e164 = normalizePhoneE164(input);
  const digits = input.replace(/\D/g, '');
  const hkLocal = e164.startsWith('+852') ? e164.slice(4) : digits.length === 8 ? digits : '';
  const out = new Set<string>([e164, digits]);
  if (hkLocal) out.add(hkLocal);
  if (digits.startsWith('852') && digits.length >= 11) out.add(digits.slice(3));
  return [...out];
}
