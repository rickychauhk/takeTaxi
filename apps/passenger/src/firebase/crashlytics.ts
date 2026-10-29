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

/** Call once at app start (after native Firebase is configured via google-services files). */
export function initPassengerCrashlytics(): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) {
    if (__DEV__) {
      console.warn(
        '[Crashlytics] native module 未就緒：請放 google-services.json / GoogleService-Info.plist 後 prebuild + run:ios',
      );
    }
    return;
  }
  try {
    void crashlytics().setCrashlyticsCollectionEnabled(true);
    crashlytics().log('Passenger app started');
  } catch {
    /* native Firebase 未配置時勿令 App 崩潰 */
  }
}

export function setPassengerCrashlyticsUserId(userId: string | null): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) return;
  void crashlytics().setUserId(userId?.trim() ? userId.trim() : '');
}

export function recordPassengerError(error: unknown, context?: string): void {
  const crashlytics = crashlyticsModule();
  if (!crashlytics) return;
  if (context) crashlytics().log(context);
  if (error instanceof Error) {
    crashlytics().recordError(error);
  } else {
    crashlytics().recordError(new Error(String(error)));
  }
}
