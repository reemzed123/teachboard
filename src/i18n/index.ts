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

/** מחזיר את הטקסט המתורגם עבור מפתח. */
export function t(key: MessageKey): string {
  return locales[current].messages[key];
}
