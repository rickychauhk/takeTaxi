import { getApiBaseUrl } from './config';

export async function fetchTermsHtml(): Promise<string> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/public/terms/driver`);
  if (!res.ok) return '';
  const data = (await res.json()) as { html?: string };
  return data.html?.trim() ?? '';
}
