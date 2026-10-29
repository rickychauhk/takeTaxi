/** 香港身份證／駕駛執照號碼（與 HKID 相同格式，如 S839494(1)） */

function letterValue(c: string): number {
  return c.charCodeAt(0) - 55;
}

function expectedCheckDigit(prefix: string, sixDigits: string): string {
  let sum = 0;
  if (prefix.length === 2) {
    sum += letterValue(prefix[0]!) * 9 + letterValue(prefix[1]!) * 8;
  } else {
    sum += 36 * 9 + letterValue(prefix[0]!) * 8;
  }
  for (let i = 0; i < 6; i++) {
    sum += Number(sixDigits[i]) * (7 - i);
  }
  const remainder = sum % 11;
  if (remainder === 0) return '0';
  if (remainder === 1) return 'A';
  return String(11 - remainder);
}

type ParsedFormat = {
  prefix: string;
  digits: string;
  check: string;
  normalized: string;
};

export type HongKongIdentityNumberParseResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: 'empty' | 'format' | 'checksum' };

function parseHongKongIdentityFormat(input: string):
  | { ok: true; value: ParsedFormat }
  | { ok: false; reason: 'empty' | 'format' } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const s = trimmed.toUpperCase().replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')');

  let prefix: string;
  let digits: string;
  let check: string;

  const withParens = s.match(/^([A-Z]{1,2})(\d{6})\(([0-9A-Z])\)$/);
  if (withParens) {
    prefix = withParens[1]!;
    digits = withParens[2]!;
    check = withParens[3]!;
  } else {
    const compact = s.match(/^([A-Z]{1,2})(\d{6})([0-9A-Z])$/);
    if (!compact) return { ok: false, reason: 'format' };
    prefix = compact[1]!;
    digits = compact[2]!;
    check = compact[3]!;
  }

  return {
    ok: true,
    value: {
      prefix,
      digits,
      check,
      normalized: `${prefix}${digits}(${check})`,
    },
  };
}

/**
 * 司機執照號碼：只驗格式（主號 + 括號內 0–9 / A–Z），不驗 HKID 校驗算法。
 * 避免括號內合法字元被誤判（校驗碼僅 0–9 或 A 才符合 HKID 算法）。
 */
export function parseHongKongDriverLicenseNumber(input: string): HongKongIdentityNumberParseResult {
  const parsed = parseHongKongIdentityFormat(input);
  if (!parsed.ok) return parsed;
  return { ok: true, normalized: parsed.value.normalized };
}

/** 解析並驗證 HKID 校驗碼；成功時 normalized 為大寫格式 AB123456(7) */
export function parseHongKongIdentityNumber(input: string): HongKongIdentityNumberParseResult {
  const parsed = parseHongKongIdentityFormat(input);
  if (!parsed.ok) return parsed;
  const { prefix, digits, check, normalized } = parsed.value;
  if (expectedCheckDigit(prefix, digits) !== check) {
    return { ok: false, reason: 'checksum' };
  }
  return { ok: true, normalized };
}

export function formatHongKongIdentityNumberError(
  reason: 'empty' | 'format' | 'checksum',
  label = '執照號碼',
): string {
  if (reason === 'empty') return `請輸入${label}`;
  if (reason === 'checksum') return `${label}驗證碼不正確，請檢查括號內數字或英文字母`;
  return `${label}格式不正確，請輸入香港身份證格式，例如 S123456 及括號內驗證碼`;
}

export function validateHongKongIdentityNumberField(label: string, input: string): string | null {
  const parsed = parseHongKongIdentityNumber(input);
  if (parsed.ok) return null;
  return formatHongKongIdentityNumberError(parsed.reason, label);
}

/** 主號（如 S123456）+ 括號內驗證碼（0–9 或 A–Z）合併後驗證 */
export function combineHongKongIdentityNumber(mainPart: string, checkDigit: string): string {
  const main = mainPart.trim().toUpperCase().replace(/\s/g, '');
  const check = checkDigit.trim().toUpperCase().replace(/[()（）\s]/g, '');
  if (!check) return main;
  return `${main}(${check})`;
}

export function parseHongKongIdentityNumberParts(
  mainPart: string,
  checkDigit: string,
): HongKongIdentityNumberParseResult {
  return parseHongKongDriverLicenseNumber(combineHongKongIdentityNumber(mainPart, checkDigit));
}

export function validateHongKongIdentityNumberPartsField(
  label: string,
  mainPart: string,
  checkDigit: string,
): string | null {
  if (!mainPart.trim()) {
    return `${label}：請輸入英文字母及 6 位數字（例如 S123456）`;
  }
  if (!checkDigit.trim()) {
    return `${label}：請輸入括號內驗證碼（數字或英文字母）`;
  }
  const main = mainPart.trim().toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{1,2}\d{6}$/.test(main)) {
    return `${label}：主號須為 1–2 個英文字母加 6 位數字，例如 S123456`;
  }
  const check = checkDigit.trim().toUpperCase().replace(/[()（）\s]/g, '');
  if (!/^[0-9A-Z]$/.test(check)) {
    return `${label}：驗證碼須為 1 個數字或英文字母（A–Z）`;
  }
  const parsed = parseHongKongDriverLicenseNumber(combineHongKongIdentityNumber(mainPart, checkDigit));
  if (parsed.ok) return null;
  return formatHongKongIdentityNumberError(parsed.reason, label);
}
