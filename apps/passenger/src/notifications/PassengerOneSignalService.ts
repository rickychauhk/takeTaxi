import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, NativeModules } from 'react-native';
import { appendPassengerPushInbox } from '../storage/passengerPushInbox';
import { isPassengerOneSignalEnabled } from './passengerOneSignalPlatform';
import { requestOpenPassengerTripChat } from './passengerTripChatOpen';

type OneSignalModule = typeof import('react-native-onesignal');

const INTEGRATION_DIALOG_KEY = 'onesignal_integration_dialog_shown_v1';

let initialized = false;
let integrationDialogShownThisSession = false;
let pendingExternalUserId: string | null = null;

function flushPendingLogin(): void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized || !pendingExternalUserId?.trim()) return;
  sdk.OneSignal.login(pendingExternalUserId.trim());
  pendingExternalUserId = null;
}
function loadOneSignal(): OneSignalModule | null {
  if (!isNativeLinked()) return null;
  try {
    return require('react-native-onesignal') as OneSignalModule;
  } catch {
    return null;
  }
}

export function resolveOneSignalAppId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.oneSignalAppId;
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

export function isNativeLinked(): boolean {
  const mods = NativeModules as Record<string, unknown>;
  return Boolean(mods.OneSignal ?? mods.RNOneSignal);
}

function isRegisteredSubscriptionId(subscriptionId: string | null | undefined): boolean {
  return !!subscriptionId && !subscriptionId.startsWith('local-');
}

function showIntegrationCompleteDialog(): void {
  const sdk = loadOneSignal();
  if (!sdk) return;
  Alert.alert(
    'Your OneSignal SDK integration is complete!',
    'You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.',
    [
      {
        text: 'Got it',
        onPress: () => {
          void sdk.OneSignal.Notifications.requestPermission(true);
        },
      },
    ],
    { cancelable: false },
  );
}

async function maybeShowIntegrationCompleteDialog(
  subscriptionId: string | null | undefined,
): Promise<void> {
  if (!isRegisteredSubscriptionId(subscriptionId)) return;
  if (integrationDialogShownThisSession) return;
  const persisted = await AsyncStorage.getItem(INTEGRATION_DIALOG_KEY);
  if (persisted === '1') return;

  integrationDialogShownThisSession = true;
  await AsyncStorage.setItem(INTEGRATION_DIALOG_KEY, '1');
  showIntegrationCompleteDialog();
}

/** Register observer; retain `listenerRef` from the caller (OneSignal holds weak refs). */
export function attachPushSubscriptionVerification(listenerRef: {
  current: ((event: { current: { id?: string | null } }) => void) | null;
}): void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return;

  if (listenerRef.current) {
    sdk.OneSignal.User.pushSubscription.removeEventListener('change', listenerRef.current);
  }

  const onChange = (subscription: { current: { id?: string | null } }) => {
    void maybeShowIntegrationCompleteDialog(subscription.current.id);
  };
  listenerRef.current = onChange;

  sdk.OneSignal.User.pushSubscription.addEventListener('change', onChange);
  void sdk.OneSignal.User.pushSubscription.getIdAsync().then(maybeShowIntegrationCompleteDialog);
}

export function detachPushSubscriptionVerification(listenerRef: {
  current: ((event: { current: { id?: string | null } }) => void) | null;
}): void {
  const sdk = loadOneSignal();
  if (!sdk || !listenerRef.current) return;
  sdk.OneSignal.User.pushSubscription.removeEventListener('change', listenerRef.current);
  listenerRef.current = null;
}

export function initializePassengerOneSignal(): boolean {
  if (!isPassengerOneSignalEnabled()) return false;
  if (initialized) return true;

  const appId = resolveOneSignalAppId();
  if (!appId) {
    console.warn(
      '[OneSignal] 略過初始化：請在 apps/passenger/.env 設定 EXPO_PUBLIC_ONESIGNAL_APP_ID，然後重啟 Metro',
    );
    return false;
  }

  const sdk = loadOneSignal();
  if (!sdk) {
    console.warn(
      '[OneSignal] 略過初始化：native module 未連結（請用 development build，唔好 Expo Go；或司機 App 誤連 8081 乘客 bundle）',
    );
    return false;
  }

  try {
    const { LogLevel, OneSignal } = sdk;
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }
    OneSignal.initialize(appId);
    initialized = true;
    flushPendingLogin();
    return true;
  } catch (e) {
    console.warn('[OneSignal] initialize 失敗', e);
    return false;
  }
}

export function loginPassengerOneSignal(externalUserId: string): void {
  if (!isPassengerOneSignalEnabled()) return;
  const id = externalUserId.trim();
  if (!id) return;
  if (!loadOneSignal() || !initialized) {
    pendingExternalUserId = id;
    return;
  }
  pendingExternalUserId = null;
  loadOneSignal()!.OneSignal.login(id);
}

export async function requestPassengerPushPermission(): Promise<boolean> {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return false;
  try {
    return await sdk.OneSignal.Notifications.requestPermission(true);
  } catch {
    return false;
  }
}

/** 登入後：若已走過 OneSignal 整合提示但仍未授權，再請求一次（行程訊息 push 必需） */
export async function ensurePassengerPushPermission(): Promise<void> {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return;
  try {
    const integrationDone = (await AsyncStorage.getItem(INTEGRATION_DIALOG_KEY)) === '1';
    const granted = await sdk.OneSignal.Notifications.getPermissionAsync();
    if (granted) return;
    if (integrationDone) {
      await requestPassengerPushPermission();
    }
  } catch {
    /* ignore */
  }
}

export function logoutPassengerOneSignal(): void {
  if (!isPassengerOneSignalEnabled()) return;
  pendingExternalUserId = null;
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return;
  sdk.OneSignal.logout();
}

/** @deprecated use initializePassengerOneSignal */
export function initOneSignal(): void {
  initializePassengerOneSignal();
}

type PushNotifPayload = {
  notificationId?: string;
  title?: string;
  body?: string;
  additionalData?: object;
};

function orderIdFromOrderChatPush(additionalData?: object): string | null {
  if (!additionalData || typeof additionalData !== 'object') return null;
  const d = additionalData as Record<string, unknown>;
  if (d.type !== 'order_chat') return null;
  const orderId = d.orderId;
  if (typeof orderId !== 'string') return null;
  const id = orderId.trim();
  return id || null;
}

function savePushToInbox(notification: PushNotifPayload): void {
  void appendPassengerPushInbox({
    id: notification.notificationId?.trim() || `push-${Date.now()}`,
    title: notification.title?.trim() ?? '',
    body: notification.body?.trim() ?? '',
  });
}

/** 收到或點擊 OneSignal 推播時寫入本機收件匣，供「訊息」列表顯示 */
export function attachPassengerPushInboxListener(): () => void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return () => {};

  type ForegroundEvent = {
    notification?: PushNotifPayload;
    getNotification?: () => PushNotifPayload & { display?: () => void };
  };

  const onForeground = (event: ForegroundEvent) => {
    const notification =
      typeof event.getNotification === 'function'
        ? event.getNotification()
        : event.notification;
    if (!notification) return;
    const chatOrderId = orderIdFromOrderChatPush(notification.additionalData);
    if (chatOrderId) {
      requestOpenPassengerTripChat(chatOrderId);
      notification.display?.();
      return;
    }
    savePushToInbox(notification);
    notification.display?.();
  };
  const onClick = (event: { notification: PushNotifPayload }) => {
    const chatOrderId = orderIdFromOrderChatPush(event.notification.additionalData);
    if (chatOrderId) {
      requestOpenPassengerTripChat(chatOrderId);
      return;
    }
    savePushToInbox(event.notification);
  };

  sdk.OneSignal.Notifications.addEventListener('foregroundWillDisplay', onForeground);
  sdk.OneSignal.Notifications.addEventListener('click', onClick);

  return () => {
    sdk.OneSignal.Notifications.removeEventListener('foregroundWillDisplay', onForeground);
    sdk.OneSignal.Notifications.removeEventListener('click', onClick);
  };
}
