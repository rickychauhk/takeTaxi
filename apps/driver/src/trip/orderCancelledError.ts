/** API 400：柯打已被取消，無法再更新狀態 */
export function isOrderCancelledConflictError(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.includes('cancelled')) return false;
  return (
    m.includes('無法由') ||
    m.includes('bad request') ||
    m.includes('en_route') ||
    m.includes('in_trip') ||
    m.includes('completed')
  );
}
