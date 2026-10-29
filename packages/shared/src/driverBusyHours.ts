/** 星期一 = 1 … 星期日 = 7（以香港時間計） */
export type WeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7';

export type BusyTimeSlot = {
  start: string; // HH:mm
  end: string; // HH:mm，不含結束時刻
};

export type DriverBusyHoursConfig = {
  enabled: boolean;
  weekdays: Record<WeekdayKey, BusyTimeSlot[]>;
};

const WEEKDAY_KEYS: WeekdayKey[] = ['1', '2', '3', '4', '5', '6', '7'];

const HK_WEEKDAY_TO_KEY: Record<string, WeekdayKey> = {
  Monday: '1',
  Tuesday: '2',
  Wednesday: '3',
  Thursday: '4',
  Friday: '5',
  Saturday: '6',
  Sunday: '7',
};

export function emptyDriverBusyHoursConfig(): DriverBusyHoursConfig {
  return {
    enabled: true,
    weekdays: {
      '1': [],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
      '7': [],
    },
  };
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function normalizeSlot(raw: unknown): BusyTimeSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { start?: unknown; end?: unknown };
  if (typeof o.start !== 'string' || typeof o.end !== 'string') return null;
  const start = o.start.trim();
  const end = o.end.trim();
  const sm = parseHm(start);
  const em = parseHm(end);
  if (sm == null || em == null || sm >= em) return null;
  return { start, end };
}

/** 解析 CRM 儲存的 JSON；無效欄位會被忽略或回退預設 */
export function parseDriverBusyHoursConfig(raw: string | null | undefined): DriverBusyHoursConfig {
  const base = emptyDriverBusyHoursConfig();
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as {
      enabled?: unknown;
      weekdays?: Record<string, unknown>;
    };
    if (typeof parsed.enabled === 'boolean') base.enabled = parsed.enabled;
    if (parsed.weekdays && typeof parsed.weekdays === 'object') {
      for (const key of WEEKDAY_KEYS) {
        const list = parsed.weekdays[key];
        if (!Array.isArray(list)) continue;
        const slots: BusyTimeSlot[] = [];
        for (const item of list) {
          const slot = normalizeSlot(item);
          if (slot) slots.push(slot);
        }
        base.weekdays[key] = slots;
      }
    }
  } catch {
    /* keep defaults */
  }
  return base;
}

export function serializeDriverBusyHoursConfig(config: DriverBusyHoursConfig): string {
  const normalized = emptyDriverBusyHoursConfig();
  normalized.enabled = Boolean(config.enabled);
  for (const key of WEEKDAY_KEYS) {
    const list = config.weekdays[key] ?? [];
    normalized.weekdays[key] = list
      .map((s) => normalizeSlot(s))
      .filter((s): s is BusyTimeSlot => s != null);
  }
  return JSON.stringify(normalized);
}

/** 以香港時區解讀 `now` 的星期與當日分鐘數（0–1439） */
export function getHongKongClock(now: Date): { weekday: WeekdayKey; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  let weekdayLong = 'Monday';
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekdayLong = p.value;
    if (p.type === 'hour') hour = Number(p.value);
    if (p.type === 'minute') minute = Number(p.value);
  }
  const weekday = HK_WEEKDAY_TO_KEY[weekdayLong] ?? '1';
  return { weekday, minutesOfDay: hour * 60 + minute };
}

export function isBusyHourInHongKong(now: Date, config: DriverBusyHoursConfig): boolean {
  if (!config.enabled) return false;
  const { weekday, minutesOfDay } = getHongKongClock(now);
  const slots = config.weekdays[weekday] ?? [];
  for (const slot of slots) {
    const start = parseHm(slot.start);
    const end = parseHm(slot.end);
    if (start == null || end == null) continue;
    if (minutesOfDay >= start && minutesOfDay < end) return true;
  }
  return false;
}

/** 落單快照：接單扣減只用基本積分；繁忙時段獎賞由平台另發（唔計入扣減） */
export function computeDriverPointsAtOrderPlacement(input: {
  placedAt: Date;
  basePointsPerOrder: number;
  busyExtraPointsPerOrder: number;
  busyHours: DriverBusyHoursConfig;
}): { total: number; busySurcharge: number; isBusyHour: boolean } {
  const base = Math.max(0, Math.round(input.basePointsPerOrder));
  const extra = Math.max(0, Math.round(input.busyExtraPointsPerOrder));
  const isBusyHour = isBusyHourInHongKong(input.placedAt, input.busyHours);
  /** 沿用欄位名 busySurcharge：實為「繁忙時段平台獎賞」快照，非向司機加收 */
  const busySurcharge = isBusyHour ? extra : 0;
  return { total: base, busySurcharge, isBusyHour };
}

export const WEEKDAY_LABELS_ZH: Record<WeekdayKey, string> = {
  '1': '星期一',
  '2': '星期二',
  '3': '星期三',
  '4': '星期四',
  '5': '星期五',
  '6': '星期六',
  '7': '星期日',
};
