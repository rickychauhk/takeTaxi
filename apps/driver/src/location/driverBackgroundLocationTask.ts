import Constants from 'expo-constants';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { readDriverOnline, readStoredSession } from '../auth/session';

export const DRIVER_BG_LOCATION_TASK = 'taxima-driver-bg-location';

TaskManager.defineTask(DRIVER_BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const online = await readDriverOnline();
  if (!online) return;
  const session = await readStoredSession();
  if (!session) return;

  const locations = (data as { locations?: Location.LocationObject[] }).locations;
  const loc = locations?.[0];
  if (!loc) return;

  const lat = loc.coords.latitude;
  const lng = loc.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const base = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof base !== 'string' || !base.trim()) return;

  try {
    await fetch(`${base.replace(/\/$/, '')}/realtime/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        userId: session.driver.id,
        role: 'driver',
        lat,
        lng,
      }),
    });
  } catch {
    /* 背景上報失敗，下一輪重試 */
  }
});
