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

/** הזזה/סיבוב/קנה מידה של אובייקט. כרגע ממומשת רק הזזה (x, y). */
export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/**
 * קו בכתב יד. הנקודות נשמרות כרשימה שטוחה [x, y, לחץ, x, y, לחץ, ...]
 * ביחס לנקודת המוצא (transform.x, transform.y).
 * הלחץ בין 0 ל-1; כשאין מידע לחץ נשמר 0.5.
 */
export interface InkObject {
  id: ObjectId;
  type: 'ink';
  transform: Transform;
  style: InkStyle;
  points: number[];
  /** האם הלחץ נמדד בפועל (עט עם לחץ) */
  pressure: boolean;
  locked?: boolean;
}

export type BoardObject = InkObject;

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
