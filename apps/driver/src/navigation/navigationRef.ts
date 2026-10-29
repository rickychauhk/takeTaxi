import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingPushOrderId: string | null = null;

export function queuePushOrderNavigation(orderId: string) {
  const id = orderId.trim();
  if (!id) return;
  pendingPushOrderId = id;
  tryOpenPushOrder();
}

export function consumePendingPushOrderId(): string | null {
  const id = pendingPushOrderId;
  pendingPushOrderId = null;
  return id;
}

export function tryOpenPushOrder() {
  const orderId = pendingPushOrderId;
  if (!orderId || !navigationRef.isReady()) return;
  pendingPushOrderId = null;
  navigationRef.navigate('MainTabs', {
    screen: 'Dashboard',
    params: { focusOrderId: orderId },
  });
}
