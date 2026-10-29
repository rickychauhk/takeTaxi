const CN_DIGIT: Record<string, string> = {
  零: '0',
  〇: '0',
  一: '1',
  壹: '1',
  二: '2',
  贰: '2',
  貳: '2',
  两: '2',
  兩: '2',
  三: '3',
  叁: '3',
  參: '3',
  四: '4',
  肆: '4',
  五: '5',
  伍: '5',
  六: '6',
  陆: '6',
  陸: '6',
  七: '7',
  柒: '7',
  八: '8',
  捌: '8',
  九: '9',
  玖: '9',
};

/** 語音辨識結果只保留數字（含中文數字讀法）。 */
export function voiceTranscriptToDigits(transcript: string): string {
  let out = '';
  for (const ch of transcript.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    const mapped = CN_DIGIT[ch];
    if (mapped) out += mapped;
  }
  return out;
}

export function sanitizePhoneDigitsInput(text: string): string {
  return text.replace(/\D/g, '');
}
