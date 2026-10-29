import { NativeModules, Platform } from 'react-native';

type IncomingOrderWindowNative = {
  activateIncomingOrderDisplay: () => void;
  deactivateIncomingOrderDisplay: () => void;
  postFullScreenNewOrderAlert: (orderId: string, title: string, body: string) => void;
  bringMainActivityToFront: (orderId: string | null) => void;
  consumeLaunchOrderId: () => Promise<string | null>;
};

const mod = NativeModules.IncomingOrderWindow as IncomingOrderWindowNative | undefined;

export function activateAndroidIncomingOrderDisplay(): void {
  if (Platform.OS !== 'android') return;
  mod?.activateIncomingOrderDisplay?.();
}

export function deactivateAndroidIncomingOrderDisplay(): void {
  if (Platform.OS !== 'android') return;
  mod?.deactivateIncomingOrderDisplay?.();
}

export function postAndroidFullScreenNewOrderAlert(
  orderId: string,
  title: string,
  body: string,
): void {
  if (Platform.OS !== 'android' || !orderId.trim()) return;
  mod?.postFullScreenNewOrderAlert?.(orderId.trim(), title, body);
}

export function bringAndroidMainActivityToFront(orderId: string | null): void {
  if (Platform.OS !== 'android') return;
  mod?.bringMainActivityToFront?.(orderId);
}

export async function consumeAndroidLaunchOrderId(): Promise<string | null> {
  if (Platform.OS !== 'android' || !mod?.consumeLaunchOrderId) return null;
  const id = await mod.consumeLaunchOrderId();
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}
