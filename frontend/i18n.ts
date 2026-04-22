import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';
import { enDesign, zhDesign } from './locales/design';
;(window as any).i18next = i18n;

const STORAGE_KEY = 'fos.lang';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeLocale(
  base: Record<string, unknown>,
  extension: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  Object.entries(extension).forEach(([key, value]) => {
    const current = merged[key];
    merged[key] =
      isRecord(current) && isRecord(value)
        ? mergeLocale(current, value)
        : value;
  });

  return merged;
}

function detectLanguage(): 'en' | 'zh' {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === 'en' || stored === 'zh') return stored;
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
  }
  return 'en';
}

export function setLanguage(lang: 'en' | 'zh') {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: mergeLocale(en as Record<string, unknown>, enDesign as Record<string, unknown>) },
      zh: { translation: mergeLocale(zh as Record<string, unknown>, zhDesign as Record<string, unknown>) },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
