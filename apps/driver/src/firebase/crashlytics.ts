import { Platform } from 'react-native';

function crashlyticsModule(): typeof import('@react-native-firebase/crashlytics').default | null {
  if (Platform.OS === 'web') return null;
  try {
    require('@react-native-firebase/app');
    return require('@react-native-firebase/crashlytics').default;
  } catch {
    return null;
  }
}

/** 啟動時呼叫（需 google-services.json / GoogleService-Info.plist + native prebuild） */
export function initDriverCrashlytics(): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) {
    if (__DEV__) {
      console.warn(
        '[Crashlytics] native module 未就緒：請確認 Firebase 設定檔並 prebuild 後 rebuild App',
      );
    }
    return;
  }
  try {
    void crashlytics().setCrashlyticsCollectionEnabled(true);
    crashlytics().log('Driver app started');
  } catch {
    /* native Firebase 未配置時勿令 App 崩潰 */
  }
}

export function setDriverCrashlyticsUserId(userId: string | null): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) return;
  void crashlytics().setUserId(userId?.trim() ? userId.trim() : '');
}

export function recordDriverError(error: unknown, context?: string): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) return;
  if (context) crashlytics().log(context);
  if (error instanceof Error) {
    crashlytics().recordError(error);
  } else {
    crashlytics().recordError(new Error(String(error)));
  }
}
