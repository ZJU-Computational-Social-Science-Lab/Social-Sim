import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';
;(window as any).i18next = i18n;

const STORAGE_KEY = 'socialsim4.lang';

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
    resources: { en: { translation: en }, zh: { translation: zh } },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
