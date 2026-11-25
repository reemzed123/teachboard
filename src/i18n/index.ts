import { he, type MessageKey } from './he';

export type Locale = 'he';

interface LocaleInfo {
  messages: Record<MessageKey, string>;
  dir: 'rtl' | 'ltr';
}

const locales: Record<Locale, LocaleInfo> = {
  he: { messages: he, dir: 'rtl' },
};

let current: Locale = 'he';

export function setLocale(locale: Locale): void {
  current = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = locales[locale].dir;
}

export function getDirection(): 'rtl' | 'ltr' {
  return locales[current].dir;
}

/** מחזיר את הטקסט המתורגם עבור מפתח, עם החלפת {שם} בערכים. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text = locales[current].messages[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
