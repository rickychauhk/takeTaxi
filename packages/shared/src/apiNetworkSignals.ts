type Listener = () => void;

/** NetInfo：Android 常誤報 isInternetReachable=false；僅 isConnected===false 視為無網絡 */
export function netInfoDeviceAppearsOffline(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return state.isConnected === false;
}

let apiReachabilityDegraded = false;
const listeners = new Set<Listener>();

export function subscribeApiNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiNetworkDegraded(): boolean {
  return apiReachabilityDegraded;
}

/** fetch / XHR 無法連線、逾時等 */
export function isFetchNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    const m = error.message;
    if (/network request failed/i.test(m)) return true;
    if (/網絡|連線|Network/i.test(m)) return true;
  }
  return false;
}

export function reportApiFetchSuccess(): void {
  if (!apiReachabilityDegraded) return;
  apiReachabilityDegraded = false;
  for (const l of listeners) l();
}

export function reportApiFetchFailure(error: unknown): void {
  if (!isFetchNetworkError(error)) return;
  if (apiReachabilityDegraded) return;
  apiReachabilityDegraded = true;
  for (const l of listeners) l();
}

export function clearApiNetworkDegraded(): void {
  reportApiFetchSuccess();
}

export function markApiNetworkDegraded(): void {
  if (apiReachabilityDegraded) return;
  apiReachabilityDegraded = true;
  for (const l of listeners) l();
}
