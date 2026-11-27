// מודל המסמך: מה שמצויר בלוח, כנתונים בלבד (בלי ציור ובלי ממשק).
// המבנה הזה הוא הבסיס לשמירה (שלב 3), ולכן משנים אותו רק בזהירות.

export const DOCUMENT_VERSION = 1;

export type ObjectId = string;
export type PageId = string;

export type InkKind = 'pen' | 'highlighter';

export interface InkStyle {
  kind: InkKind;
  /** צבע בפורמט ‎#rrggbb */
  color: string;
  /** עובי הקו ביחידות לוח */
  width: number;
  /** 0–1 */
  opacity: number;
}

/**
 * מיקום, סיבוב (במעלות, סביב נקודת המוצא) וקנה מידה אחיד של אובייקט.
 * נקודה מקומית p מוצגת בלוח ב: (x, y) + סיבוב(rotation) · scale · p
 */
export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** שדות משותפים לכל סוגי האובייקטים */
interface ObjectBase {
  id: ObjectId;
  transform: Transform;
  /** אובייקט נעול: לא נבחר, לא זז ולא נמחק במחק */
  locked?: boolean;
  /** אובייקטים עם אותו מזהה קבוצה נבחרים ונערכים יחד */
  groupId?: string;
  /** השכבה (מזהה מ-page.layers); בלי – השכבה הראשית */
  layer?: string;
}

/**
 * קו בכתב יד. הנקודות נשמרות כרשימה שטוחה [x, y, לחץ, x, y, לחץ, ...]
 * ביחס לנקודת המוצא (transform.x, transform.y).
 * הלחץ בין 0 ל-1; כשאין מידע לחץ נשמר 0.5.
 */
export interface InkObject extends ObjectBase {
  type: 'ink';
  style: InkStyle;
  points: number[];
  /** האם הלחץ נמדד בפועל (עט עם לחץ) */
  pressure: boolean;
}

export type LineDash = 'solid' | 'dashed' | 'dotted';

export interface ShapeStyle {
  color: string;
  width: number;
  opacity: number;
  dash: LineDash;
}

/**
 * קו ישר או חץ, מנקודת המוצא (0,0 מקומי) עד (dx, dy).
 * לחץ: ראש חץ בקצה, ואם arrowStart – גם בהתחלה.
 */
export interface ShapeObject extends ObjectBase {
  type: 'shape';
  kind: 'line' | 'arrow';
  dx: number;
  dy: number;
  style: ShapeStyle;
  arrowStart?: boolean;
}

/**
 * תיבת טקסט. נקודת המוצא היא הפינה העליונה-הימנית (טקסט עברי) או השמאלית (אנגלית).
 * width/height = גודל התיבה כפי שנמדד בזמן העריכה (לגבולות ולבחירה).
 */
export interface TextObject extends ObjectBase {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  dir: 'rtl' | 'ltr';
  bold?: boolean;
  width: number;
  height: number;
}

/** נוסחה מתמטית (LaTeX). width/height = הגודל שנמדד בזמן היצירה. */
export interface MathObject extends ObjectBase {
  type: 'math';
  latex: string;
  color: string;
  fontSize: number;
  width: number;
  height: number;
}

export interface GraphFunction {
  id: string;
  /** הביטוי, כפי שהמורה כתב (LaTeX או כתיב פשוט) */
  latex: string;
  color: string;
  width: number;
  visible: boolean;
}

/** מערכת צירים עם גרפים של פונקציות */
export interface GraphObject extends ObjectBase {
  type: 'graph';
  width: number;
  height: number;
  range: { xMin: number; xMax: number; yMin: number; yMax: number };
  grid: boolean;
  /** נקודות חיתוך עם הצירים */
  showIntercepts: boolean;
  /** נקודות חיתוך בין הגרפים */
  showIntersections: boolean;
  /** חקירה: נקודות קיצון (max/min) */
  showExtrema?: boolean;
  /** חקירה: אסימפטוטות אנכיות (קו מקווקו) */
  showAsymptotes?: boolean;
  functions: GraphFunction[];
}

/** טבלה (למשל טבלת ערכים). השורה הראשונה היא כותרת. */
export interface TableObject extends ObjectBase {
  type: 'table';
  rows: string[][];
  fontSize: number;
  color: string;
  cellWidth: number;
  cellHeight: number;
}

/** תמונה על הלוח (הקובץ שמור כמשאב בשיעור, לפי טביעת SHA-256) */
export interface ImageObject extends ObjectBase {
  type: 'image';
  assetId: string;
  width: number;
  height: number;
}

// ---------- גיאומטריה דינמית ----------

export type GeoKind =
  | 'point' // נקודה חופשית (params.x, params.y)
  | 'glider' // נקודה על ישר/מעגל [path] (params.x, params.y – מיקום מבוקש)
  | 'midpoint' // [A, B]
  | 'intersection' // [e1, e2] (params.index)
  | 'foot' // עקב אנך [P, line]
  | 'segment' // [A, B]
  | 'line' // [A, B]
  | 'ray' // [A, B]
  | 'parallel' // [line, P]
  | 'perpendicular' // [line, P]
  | 'perpBisector' // [A, B]
  | 'angleBisector' // [A, B, C] – בקודקוד B
  | 'circle' // [מרכז, נקודה על המעגל]
  | 'circleR' // [מרכז] (params.r)
  | 'circle3' // [A, B, C]
  | 'arc' // [מרכז, התחלה, סוף]
  | 'ellipse' // [מוקד, מוקד, נקודה]
  | 'polygon' // [P1..Pn]
  | 'regularVertex' // קודקוד של מצולע משוכלל [A, B] (params.n, params.k)
  | 'relPoint' // נקודה יחסית לבסיס AB: A + u·AB + v·(AB מסובב 90°) – לצורות ששומרות על חוקיהן
  | 'angle' // סימון/מדידת זווית [A, B, C] – בקודקוד B
  | 'measure'; // מדידה [אובייקט] (params.what)

export type MeasureKind = 'length' | 'area' | 'perimeter' | 'radius' | 'diameter';

export interface GeoStyle {
  color: string;
  width: number;
  dash?: LineDash;
  /** שם (A, B, a...) */
  label?: string;
  showLabel?: boolean;
  /** סימון קטעים שווים: 1–3 קווקווים */
  ticks?: number;
  /** סימון מקבילים: 1–2 חצים */
  arrows?: number;
  /** סימון זוויות שוות: 1–3 קשתות */
  arcs?: number;
  /** מילוי שקוף למצולע/מעגל */
  fill?: boolean;
  hidden?: boolean;
  /** טקסט להצגה במקום/בנוסף לערך המחושב (למשל x+3 לזווית) */
  text?: string;
  /** להציג גם את הערך המחושב כשיש טקסט */
  showValue?: boolean;
  /** סימון פנימי: אלמנט שנוצר אוטומטית עבור מצולע (למשל אלכסונים) – "<id>:<סוג>" */
  tag?: string;
  /** הזזת התווית (שם הנקודה / הערך / הביטוי) ממקומה הרגיל – אחרי גרירה */
  labelOffset?: { dx: number; dy: number };
  /** רדיוס הקשת הקטנה של זווית (ברירת מחדל 26) */
  arcRadius?: number;
  /** נקודה: להסתיר את העיגול (השם יכול להישאר) */
  hideDot?: boolean;
}

export interface GeoElement {
  id: string;
  kind: GeoKind;
  parents: string[];
  params?: {
    x?: number;
    y?: number;
    index?: number;
    r?: number;
    n?: number;
    k?: number;
    u?: number;
    v?: number;
    what?: MeasureKind;
  };
  style: GeoStyle;
}

/** בנייה גיאומטרית: רשימת צעדים, שהמיקומים שלהם מחושבים מחדש בכל גרירה. */
export interface GeometryObject extends ObjectBase {
  type: 'geometry';
  elements: GeoElement[];
  /** המלבן של החלקים הסופיים (נקודות, קטעים, מעגלים) – לבחירה ולגבולות */
  extent: { x: number; y: number; width: number; height: number };
}

export type BoardObject =
  | InkObject
  | ShapeObject
  | TextObject
  | MathObject
  | GraphObject
  | TableObject
  | GeometryObject
  | ImageObject;

/** עמוד מחברת (עם גבולות) או לוח אינסופי. המעבר ביניהם לא מוחק תוכן. */
export type PageLayout = 'bounded' | 'infinite';

export type BackgroundPattern = 'none' | 'grid' | 'lines' | 'math' | 'axes';

export interface PageBackground {
  pattern: BackgroundPattern;
  /** צבע הדף ‎#rrggbb */
  color: string;
  /** מרווח הקווים ביחידות לוח */
  spacing: number;
  /** תמונת רקע (מזהה משאב בקובץ השיעור), אם נבחרה */
  imageAssetId?: string;
  /** עמוד מקובץ PDF (המקור נשמר כמו שהוא; כותבים מעליו) */
  pdf?: { assetId: string; page: number };
  /** חלוקה לאזורים בקווים (עמוד מחברת בלבד) */
  zones?: PageZones;
}

export interface Page {
  id: PageId;
  layout: PageLayout;
  /** גודל עמוד המחברת ביחידות לוח (משמש גם לייצוא PDF) */
  size: { width: number; height: number };
  background: PageBackground;
  /** סדר הרשימה = סדר הציור (האחרון מצויר למעלה) */
  objects: BoardObject[];
  /** שכבות נוספות מעל השכבה הראשית (אפשר להסתיר/להציג) */
  layers?: PageLayer[];
}

export interface PageLayer {
  id: string;
  name: string;
  hidden?: boolean;
}

/** חלוקת עמוד לאזורים (עמודות ושורות) */
export interface PageZones {
  cols: number;
  rows: number;
}

/** A4 לרוחב, ב-96 נקודות לאינץ' – מתאים להדפסה ול-PDF. */
export const DEFAULT_PAGE_SIZE = { width: 1123, height: 794 } as const;

export const DEFAULT_BACKGROUND: PageBackground = {
  pattern: 'none',
  color: '#ffffff',
  spacing: 32,
};

export type PageProps = Pick<Page, 'layout' | 'size' | 'background' | 'layers'>;

export interface BoardDocument {
  version: typeof DOCUMENT_VERSION;
  pages: Page[];
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, rotation: 0, scale: 1 };

/** מספר שלשות (x, y, לחץ) בקו */
export function pointCount(obj: InkObject): number {
  return Math.floor(obj.points.length / 3);
}
