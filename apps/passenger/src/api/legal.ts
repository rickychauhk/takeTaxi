import { getApiBaseUrl } from './config';

export async function fetchTermsHtml(app: 'passenger' | 'driver'): Promise<string> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/public/terms/${app}`);
  if (!res.ok) return '';
  const data = (await res.json()) as { html?: string };
  return data.html?.trim() ?? '';
}
