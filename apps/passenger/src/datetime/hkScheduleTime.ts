const HK_TZ = 'Asia/Hong_Kong';
export const SCHEDULE_MINUTE_STEPS = [0, 15, 30, 45] as const;
export const MIN_SCHEDULE_LEAD_MS = 20 * 60 * 1000;

export type ScheduleDayOffset = 0 | 1;

export type ScheduleParts = {
  dayOffset: ScheduleDayOffset;
  hour: number;
  minute: number;
};

function hkDateParts(d: Date): { ymd: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  return { ymd, hour: Number(get('hour')), minute: Number(get('minute')) };
}

export function hkYmdForDayOffset(dayOffset: ScheduleDayOffset): string {
  const base = new Date(Date.now() + dayOffset * 86_400_000);
  return hkDateParts(base).ymd;
}

function roundUpToQuarter(minute: number): number {
  const next = SCHEDULE_MINUTE_STEPS.find((m) => m >= minute) ?? 0;
  return next;
}

export function defaultScheduleParts(): ScheduleParts {
  const target = new Date(Date.now() + MIN_SCHEDULE_LEAD_MS);
  let { ymd, hour, minute } = hkDateParts(target);
  let totalMin = hour * 60 + minute;
  totalMin = Math.ceil(totalMin / 15) * 15;
  if (totalMin >= 24 * 60) {
    totalMin -= 24 * 60;
    ymd = hkYmdForDayOffset(1);
  }
  hour = Math.floor(totalMin / 60);
  minute = totalMin % 60;
  const todayYmd = hkYmdForDayOffset(0);
  const dayOffset: ScheduleDayOffset = ymd === todayYmd ? 0 : 1;
  return { dayOffset, hour, minute };
}

export function schedulePartsToIso(parts: ScheduleParts): string {
  const ymd = hkYmdForDayOffset(parts.dayOffset);
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:00+08:00`;
}

export function schedulePartsFromIso(iso: string): ScheduleParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const { ymd, hour, minute } = hkDateParts(d);
  const today = hkYmdForDayOffset(0);
  const tomorrow = hkYmdForDayOffset(1);
  let dayOffset: ScheduleDayOffset = 0;
  if (ymd === tomorrow) dayOffset = 1;
  else if (ymd !== today) return null;
  const snapped = SCHEDULE_MINUTE_STEPS.includes(minute as (typeof SCHEDULE_MINUTE_STEPS)[number])
    ? minute
    : roundUpToQuarter(minute);
  return { dayOffset, hour, minute: snapped };
}

export function isScheduleInFuture(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now() + 5 * 60 * 1000;
}

export function formatScheduleDisplay(iso: string, locale: 'zh-Hant' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dateFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-HK', {
    timeZone: HK_TZ,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return dateFmt.format(d);
}
