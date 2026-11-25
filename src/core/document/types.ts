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

export interface Page {
  id: PageId;
  /** סדר הרשימה = סדר השכבות (האחרון מצויר למעלה) */
  objects: BoardObject[];
}

export interface BoardDocument {
  version: typeof DOCUMENT_VERSION;
  pages: Page[];
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, rotation: 0, scale: 1 };

/** מספר שלשות (x, y, לחץ) בקו */
export function pointCount(obj: InkObject): number {
  return Math.floor(obj.points.length / 3);
}
