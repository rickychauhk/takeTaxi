import { useEffect, useState } from 'react';

/** 累計分鐘 + 目前上線中時段（每 15s 刷新） */
export function useTodayOnlineMinutesDisplay(
  accumulatedMinutes: number,
  online: boolean,
  onlineSince: number | null,
): number {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!online || !onlineSince) return;
    const id = setInterval(() => bump((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [online, onlineSince]);

  const live =
    online && onlineSince != null
      ? Math.max(0, (Date.now() - onlineSince) / 60_000)
      : 0;
  return Math.max(0, Math.round(accumulatedMinutes + live));
}
