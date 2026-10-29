import {
  deployUnavailableUserMessage,
  reportApiFetchFailure,
  reportApiFetchSuccess,
} from '@taxima/shared';
import { readStoredPassengerSession } from '../auth/session';
import { getApiBaseUrl } from './config';

const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

let authToken: string | null = null;

export function setPassengerAuthToken(token: string | null) {
  authToken = token;
}

export function passengerApiErrorMessage(status: number, body: string, fallback?: string): string {
  return deployUnavailableUserMessage(status, body) ?? body.trim() ?? fallback ?? `HTTP ${status}`;
}

export type PassengerFetchOptions = {
  /** 落單／上傳等較慢請求可延長（毫秒） */
  timeoutMs?: number;
};

export async function passengerFetch(
  path: string,
  init?: RequestInit,
  options?: PassengerFetchOptions,
): Promise<Response> {
  let bearer = authToken;
  if (!bearer?.trim()) {
    const stored = await readStoredPassengerSession();
    bearer = stored?.token ?? null;
    if (bearer) setPassengerAuthToken(bearer);
  }

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (bearer?.trim()) headers.set('Authorization', `Bearer ${bearer.trim()}`);
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = init?.signal ? null : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  try {
    const res = await fetch(`${base}${p}`, {
      ...init,
      headers,
      signal: init?.signal ?? controller!.signal,
    });
    reportApiFetchSuccess();
    return res;
  } catch (error) {
    reportApiFetchFailure(error);
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
