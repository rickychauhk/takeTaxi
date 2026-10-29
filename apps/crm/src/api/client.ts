import axios from 'axios';
import { message } from 'antd';
import { readStoredToken } from '../auth/session';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api = axios.create({ baseURL });

/** 刷新頁面前先還原 Bearer，避免首屏請求未帶 token 被 401 清 session */
const bootToken = readStoredToken();
if (bootToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401) {
      const hadBearer = Boolean(
        err.config?.headers?.Authorization ?? err.config?.headers?.authorization,
      );
      const stored = readStoredToken();
      if (!hadBearer && stored) {
        setAuthToken(stored);
        return Promise.reject(err);
      }
      const msg = err.response?.data?.message;
      message.error(typeof msg === 'string' ? msg : '登入已過期，請重新登入');
      onUnauthorized?.();
    } else if (status === 403) {
      message.error('沒有權限執行此操作');
    } else if (err.response?.data?.message) {
      message.error(String(err.response.data.message));
    } else if (!err.response) {
      message.error('無法連線 API，請檢查網路');
    }
    return Promise.reject(err);
  },
);

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
