import { reportApiFetchFailure, reportApiFetchSuccess } from '@taxima/shared';
import { Platform } from 'react-native';
import { getApiBaseUrl } from './config';
import { notifyDriverSessionRevoked, parseSessionRevokedMessage } from '../auth/sessionRevoked';

const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

let authToken: string | null = null;

export function setDriverAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;

  const controller = init?.signal ? null : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)
    : undefined;
  try {
    const res = await fetch(`${base}${p}`, {
      ...init,
      headers,
      signal: init?.signal ?? controller!.signal,
    });
    reportApiFetchSuccess();
    if (res.status === 401 && authToken) {
      const clone = res.clone();
      const text = await clone.text().catch(() => '');
      const revoked = parseSessionRevokedMessage(text);
      if (revoked) notifyDriverSessionRevoked(revoked);
    }
    return res;
  } catch (error) {
    reportApiFetchFailure(error);
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Expo 57 `fetch` 會把 FormData 序列化，不支援 RN 的 `{ uri }` 檔案欄位。
 * 本機相簿／相機上傳須走 XMLHttpRequest（RCTNetworking multipart）。
 */
function uploadFormViaXhr(url: string, form: FormData, requestHeaders: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => {
      xhr.abort();
      reject(new Error('上傳逾時，請稍後再試'));
    }, UPLOAD_TIMEOUT_MS);

    xhr.onload = () => {
      clearTimeout(timer);
      reportApiFetchSuccess();
      const bodyText = xhr.responseText ?? '';
      const status = xhr.status;
      const response = {
        ok: status >= 200 && status < 300,
        status,
        statusText: xhr.statusText ?? '',
        headers: new Headers(),
        url,
        redirected: false,
        type: 'basic',
        body: null,
        bodyUsed: false,
        clone() {
          return response;
        },
        arrayBuffer: async () => new TextEncoder().encode(bodyText).buffer,
        blob: async () => new Blob([bodyText]),
        formData: async () => {
          throw new Error('formData() not supported');
        },
        json: async () => JSON.parse(bodyText),
        text: async () => bodyText,
      };
      if (status === 401 && authToken) {
        const revoked = parseSessionRevokedMessage(bodyText);
        if (revoked) notifyDriverSessionRevoked(revoked);
      }
      resolve(response as Response);
    };

    xhr.onerror = () => {
      clearTimeout(timer);
      const err = new Error('網絡錯誤，請檢查連線後再試');
      reportApiFetchFailure(err);
      reject(err);
    };
    xhr.onabort = () => {
      clearTimeout(timer);
      reject(new Error('上傳已取消'));
    };

    xhr.open('POST', url);
    for (const [key, value] of Object.entries(requestHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(form);
  });
}

/** multipart（勿設 Content-Type，由 RN 自動帶 boundary） */
export async function apiUploadForm(path: string, form: FormData): Promise<Response> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  const requestHeaders: Record<string, string> = {};
  if (authToken) requestHeaders.Authorization = `Bearer ${authToken}`;

  if (Platform.OS === 'web') {
    const headers = new Headers(requestHeaders);
    const res = await fetch(url, { method: 'POST', body: form, headers });
    if (res.status === 401 && authToken) {
      const text = await res.clone().text().catch(() => '');
      const revoked = parseSessionRevokedMessage(text);
      if (revoked) notifyDriverSessionRevoked(revoked);
    }
    return res;
  }

  return uploadFormViaXhr(url, form, requestHeaders);
}
