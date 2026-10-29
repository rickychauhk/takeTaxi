/** 後台顯示用，不可還原完整金鑰 */
export function maskGeminiApiKeyForDisplay(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}${'•'.repeat(Math.min(12, t.length - 8))}${t.slice(-4)}`;
}
