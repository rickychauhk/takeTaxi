import { useDriverForegroundGpsGuard } from '../hooks/useDriverForegroundGpsGuard';

/** 已登入司機 App：背景 → 前景 GPS 檢查（無 UI）。 */
export function DriverForegroundGpsGuard() {
  useDriverForegroundGpsGuard();
  return null;
}
