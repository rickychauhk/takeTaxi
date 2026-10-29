import { NativeModules, Platform } from 'react-native';

/**
 * 唔依賴 expo-localization 原生模組（避免未 rebuild 時 crash）。
 * rebuild 後仍可用；之後可改回 expo-localization.getLocales()。
 */
export function readSystemLanguageTag(): string {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings as
        | { AppleLocale?: string; AppleLanguages?: string[] }
        | undefined;
      const fromApple = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
      if (typeof fromApple === 'string') return fromApple.replace(/_/g, '-');
    }
    if (Platform.OS === 'android') {
      const id = NativeModules.I18nManager?.localeIdentifier as string | undefined;
      if (typeof id === 'string') return id.replace(/_/g, '-');
    }
  } catch {
    /* ignore */
  }
  return Intl.DateTimeFormat().resolvedOptions().locale || 'zh-Hant';
}
