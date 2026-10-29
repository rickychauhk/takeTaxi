import { getApiBaseUrl } from '../api/config';

const PING_TIMEOUT_MS = 8_000;

export async function pingApiHealth(): Promise<boolean> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
