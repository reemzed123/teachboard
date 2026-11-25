// מילון הטקסטים בעברית. כל טקסט בממשק עובר דרך מפתח כאן,
// כדי שבעתיד אפשר יהיה להוסיף שפות נוספות בלי לגעת ברכיבים.
export const he = {
  'app.name': 'TeachBoard',
  'app.tagline': 'סביבת הוראה דיגיטלית למורים',
  'app.buildStage': 'שלב 0 – תשתית הפרויקט. הממשק ייבנה בשלב 1.',
} as const;

export type MessageKey = keyof typeof he;
