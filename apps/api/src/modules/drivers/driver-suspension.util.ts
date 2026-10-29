import type { DriverEntity } from './driver.entity';

export const DRIVER_SUSPENSION_MESSAGE = '帳戶已被管理員停用，暫不可接柯打、射柯打或上線接單';

export function isDriverSuspended(driver: Pick<DriverEntity, 'suspendedPermanent' | 'suspendedUntil'>): boolean {
  if (Boolean(driver.suspendedPermanent)) return true;
  const until = driver.suspendedUntil;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export function suspensionEndsAtFromDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
