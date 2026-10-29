import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getAppLocale, t as translate, type AppLocale, type TranslationKey } from './index';

type I18nContextValue = {
  locale: AppLocale;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  pickupTag: string;
  dropoffTag: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TranslationKey, params?: Record<string, string>) => translate(key, params);
    return {
      locale: getAppLocale(),
      t,
      pickupTag: t('home.pickupTag'),
      dropoffTag: t('home.dropoffTag'),
    };
  }, []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
