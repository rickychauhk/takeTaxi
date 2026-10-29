import { zhHant } from './translations/zh-Hant';

export type AppLocale = 'zh-Hant';
export type TranslationKey = keyof typeof zhHant;

const bundle = zhHant;

export function getAppLocale(): AppLocale {
  return 'zh-Hant';
}

export function setAppLocale(_locale: AppLocale) {
  /* driver app 固定繁中 */
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  let text: string = bundle[key] ?? String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return text;
}

export function mapsLanguageTag(): string {
  return 'zh-HK';
}
