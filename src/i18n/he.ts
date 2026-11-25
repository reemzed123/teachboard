// מילון הטקסטים בעברית. כל טקסט בממשק עובר דרך מפתח כאן,
// כדי שבעתיד אפשר יהיה להוסיף שפות נוספות בלי לגעת ברכיבים.
export const he = {
  'app.name': 'TeachBoard',
  'app.tagline': 'סביבת הוראה דיגיטלית למורים',

  'workspace.label': 'אזור העבודה',

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
  'action.edit.undo': 'ביטול פעולה',
  'action.edit.redo': 'ביצוע חוזר',
  'action.edit.deleteSelection': 'מחיקת הבחירה',
  'action.view.zoomIn': 'הגדלה',
  'action.view.zoomOut': 'הקטנה',
  'action.view.zoomFit': 'התאמת התוכן למסך',

  'tool.pen': 'עט',
  'tool.highlighter': 'מדגיש',
  'tool.eraser': 'מחק',
  'tool.select': 'בחירה',
  'tool.hand': 'הזזת הלוח',

  'history.label': 'ביטול וחזרה',
  'zoom.label': 'זום',
  'zoom.reset': 'זום נוכחי {percent}% – לחיצה מחזירה ל-100%',

  'drawing.tools': 'כלי ציור',
  'drawing.color': 'צבע',
  'drawing.colorValue': 'צבע {color}',
  'drawing.customColor': 'צבע אחר לבחירה',
  'drawing.width': 'עובי',
  'drawing.widthExact': 'עובי מדויק',
  'drawing.sizeValue': 'גודל {n}',
  'drawing.opacity': 'אטימות',
  'drawing.usePressure': 'עובי משתנה לפי לחץ העט',
  'drawing.pressure.noPen': 'עדיין לא זוהה עט דיגיטלי.',
  'drawing.pressure.detected': 'זוהה עט עם לחץ.',
  'drawing.pressure.notDetected':
    'זוהה עט, אבל בלי מידע לחץ. בלוחות Huion יש להפעיל "Windows Ink" בתוכנת הדרייבר.',
  'drawing.smoothing': 'החלקת כתב יד',
  'drawing.smoothing.help':
    'מייצבת רעד ומעגלת את הקו. בהרמת העט מוסרים גם "ווים" קטנים בתחילת ובסוף הקו.',
  'drawing.smoothing.0': 'ללא',
  'drawing.smoothing.1': 'עדינה',
  'drawing.smoothing.2': 'רגילה',
  'drawing.smoothing.3': 'חזקה',
  'drawing.eraserMode': 'סוג מחיקה',
  'drawing.eraserMode.stroke': 'קווים שלמים',
  'drawing.eraserMode.area': 'אזור (חותך קווים)',
  'drawing.eraserSize': 'גודל המחק',
  'drawing.selectHelp':
    'לחיצה על קו בוחרת אותו (Shift מוסיף). גרירה בשטח ריק בוחרת כמה קווים. גרירת הבחירה מזיזה אותה.',
  'drawing.deleteSelection': 'מחיקת הבחירה ({n})',
  'drawing.handHelp': 'גררו כדי להזיז את הלוח. אפשר גם להחזיק רווח, או לגרור בשתי אצבעות.',
  'drawing.clearPage': 'ניקוי כל העמוד',
  'drawing.clearPage.title': 'לנקות את כל העמוד?',
  'drawing.clearPage.message': 'כל מה שמצויר בעמוד יימחק. אפשר לבטל את הפעולה בלחצן "ביטול פעולה".',
  'drawing.clearPage.confirm': 'ניקוי העמוד',
  'common.cancel': 'ביטול',

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
