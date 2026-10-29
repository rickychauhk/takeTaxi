const REMEMBER_ENABLED_KEY = 'taxima_remember_login_phone_enabled';
const REMEMBER_PHONE_KEY = 'taxima_remember_login_phone';
const TOKEN_KEY = 'taxima_admin_token';
const ADMIN_KEY = 'taxima_admin';
const EXPIRES_KEY = 'taxima_admin_expires_at';
const DEVICE_ID_KEY = 'taxima_admin_device_id';

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** 略為提前判定過期，避免邊界時間刷新被誤清 */
const SESSION_EXPIRY_GRACE_MS = 60_000;

export function isJwtExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + SESSION_EXPIRY_GRACE_MS;
  } catch {
    return true;
  }
}

export function loadRememberPhone(): { remember: boolean; phone: string } {
  const remember = localStorage.getItem(REMEMBER_ENABLED_KEY) === '1';
  const phone = remember ? (localStorage.getItem(REMEMBER_PHONE_KEY) ?? '') : '';
  return { remember, phone };
}

export function saveRememberPhone(phoneInput: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(REMEMBER_ENABLED_KEY, '1');
    localStorage.setItem(REMEMBER_PHONE_KEY, phoneInput.trim());
  } else {
    localStorage.removeItem(REMEMBER_ENABLED_KEY);
    localStorage.removeItem(REMEMBER_PHONE_KEY);
  }
}

export function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function persistAdminSession(token: string, admin: unknown, expiresAt?: string | null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  if (expiresAt) localStorage.setItem(EXPIRES_KEY, expiresAt);
  else localStorage.removeItem(EXPIRES_KEY);
}

export function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (expiresAt && Date.parse(expiresAt) <= Date.now() + SESSION_EXPIRY_GRACE_MS) {
    clearAdminSession();
    return null;
  }
  if (isJwtExpired(token)) {
    clearAdminSession();
    return null;
  }
  return token;
}
