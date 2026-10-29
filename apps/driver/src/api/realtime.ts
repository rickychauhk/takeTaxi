import { getApiBaseUrl } from './config';

/** Socket.io 連 API 主機（唔含 /api/v1） */
export function getRealtimeOrigin(): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) {
    return base.slice(0, -'/api/v1'.length);
  }
  try {
    const u = new URL(base);
    return u.origin;
  } catch {
    return base;
  }
}
