// מילון הטקסטים בעברית. כל טקסט בממשק עובר דרך מפתח כאן,
// כדי שבעתיד אפשר יהיה להוסיף שפות נוספות בלי לגעת ברכיבים.
export const he = {
  'app.name': 'TeachBoard',
  'app.tagline': 'סביבת הוראה דיגיטלית למורים',

  'workspace.label': 'אזור העבודה',
  'workspace.placeholder': 'כאן יופיע הלוח. מנוע הציור ייבנה בשלב 2.',

  'topbar.label': 'סרגל עליון',
  'quickAccess.label': 'גישה מהירה',
  'categories.label': 'קטגוריות כלים',

  'category.drawing': 'ציור וכתיבה',
  'category.math': 'מתמטיקה',
  'category.geometry': 'גיאומטריה',
  'category.pdf': 'PDF ומסמכים',
  'category.teaching': 'כלי הוראה',
  'category.templates': 'תבניות ורקעים',
  'category.files': 'ניהול שיעורים וקבצים',
  'category.plannedPhase': 'הכלים בקטגוריה זו עדיין לא נבנו. הם מתוכננים לשלב {phase}.',

  'panel.close': 'סגירת החלונית',

  'action.view.toggleTheme': 'מצב בהיר / כהה',
  'action.view.fullscreen': 'מסך מלא',
  'action.view.focusMode': 'הסתרת כל הסרגלים',
  'action.view.toggleCategoryBar': 'הצגת סרגל הקטגוריות',
  'action.settings': 'הגדרות',

  'focus.restore': 'הצגת הסרגלים',

  'settings.title': 'הגדרות',
  'settings.theme': 'מראה',
  'settings.theme.system': 'לפי מערכת ההפעלה',
  'settings.theme.light': 'בהיר',
  'settings.theme.dark': 'כהה',
  'settings.quickAccess': 'לחצני גישה מהירה',
  'settings.quickAccess.help':
    'בחרו אילו פעולות יופיעו בסרגל העליון. הרשימה תגדל ככל שייבנו כלים נוספים.',
  'settings.quickAccess.slot': 'לחצן {n}',
  'settings.quickAccess.empty': 'ריק',
  'settings.saveFailed': 'לא ניתן לשמור את ההגדרות במכשיר זה. השינויים יישמרו רק עד סגירת החלון.',

  'update.available': 'גרסה חדשה של TeachBoard מוכנה.',
  'update.reload': 'עדכון עכשיו',
  'update.later': 'אחר כך',
} as const;

export type MessageKey = keyof typeof he;
