import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'taxima_driver_online_minutes_today_v1';

type Stored = { dateHk: string; minutes: number };

export function hkDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(now);
}

export async function readTodayOnlineMinutesAccumulated(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  const today = hkDateKey();
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.dateHk !== today) return 0;
    const n = Number(parsed.minutes);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

export async function addTodayOnlineMinutes(deltaMinutes: number): Promise<number> {
  const add = Math.max(0, Math.round(deltaMinutes));
  if (add <= 0) return readTodayOnlineMinutesAccumulated();
  const today = hkDateKey();
  const base = await readTodayOnlineMinutesAccumulated();
  const next = base + add;
  await AsyncStorage.setItem(KEY, JSON.stringify({ dateHk: today, minutes: next } satisfies Stored));
  return next;
}
