export type ParsedTripVoice = { pickup?: string; dropoff?: string };

/** Parse utterances like「旺角 去 荃灣」into pickup / dropoff labels. */
export function parseTripVoiceUtterance(text: string): ParsedTripVoice {
  const raw = text.trim();
  if (!raw) return {};

  const rules: RegExp[] = [
    /^由\s*(.+?)\s*去\s*(.+)$/u,
    /^從\s*(.+?)\s*去\s*(.+)$/u,
    /^从\s*(.+?)\s*去\s*(.+)$/u,
    /^(.+?)\s*去\s*(.+)$/u,
    /^(.+?)\s*到\s*(.+)$/u,
    /^(.+?)\s*至\s*(.+)$/u,
    /^(.+?)\s*-\s*(.+)$/u,
    /^(.+?)\s+to\s+(.+)$/iu,
  ];

  for (const re of rules) {
    const m = raw.match(re);
    if (!m) continue;
    const pickup = m[1]?.trim();
    const dropoff = m[2]?.trim();
    if (pickup && dropoff) return { pickup, dropoff };
  }

  return {};
}
