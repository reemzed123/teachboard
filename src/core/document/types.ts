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

export type BoardObject = InkObject | ShapeObject | TextObject;

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
}

export interface Page {
  id: PageId;
  layout: PageLayout;
  /** גודל עמוד המחברת ביחידות לוח (משמש גם לייצוא PDF) */
  size: { width: number; height: number };
  background: PageBackground;
  /** סדר הרשימה = סדר השכבות (האחרון מצויר למעלה) */
  objects: BoardObject[];
}

/** A4 לרוחב, ב-96 נקודות לאינץ' – מתאים להדפסה ול-PDF. */
export const DEFAULT_PAGE_SIZE = { width: 1123, height: 794 } as const;

export const DEFAULT_BACKGROUND: PageBackground = {
  pattern: 'none',
  color: '#ffffff',
  spacing: 32,
};

export type PageProps = Pick<Page, 'layout' | 'size' | 'background'>;

export interface BoardDocument {
  version: typeof DOCUMENT_VERSION;
  pages: Page[];
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, rotation: 0, scale: 1 };

/** מספר שלשות (x, y, לחץ) בקו */
export function pointCount(obj: InkObject): number {
  return Math.floor(obj.points.length / 3);
}
