import { API_DEPLOY_UNAVAILABLE_MESSAGE, deployUnavailableUserMessage } from '@taxima/shared';

/** NestJS / API 錯誤 body → 司機可讀訊息 */
export function messageFromDriverApiErrorBody(body: string, httpStatus?: number): string | null {
  const deploy = httpStatus != null ? deployUnavailableUserMessage(httpStatus, body) : null;
  if (deploy) return deploy;

  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return trimmed.length > 0 && trimmed.length < 400 ? trimmed : null;
  try {
    const data = JSON.parse(trimmed) as { maintenance?: boolean; message?: string | string[] };
    if (data.maintenance === true) return API_DEPLOY_UNAVAILABLE_MESSAGE;
    const raw = data.message;
    const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (parts.length === 0) return null;
    return parts.slice(0, 3).join('\n');
  } catch {
    return null;
  }
}

export function formatDriverApiError(
  body: string,
  fallback = '請稍後再試',
  httpStatus?: number,
): string {
  return messageFromDriverApiErrorBody(body, httpStatus) ?? fallback;
}

export function driverHttpErrorMessage(status: number, body: string): string {
  return formatDriverApiError(body, `HTTP ${status}`, status);
}

/** 接單失敗：業務提示用「提示」標題，其餘用「無法接單」 */
export function acceptOrderAlertFromError(error: unknown): {
  title: string;
  message: string;
  /** 應關閉新柯打彈窗（已取消／已被接等） */
  dismissAlert: boolean;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const message = messageFromDriverApiErrorBody(raw) ?? (raw.length < 400 ? raw : '接單失敗，請稍後再試');
  if (message.includes('乘客已取消')) {
    return { title: '乘客已取消', message: '乘客已取消此柯打。', dismissAlert: true };
  }
  if (message.includes('後台已取消')) {
    return { title: '柯打已取消', message: '後台已取消此柯打。', dismissAlert: true };
  }
  if (message.includes('此柯打已取消')) {
    return { title: '柯打已取消', message, dismissAlert: true };
  }
  if (message.includes('已被其他司機接單') || message.includes('已有其他司機接')) {
    return { title: '未能接單', message: '已被其他司機接單。', dismissAlert: true };
  }
  if (message.includes('已被接或已結束') || message.includes('此柯打已結束')) {
    return { title: '未能接單', message, dismissAlert: true };
  }
  const hintPhrases = ['不可接自己發出的射柯打', '積分不足', '尚未通過審批', '司機不存在'];
  const isHint = hintPhrases.some((p) => message.includes(p));
  return {
    title: isHint ? '提示' : '無法接單',
    message,
    dismissAlert: false,
  };
}
