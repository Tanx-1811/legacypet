import en from './en.js';
import es from './es.js';
import fr from './fr.js';
import ja from './ja.js';
import ko from './ko.js';
import vi from './vi.js';
import zh from './zh.js';

// Anything a translation leaves out falls back to English, so a new language
// (or a new line added to en.js) never renders "undefined".
function withFallback(base, over) {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const isObject = value && typeof value === 'object' && !Array.isArray(value);
    out[key] = isObject && base[key] && typeof base[key] === 'object' ? withFallback(base[key], value) : value;
  }
  return out;
}

const TRANSLATIONS = { vi, ja, zh, ko, es, fr };
export const LANGS = { en, ...Object.fromEntries(Object.entries(TRANSLATIONS).map(([code, tr]) => [code, withFallback(en, tr)])) };

// Native names, for pickers in the CLI help and the playground.
export const LANG_NAMES = {
  en: 'English', vi: 'Tiếng Việt', ja: '日本語', zh: '中文', ko: '한국어', es: 'Español', fr: 'Français',
};

export function resolveLang(lang) {
  const code = String(lang ?? 'en').toLowerCase().slice(0, 2);
  return LANGS[code] ? code : 'en';
}

export const strings = (lang) => LANGS[resolveLang(lang)];
