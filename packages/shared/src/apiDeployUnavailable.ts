/** App 顯示：部署／維護期間 API 暫不可用 */
export const API_DEPLOY_UNAVAILABLE_MESSAGE = '系統更新中，請稍後重試';

export function deployUnavailableUserMessage(status: number, body?: string | null): string | null {
  if (status !== 502 && status !== 503 && status !== 504) return null;
  const text = body?.trim() ?? '';
  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as { maintenance?: boolean; message?: string };
      if (data.maintenance === true) return API_DEPLOY_UNAVAILABLE_MESSAGE;
      const msg = data.message?.trim();
      if (msg && (msg.includes('維護') || msg.includes('更新'))) return API_DEPLOY_UNAVAILABLE_MESSAGE;
    } catch {
      /* non-json 503 */
    }
  }
  return API_DEPLOY_UNAVAILABLE_MESSAGE;
}
