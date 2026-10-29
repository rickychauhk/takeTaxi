import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLocale } from '../i18n';

const KEY = 'taxima_passenger_app_locale';

export async function loadStoredAppLocale(): Promise<AppLocale | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === 'en' || raw === 'zh-Hant') return raw;
  return null;
}

export async function saveAppLocale(locale: AppLocale | 'system'): Promise<void> {
  if (locale === 'system') {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, locale);
}
