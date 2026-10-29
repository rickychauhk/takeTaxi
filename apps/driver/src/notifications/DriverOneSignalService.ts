import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, NativeModules } from 'react-native';

type OneSignalModule = typeof import('react-native-onesignal');

const INTEGRATION_DIALOG_KEY = 'onesignal_integration_dialog_shown_v1';

let initialized = false;
let subscriptionObserverAttached = false;
let integrationDialogShownThisSession = false;

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
  return Boolean(subscriptionId && !subscriptionId.startsWith('local-'));
}

export function initializeDriverOneSignal(): boolean {
  if (initialized) return true;

  const appId = resolveOneSignalAppId();
  if (!appId) {
    console.warn(
      '[OneSignal] 略過初始化：請設定 EXPO_PUBLIC_ONESIGNAL_APP_ID 或 app.config extra.oneSignalAppId',
    );
    return false;
  }

  const sdk = loadOneSignal();
  if (!sdk) {
    console.warn('[OneSignal] 略過初始化：native module 未連結（請用 release/dev build，唔好 Expo Go）');
    return false;
  }

  try {
    const { LogLevel, OneSignal } = sdk;
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }
    OneSignal.initialize(appId);
    initialized = true;
    return true;
  } catch (e) {
    console.warn('[OneSignal] initialize 失敗', e);
    return false;
  }
}

/** OneSignal integration guide: observer + one-time verification dialog → request permission on tap */
export function setupDriverOneSignalPushSubscriptionVerification(): void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized || subscriptionObserverAttached) return;
  subscriptionObserverAttached = true;

  const { OneSignal } = sdk;

  const maybeShowIntegrationDialog = async (subscriptionId: string | null | undefined) => {
    if (!isRegisteredSubscriptionId(subscriptionId)) return;
    if (integrationDialogShownThisSession) return;
    const persisted = await AsyncStorage.getItem(INTEGRATION_DIALOG_KEY);
    if (persisted === '1') return;

    integrationDialogShownThisSession = true;
    await AsyncStorage.setItem(INTEGRATION_DIALOG_KEY, '1');

    Alert.alert(
      'Your OneSignal SDK integration is complete!',
      'You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.',
      [
        {
          text: 'Got it',
          onPress: () => {
            void requestDriverPushPermission();
          },
        },
      ],
      { cancelable: false },
    );
  };

  OneSignal.User.pushSubscription.addEventListener('change', (subscription) => {
    void maybeShowIntegrationDialog(subscription.current.id);
  });

  void OneSignal.User.pushSubscription.getIdAsync().then((id) => maybeShowIntegrationDialog(id));
}

export async function requestDriverPushPermission(): Promise<boolean> {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return false;
  try {
    return await sdk.OneSignal.Notifications.requestPermission(true);
  } catch {
    return false;
  }
}

export function loginDriverOneSignal(externalUserId: string): void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized || !externalUserId.trim()) return;
  sdk.OneSignal.login(externalUserId.trim());
}

/** 登入後：若已完成 OneSignal 整合對話框，仍未授權則再請求（司機接柯打必需） */
export async function ensureDriverPushPermission(): Promise<void> {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return;
  try {
    const integrationDone = (await AsyncStorage.getItem(INTEGRATION_DIALOG_KEY)) === '1';
    const granted = await sdk.OneSignal.Notifications.getPermissionAsync();
    if (granted) return;
    if (integrationDone) {
      await requestDriverPushPermission();
    }
  } catch {
    /* ignore */
  }
}

export function logoutDriverOneSignal(): void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return;
  sdk.OneSignal.logout();
}

function orderIdFromPushData(additionalData?: object): string | null {
  if (!additionalData || typeof additionalData !== 'object') return null;
  const d = additionalData as Record<string, unknown>;
  if (d.type !== 'new_order' && d.type !== 'scheduled_order_reminder') return null;
  const orderId = d.orderId;
  if (typeof orderId !== 'string') return null;
  const id = orderId.trim();
  return id || null;
}

/** 註冊新柯打 push 點擊（含 cold start 透過 click 事件） */
export function attachDriverPushNotificationHandlers(
  onOpenOrder: (orderId: string) => void,
): () => void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return () => {};

  type ClickEvent = { notification: { additionalData?: object } };

  const onClick = (event: ClickEvent) => {
    const id = orderIdFromPushData(event.notification.additionalData);
    if (id) onOpenOrder(id);
  };

  sdk.OneSignal.Notifications.addEventListener('click', onClick);

  return () => {
    sdk.OneSignal.Notifications.removeEventListener('click', onClick);
  };
}

export type DriverPushForegroundEvent = {
  notification: {
    additionalData?: object;
    title?: string;
    body?: string;
  };
  preventDefault: () => void;
};

/** 前景收到新柯打 push（preventDefault 唔出系統 banner；Android 可改全屏接單，iOS 由 WS 負責） */
export function attachDriverPushForegroundNewOrderHandler(
  onForegroundNewOrder: (event: DriverPushForegroundEvent) => void,
): () => void {
  const sdk = loadOneSignal();
  if (!sdk || !initialized) return () => {};

  const onForeground = (event: DriverPushForegroundEvent) => {
    const id = orderIdFromPushData(event.notification.additionalData);
    if (!id) return;
    if (suppressForegroundNewOrderPush()) {
      event.preventDefault();
      return;
    }
    onForegroundNewOrder(event);
  };

  sdk.OneSignal.Notifications.addEventListener('foregroundWillDisplay', onForeground);
  return () => {
    sdk.OneSignal.Notifications.removeEventListener('foregroundWillDisplay', onForeground);
  };
}

let suppressForegroundNewOrderPushFlag = false;

/** WS 已彈柯打時避免重複 banner */
export function setSuppressForegroundNewOrderPush(suppress: boolean) {
  suppressForegroundNewOrderPushFlag = suppress;
}

function suppressForegroundNewOrderPush(): boolean {
  return suppressForegroundNewOrderPushFlag;
}
