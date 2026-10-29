/** 地址是否含中日韓統漢字（用於判斷繁中地址） */
export function hasChineseAddressChars(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text.trim());
}

/** 以繁中為主（排除「285 Lockhart Rd 灣仔區 Wan Chai…」混英文） */
export function isChinesePrimaryAddress(text: string): boolean {
  const t = text.trim();
  if (!hasChineseAddressChars(t)) return false;
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (t.match(/[\u3400-\u9fff]/g) ?? []).length;
  if (cjk === 0) return false;
  if (latin >= 8 && cjk <= 6) return false;
  if (latin > cjk * 2) return false;
  return cjk >= 2;
}
