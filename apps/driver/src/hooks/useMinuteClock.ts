import { useEffect, useState } from 'react';

/** 每 30 秒更新，供預約「開始接客」時間窗按鈕狀態 */
export function useMinuteClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
