# פורמט הקובץ ‎.board – גרסה 1

קובץ שיעור של TeachBoard. מיועד לשמירה, גיבוי והעברה בין מחשבים.

## מבנה

קובץ ZIP רגיל, עם הקבצים הבאים בלבד:

| נתיב              | תוכן                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `manifest.json`   | זיהוי: `format: "teachboard"`, `formatVersion: 1`, שם השיעור, גרסת התוכנה, זמן שמירה |
| `document.json`   | המסמך: `{ version: 1, pages: [...] }`                                                |
| `assets/<sha256>` | תמונות רקע (PNG / JPEG / WebP, עד 20MB) וקובצי PDF מקוריים (עד 100MB). השם = SHA-256 |

### document.json

- `pages[]`: `id`, `layout` (`bounded` = עמוד מחברת, `infinite` = לוח אינסופי), `size {width,height}` (יחידות לוח; ברירת מחדל A4 לרוחב 1123×794), `background {pattern, color, spacing, imageAssetId?, pdf? {assetId, page}, zones? {cols, rows}}` (`page` מתחיל ב-0; אזורים 1–4), `layers? [{id, name, hidden?}]`; לכל אובייקט `layer?` (מזהה שכבה; בלי = הראשית), `objects[]`.
- `objects[]` – שדות משותפים לכל סוג: `id`, `type`, `transform {x, y, rotation (מעלות), scale (אחיד)}`, `locked?`, `groupId?`.
  - `type: "ink"` – כתב יד: `style {kind: pen|highlighter, color, width, opacity}`, `points` (שלשות x,y,לחץ ביחס ל-transform), `pressure`.
  - `type: "shape"` – קו/חץ: `kind: line|arrow`, `dx, dy` (נקודת הסוף ביחס להתחלה), `style {color, width, opacity, dash: solid|dashed|dotted}`, `arrowStart?`.
  - `type: "text"` – טקסט: `text` (עד 20,000 תווים, בלי תווי בקרה מלבד מעבר שורה), `fontSize`, `color`, `dir: rtl|ltr`, `bold?`, `width`, `height` (גודל התיבה כפי שנמדד).
  - `type: "math"` – נוסחה: `latex` (עד 5,000 תווים), `color`, `fontSize`, `width`, `height`.
  - `type: "graph"` – מערכת צירים: `width`, `height`, `range {xMin,xMax,yMin,yMax}`, `grid`, `showIntercepts`, `showIntersections`, `functions[] {id, latex, color, width, visible}` (עד 20). הביטויים מפוענחים בטוח – לא מורצים כקוד.
  - `type: "table"` – טבלה: `rows` (מחרוזות; עד 200 שורות × 30 עמודות), `fontSize`, `color`, `cellWidth`, `cellHeight`.
  - גרף: `params?` – פרמטרים למחוונים `{a: {value, min, max, step}}` (אות אחת, עד 8).
  - `type: "numberline"` – ציר מספרים: `from`, `to`, `step` (עד 1000 שנתות), `width`, `height`, `color`.
  - `type: "fractions"` – רצועות שברים: `denominators` (1–24), `width`, `rowHeight`, `color`.
  - טבלה: `header` (false = בלי כותרת), `dir` (‏ltr ללוח 100).
  - `type: "image"` – תמונה: `assetId` (משאב PNG/JPEG/WebP ב-`assets/`), `width`, `height`. תמונה שהמשאב שלה חסר – מושמטת בפתיחה.
  - `type: "geometry"` – בנייה גיאומטרית: `elements[] {id, kind, parents[], params?, style}`, `extent`. כל הורה חייב להופיע לפני הצעד שתלוי בו (אחרת הצעד ומה שתלוי בו מדולגים). סוגים: ראו `GeoKind` ב-`core/document/types.ts`. `relPoint` = נקודה יחסית לבסיס [A, B] לפי `params.u`, `params.v` (צורות ידועות). ב-`style`: `text` (ביטוי להצגה, עד 40 תווים), `showValue`, ו-`tag` (סימון פנימי של תוספות למצולע).
- סדר האובייקטים = סדר השכבות.
- קבוצה = כל האובייקטים בעמוד עם אותו `groupId`.

## גרסאות ותאימות

- `formatVersion` (המעטפת) ו-`version` (המסמך) עולים רק בשינוי שאינו תואם.
- קובץ מגרסה **ישנה** – מוסב אוטומטית לגרסה הנוכחית בזמן פתיחה (`core/format/validate.ts`).
- קובץ מגרסה **חדשה** יותר מהתוכנה – לא נפתח, ומוצגת הודעה לעדכן את התוכנה. הקובץ לא משתנה.
- סוג אובייקט לא מוכר מדולג (והמורה מקבל הודעה כמה פריטים דולגו), כדי שאפשר יהיה להוסיף סוגים בעתיד.

## אבטחה (בפתיחת קובץ)

- **אין הרצת קוד** מהקובץ בשום שלב. נוסחאות (בעתיד) יישמרו כטקסט LaTeX ויפוענחו – לא יורצו.
- נקראים רק הנתיבים המותרים בטבלה; כל קובץ אחר בתוך ה-ZIP (כולל ניסיונות `../`) מתעלם.
- מגבלות גודל: קובץ עד 300MB; מסמך עד 200MB; תמונה עד 20MB; סה"כ אחרי פריסה עד 600MB; עד 2000 קבצים פנימיים. מונע "פצצת ZIP".
- כל ערך במסמך נבדק בטיפוס ובטווח; נבנה מסמך חדש שמכיל רק שדות מוכרים.
- תמונות מזוהות לפי הבתים הראשונים (לא לפי השם). SVG אסור (יכול להכיל קוד).

## אחסון מקומי (לא חלק מהקובץ)

בדפדפן השיעורים נשמרים ב-IndexedDB (מסד `teachboard-<profile>`), כולל גרסאות קודמות ותמונות. הקובץ ‎.board הוא לייצוא/גיבוי/העברה.
