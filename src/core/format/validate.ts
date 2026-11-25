import { SPACING_LIMITS } from '../background/pattern';
import { newId } from '../document/ids';
import {
  DEFAULT_BACKGROUND,
  DOCUMENT_VERSION,
  type BackgroundPattern,
  type BoardDocument,
  type BoardObject,
  type InkObject,
  type LineDash,
  type Page,
  type ShapeObject,
  type TextObject,
  type Transform,
  type PageBackground,
} from '../document/types';

// בדיקת תקינות של מסמך שנקרא מאחסון או מקובץ.
// העיקרון: לא סומכים על שום ערך. בונים מסמך חדש ונקי, ומעתיקים רק שדות מוכרים
// בטיפוס ובטווח הנכון. מסמך לא תקין נדחה עם הודעה ברורה – והתוכנה לא קורסת.

export type FormatErrorCode = 'notDocument' | 'newerVersion' | 'invalid' | 'tooLarge';

export class FormatError extends Error {
  constructor(
    public code: FormatErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'FormatError';
  }
}

export const LIMITS = {
  pages: 2000,
  objectsTotal: 300_000,
  pointsPerObject: 600_000,
  idLength: 64,
  coordinate: 1e7,
} as const;

const PATTERNS: readonly BackgroundPattern[] = ['none', 'grid', 'lines', 'math', 'axes'];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ASSET_ID = /^[a-f0-9]{64}$/;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

function fail(detail: string): never {
  throw new FormatError('invalid', detail);
}

function cleanId(v: unknown, used: Set<string>, prefix: string): string {
  let id = typeof v === 'string' && ID.test(v) ? v : newId(prefix);
  if (used.has(id)) id = newId(prefix);
  used.add(id);
  return id;
}

function cleanBackground(v: unknown): PageBackground {
  if (!isObj(v)) return { ...DEFAULT_BACKGROUND };
  const bg: PageBackground = {
    pattern: PATTERNS.includes(v.pattern as BackgroundPattern)
      ? (v.pattern as BackgroundPattern)
      : 'none',
    color: typeof v.color === 'string' && HEX.test(v.color) ? v.color.toLowerCase() : '#ffffff',
    spacing: Math.round(
      Math.min(SPACING_LIMITS.max, Math.max(SPACING_LIMITS.min, num(v.spacing, 0, 1e9) ?? 32)),
    ),
  };
  if (typeof v.imageAssetId === 'string' && ASSET_ID.test(v.imageAssetId)) {
    bg.imageAssetId = v.imageAssetId;
  }
  return bg;
}

function cleanTransform(v: unknown): Transform {
  const t = isObj(v) ? v : {};
  const C = LIMITS.coordinate;
  return {
    x: num(t.x, -C, C) ?? 0,
    y: num(t.y, -C, C) ?? 0,
    rotation: num(t.rotation, -1e4, 1e4) ?? 0,
    scale: num(t.scale, 0.001, 1000) ?? 1,
  };
}

const color = (v: unknown): string | null =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null;

/** שדות משותפים: נעילה וקבוצה */
function withCommon<T extends { locked?: boolean; groupId?: string }>(obj: T, v: Obj): T {
  if (v.locked === true) obj.locked = true;
  if (typeof v.groupId === 'string' && ID.test(v.groupId)) obj.groupId = v.groupId;
  return obj;
}

const DASHES: readonly LineDash[] = ['solid', 'dashed', 'dotted'];

function cleanShape(v: Obj, id: string): ShapeObject | null {
  const st = isObj(v.style) ? v.style : null;
  if (!st) return null;
  const C = LIMITS.coordinate;
  const dx = num(v.dx, -C, C);
  const dy = num(v.dy, -C, C);
  const c = color(st.color);
  const width = num(st.width, 0.1, 500);
  const opacity = num(st.opacity, 0, 1);
  if (dx === null || dy === null || !c || width === null || opacity === null) return null;
  if (v.kind !== 'line' && v.kind !== 'arrow') return null;
  const obj: ShapeObject = {
    id,
    type: 'shape',
    kind: v.kind,
    transform: cleanTransform(v.transform),
    dx,
    dy,
    style: {
      color: c,
      width,
      opacity,
      dash: DASHES.includes(st.dash as LineDash) ? (st.dash as LineDash) : 'solid',
    },
  };
  if (v.arrowStart === true) obj.arrowStart = true;
  return withCommon(obj, v);
}

function cleanText(v: Obj, id: string): TextObject | null {
  if (typeof v.text !== 'string' || v.text.length === 0 || v.text.length > 20000) return null;
  const fontSize = num(v.fontSize, 4, 1000);
  const c = color(v.color);
  const width = num(v.width, 0, 1e6);
  const height = num(v.height, 0, 1e6);
  if (fontSize === null || !c || width === null || height === null) return null;
  const obj: TextObject = {
    id,
    type: 'text',
    transform: cleanTransform(v.transform),
    // תווי בקרה (חוץ ממעבר שורה) מוסרים
    text: [...v.text].filter((ch) => ch === '\n' || ch.charCodeAt(0) >= 32).join(''),
    fontSize,
    color: c,
    dir: v.dir === 'ltr' ? 'ltr' : 'rtl',
    width,
    height,
  };
  if (v.bold === true) obj.bold = true;
  return withCommon(obj, v);
}

function cleanInk(v: Obj, id: string): InkObject | null {
  const st = isObj(v.style) ? v.style : null;
  if (!st) return null;
  const C = LIMITS.coordinate;
  const pts = v.points;
  if (!Array.isArray(pts) || pts.length === 0 || pts.length % 3 !== 0) return null;
  if (pts.length > LIMITS.pointsPerObject) throw new FormatError('tooLarge', 'points');
  const points: number[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const n = num(pts[i], i % 3 === 2 ? 0 : -C, i % 3 === 2 ? 1 : C);
    if (n === null) return null;
    points[i] = n;
  }
  const kind = st.kind === 'highlighter' ? 'highlighter' : st.kind === 'pen' ? 'pen' : null;
  const inkColor = color(st.color);
  const width = num(st.width, 0.1, 500);
  const opacity = num(st.opacity, 0, 1);
  if (!kind || !inkColor || width === null || opacity === null) return null;
  const obj: InkObject = {
    id,
    type: 'ink',
    transform: cleanTransform(v.transform),
    style: { kind, color: inkColor, width, opacity },
    points,
    pressure: v.pressure === true,
  };
  return withCommon(obj, v);
}

export interface ValidationReport {
  /** אובייקטים שדולגו כי לא היו תקינים או מסוג לא מוכר */
  skippedObjects: number;
}

/**
 * מקבל ערך כלשהו ומחזיר מסמך תקין, או זורק FormatError.
 * מסמכים מגרסה ישנה מוסבים לגרסה הנוכחית (כשיהיו כאלה).
 */
export function validateDocument(raw: unknown, report?: ValidationReport): BoardDocument {
  if (!isObj(raw) || !Array.isArray(raw.pages)) throw new FormatError('notDocument', 'shape');
  const version = num(raw.version, 1, 1e6);
  if (version === null) throw new FormatError('notDocument', 'version');
  if (version > DOCUMENT_VERSION) throw new FormatError('newerVersion', String(version));
  // כאן יתווספו המרות מגרסאות ישנות: if (version < 2) raw = migrate1to2(raw) ...

  if (raw.pages.length === 0) fail('no pages');
  if (raw.pages.length > LIMITS.pages) throw new FormatError('tooLarge', 'pages');

  const usedIds = new Set<string>();
  let total = 0;
  let skipped = 0;
  const pages: Page[] = raw.pages.map((p: unknown): Page => {
    if (!isObj(p)) fail('page');
    const size = isObj(p.size) ? p.size : {};
    const objects: BoardObject[] = [];
    const list = Array.isArray(p.objects) ? p.objects : [];
    total += list.length;
    if (total > LIMITS.objectsTotal) throw new FormatError('tooLarge', 'objects');
    for (const o of list) {
      const cleaner = !isObj(o)
        ? null
        : o.type === 'ink'
          ? cleanInk
          : o.type === 'shape'
            ? cleanShape
            : o.type === 'text'
              ? cleanText
              : null;
      if (!cleaner || !isObj(o)) {
        skipped++;
        continue;
      }
      const clean = cleaner(o, cleanId(o.id, usedIds, 'o'));
      if (clean) objects.push(clean);
      else skipped++;
    }
    return {
      id: cleanId(p.id, usedIds, 'p'),
      layout: p.layout === 'infinite' ? 'infinite' : 'bounded',
      size: {
        width: num(size.width, 50, 20000) ?? 1123,
        height: num(size.height, 50, 20000) ?? 794,
      },
      background: cleanBackground(p.background),
      objects,
    };
  });

  if (report) report.skippedObjects = skipped;
  return { version: DOCUMENT_VERSION, pages };
}

/** כל מזהי המשאבים (תמונות) שהמסמך משתמש בהם */
export function referencedAssets(doc: BoardDocument): string[] {
  const ids = new Set<string>();
  for (const p of doc.pages) if (p.background.imageAssetId) ids.add(p.background.imageAssetId);
  return [...ids];
}
