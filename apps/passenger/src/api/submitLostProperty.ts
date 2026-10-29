import { readStoredPassengerSession } from '../auth/session';
import { getApiBaseUrl } from './config';
import { messageFromPassengerApiErrorBody } from './parsePassengerApiError';
import { passengerApiErrorMessage, setPassengerAuthToken } from './passengerClient';

export type LostPropertyImageUpload = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

export type SubmitLostPropertyInput = {
  itemName: string;
  description: string;
  lostAt: Date;
  contactPhone: string;
  contactName: string;
  images: LostPropertyImageUpload[];
};

export async function submitLostPropertyRequest(input: SubmitLostPropertyInput): Promise<void> {
  const stored = await readStoredPassengerSession();
  const token = stored?.token;
  if (!token?.trim()) throw new Error('請先登入');
  setPassengerAuthToken(token);

  const form = new FormData();
  form.append('itemName', input.itemName.trim());
  form.append('description', input.description.trim());
  form.append('lostAt', input.lostAt.toISOString());
  form.append('contactPhone', input.contactPhone.trim());
  form.append('contactName', input.contactName.trim());

  for (const img of input.images) {
    const fallbackName = `photo-${Date.now()}.jpg`;
    const name = img.name?.trim() || img.uri.split('/').pop() || fallbackName;
    const type = img.mimeType?.trim() || 'image/jpeg';
    form.append('images', {
      uri: img.uri,
      name,
      type,
    } as unknown as Blob);
  }

  const base = getApiBaseUrl().replace(/\/$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch(`${base}/passenger/lost-property`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    const parsed = messageFromPassengerApiErrorBody(text);
    throw new Error(parsed ?? passengerApiErrorMessage(res.status, text));
  }
}
