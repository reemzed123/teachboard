// זיהוי: האם התוכנה רצה כתוכנת Windows (Tauri) או בדפדפן.
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** מספר הגרסה (מ-package.json, בזמן הבנייה) */
export const APP_VERSION: string = __APP_VERSION__;
