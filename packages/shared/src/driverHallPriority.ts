export const DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_SETTING_KEY =
  'driver_hall_priority_preview_seconds';

export const DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT = 2;
export const DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX = 60;

export function parseDriverHallPriorityPreviewSeconds(raw: unknown): number {
  const n = Math.round(Number(String(raw ?? '').trim() || DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT));
  if (!Number.isFinite(n) || n < 0) return DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_DEFAULT;
  return Math.min(DRIVER_HALL_PRIORITY_PREVIEW_SECONDS_MAX, n);
}

export type DriverHallVisibilityContext = {
  driverTier: 'admin' | 'partner' | 'public';
  isInternalMember?: boolean;
};

/** 管理員級或 CRM「自己人」：可較公海司機提早見到大廳柯打 */
export function driverHasHallPriorityPreview(ctx: DriverHallVisibilityContext): boolean {
  return ctx.driverTier === 'admin' || Boolean(ctx.isInternalMember);
}
