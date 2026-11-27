// חוסם הגדלה של כל הממשק (זום של הדפדפן/WebView) – הזום שייך ללוח בלבד.
// בתוכנה המותקנת מופעלות מחוות הזום של WebView2 (כדי שצביטה במשטח מגע תגיע ללוח
// כ-Ctrl+גלגלת), ולכן כאן חוסמים אותן מחוץ ללוח: על הלוח המנוע עצמו מטפל בהן.

const ZOOM_KEYS = new Set(['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0']);

export function installPageZoomGuard(win: Window = window): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.has(e.code)) e.preventDefault();
  };
  // בשלב ה-bubble על window: הלוח כבר קיבל את האירוע לפני כן.
  win.addEventListener('wheel', onWheel, { passive: false });
  win.addEventListener('keydown', onKey);
  return () => {
    win.removeEventListener('wheel', onWheel);
    win.removeEventListener('keydown', onKey);
  };
}
