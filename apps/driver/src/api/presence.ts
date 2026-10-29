import { apiFetch } from './client';

export async function postDriverPresence(online: boolean): Promise<void> {
  const res = await apiFetch('/driver/auth/presence', {
    method: 'POST',
    body: JSON.stringify({ online }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
