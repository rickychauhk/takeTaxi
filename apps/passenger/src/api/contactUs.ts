import { getApiBaseUrl } from './config';

export async function fetchContactUsHtml(): Promise<string> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/public/contact-us`);
  if (!res.ok) return '';
  const data = (await res.json()) as { html?: string };
  return data.html?.trim() ?? '';
}
