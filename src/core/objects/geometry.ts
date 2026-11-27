import type { BoardObject, ShapeObject, TableObject, TextObject } from '../document/types';
import { distSqToSegment, inflate, segmentIntersectsRect, type Rect } from '../geometry/rect';
import { toLocal, toWorld, worldBounds } from '../geometry/transform';
import { inkHitsPoint, inkIntersectsRect, inkLocalBounds } from '../ink/ink';

// גיאומטריה משותפת לכל סוגי האובייקטים: גבולות, פגיעה בנקודה, חיתוך עם מלבן.

/** גודל ראש החץ ביחס לעובי הקו */
export function arrowHeadSize(width: number): number {
  return Math.max(10, width * 3.2);
}

export function shapeLocalBounds(o: ShapeObject): Rect {
  const pad = o.style.width / 2 + (o.kind === 'arrow' ? arrowHeadSize(o.style.width) / 2 : 0);
  return inflate(
    { x: Math.min(0, o.dx), y: Math.min(0, o.dy), width: Math.abs(o.dx), height: Math.abs(o.dy) },
    pad,
  );
}

/** טקסט עברי: נקודת המוצא בפינה הימנית, והתיבה נמשכת שמאלה. */
export function textLocalBounds(o: TextObject): Rect {
  return { x: o.dir === 'rtl' ? -o.width : 0, y: 0, width: o.width, height: o.height };
}

export function tableSize(o: TableObject): { width: number; height: number } {
  const cols = Math.max(0, ...o.rows.map((r) => r.length));
  return { width: cols * o.cellWidth, height: o.rows.length * o.cellHeight };
}

export function localBounds(o: BoardObject): Rect {
  switch (o.type) {
    case 'ink':
      return inkLocalBounds(o);
    case 'shape':
      return shapeLocalBounds(o);
    case 'text':
      return textLocalBounds(o);
    case 'math':
    case 'graph':
    case 'image':
      return { x: 0, y: 0, width: o.width, height: o.height };
    case 'table':
      return { x: 0, y: 0, ...tableSize(o) };
    case 'geometry':
      return o.extent;
  }
}

/** אובייקטים "קופסתיים" – נבחרים בלחיצה בכל מקום בתוך המלבן שלהם */
function boxHit(o: BoardObject, x: number, y: number, tolerance: number): boolean {
  const p = toLocal(o.transform, x, y);
  const b = inflate(localBounds(o), tolerance / o.transform.scale);
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

export function objectBounds(o: BoardObject): Rect {
  return worldBounds(o.transform, localBounds(o));
}

export function objectHitsPoint(o: BoardObject, x: number, y: number, tolerance: number): boolean {
  switch (o.type) {
    case 'ink':
      return inkHitsPoint(o, x, y, tolerance);
    case 'shape': {
      const p = toLocal(o.transform, x, y);
      const reach = o.style.width / 2 + tolerance / o.transform.scale;
      return distSqToSegment(p.x, p.y, 0, 0, o.dx, o.dy) <= reach * reach;
    }
    case 'text':
    case 'math':
    case 'graph':
    case 'table':
    case 'geometry':
    case 'image':
      return boxHit(o, x, y, tolerance);
  }
}

export function objectIntersectsRect(o: BoardObject, rect: Rect): boolean {
  switch (o.type) {
    case 'ink':
      return inkIntersectsRect(o, rect);
    case 'shape': {
      const a = toWorld(o.transform, 0, 0);
      const b = toWorld(o.transform, o.dx, o.dy);
      return segmentIntersectsRect(a.x, a.y, b.x, b.y, rect);
    }
    case 'text':
    case 'math':
    case 'graph':
    case 'table':
    case 'geometry':
    case 'image': {
      const b = objectBounds(o);
      return (
        b.x <= rect.x + rect.width &&
        rect.x <= b.x + b.width &&
        b.y <= rect.y + rect.height &&
        rect.y <= b.y + b.height
      );
    }
  }
}
