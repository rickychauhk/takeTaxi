import { readSystemLanguageTag } from './deviceLocale';
import { en } from './translations/en';
import { zhHant } from './translations/zh-Hant';

export type AppLocale = 'zh-Hant' | 'en';
export type TranslationKey = keyof typeof zhHant;

const bundles = { en, 'zh-Hant': zhHant } as const;

export function resolveAppLocale(): AppLocale {
  const override = process.env.EXPO_PUBLIC_APP_LOCALE?.trim().toLowerCase();
  if (override === 'en' || override === 'zh-hant' || override === 'zh') {
    return override === 'en' ? 'en' : 'zh-Hant';
  }
  const tag = readSystemLanguageTag().toLowerCase();
  if (tag.startsWith('en')) return 'en';
  return 'zh-Hant';
}

let activeLocale: AppLocale = resolveAppLocale();

export function getAppLocale(): AppLocale {
  return activeLocale;
}

export function setAppLocale(locale: AppLocale) {
  activeLocale = locale;
}

export function refreshAppLocaleFromDevice() {
  activeLocale = resolveAppLocale();
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const bundle = bundles[activeLocale];
  let text: string = bundle[key] ?? bundles['zh-Hant'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return text;
}

/** Google Directions / geocoder BCP-47 */
export function mapsLanguageTag(locale: AppLocale = activeLocale): string {
  return locale === 'en' ? 'en' : 'zh-HK';
}
