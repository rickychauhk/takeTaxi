import { AppState } from 'react-native';

let hallFocused = false;
const listeners = new Set<() => void>();

function notifyHallFocusListeners(): void {
  listeners.forEach((fn) => fn());
}

/** 大廳（Dashboard）Tab 是否為前景畫面 */
export function setDriverHallFocused(focused: boolean): void {
  if (hallFocused === focused) return;
  hallFocused = focused;
  notifyHallFocusListeners();
}

export function subscribeDriverHallFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDriverHallFocused(): boolean {
  return hallFocused;
}

/** App 前景：不彈全屏接單（大廳仍更新列表；背景 Android 用全屏通知） */
export function shouldSuppressHallNewOrderModal(): boolean {
  return AppState.currentState === 'active';
}
