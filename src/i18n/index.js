import en from './en.js';
import vi from './vi.js';

export const LANGS = { en, vi };

export function resolveLang(lang) {
  const code = String(lang ?? 'en').toLowerCase().slice(0, 2);
  return LANGS[code] ? code : 'en';
}

export const strings = (lang) => LANGS[resolveLang(lang)];
