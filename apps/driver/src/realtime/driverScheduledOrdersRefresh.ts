type Listener = () => void;

const listeners = new Set<Listener>();

/** 大廳「接受預約」等操作後，通知預約 Tab 立即重新拉列表 */
export function requestScheduledOrdersRefresh() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeScheduledOrdersRefresh(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
