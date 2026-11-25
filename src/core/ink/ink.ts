import { distSqToSegment, inflate, segmentIntersectsRect, type Rect } from '../geometry/rect';
import { newId } from '../document/ids';
import type { InkObject } from '../document/types';

// פעולות חישוביות על קווי כתב יד: גבולות, פגיעה, מחיקה חלקית.

/** המלבן התוחם של הקו, בקואורדינטות הלוח (כולל עובי). */
export function inkBounds(obj: InkObject): Rect {
  const { points, transform } = obj;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return { x: transform.x, y: transform.y, width: 0, height: 0 };
  const half = obj.style.width / 2;
  return inflate(
    { x: minX + transform.x, y: minY + transform.y, width: maxX - minX, height: maxY - minY },
    half,
  );
}

/** האם נקודה (בקואורדינטות לוח) נוגעת בקו, בסובלנות נתונה. */
export function inkHitsPoint(obj: InkObject, x: number, y: number, tolerance: number): boolean {
  const px = x - obj.transform.x;
  const py = y - obj.transform.y;
  const reach = obj.style.width / 2 + tolerance;
  const reachSq = reach * reach;
  const p = obj.points;
  if (p.length < 6) {
    if (p.length < 3) return false;
    const dx = p[0]! - px;
    const dy = p[1]! - py;
    return dx * dx + dy * dy <= reachSq;
  }
  for (let i = 0; i + 5 < p.length; i += 3) {
    if (distSqToSegment(px, py, p[i]!, p[i + 1]!, p[i + 3]!, p[i + 4]!) <= reachSq) return true;
  }
  return false;
}

/** האם הקו עובר דרך המלבן (בקואורדינטות לוח). */
export function inkIntersectsRect(obj: InkObject, rect: Rect): boolean {
  const r = { ...rect, x: rect.x - obj.transform.x, y: rect.y - obj.transform.y };
  const p = obj.points;
  if (p.length === 3) return segmentIntersectsRect(p[0]!, p[1]!, p[0]!, p[1]!, r);
  for (let i = 0; i + 5 < p.length; i += 3) {
    if (segmentIntersectsRect(p[i]!, p[i + 1]!, p[i + 3]!, p[i + 4]!, r)) return true;
  }
  return false;
}

/**
 * מחיקת אזור: מסיר מהקו את הנקודות שבתוך עיגול המחק.
 * מחזיר null אם הקו לא נפגע, אחרת רשימת הקווים שנשארו (0 או יותר).
 * הקווים שנשארו מקבלים מזהים חדשים.
 */
export function eraseInkCircle(
  obj: InkObject,
  cx: number,
  cy: number,
  radius: number,
): InkObject[] | null {
  const px = cx - obj.transform.x;
  const py = cy - obj.transform.y;
  const reach = radius + obj.style.width / 2;
  const reachSq = reach * reach;
  const p = obj.points;

  // נקודה נמחקת אם היא בתוך העיגול. מוסיפים נקודות ביניים בקטעים ארוכים,
  // כדי שמחיקה באמצע קטע ארוך (למשל קו ישר) תחתוך אותו.
  const step = Math.max(1, radius / 2);
  const kept: number[][] = [];
  let current: number[] = [];
  let hit = false;

  const pushPoint = (x: number, y: number, pr: number) => {
    const dx = x - px;
    const dy = y - py;
    if (dx * dx + dy * dy <= reachSq) {
      hit = true;
      if (current.length > 0) kept.push(current);
      current = [];
    } else {
      current.push(x, y, pr);
    }
  };

  for (let i = 0; i < p.length; i += 3) {
    const x = p[i]!;
    const y = p[i + 1]!;
    const pr = p[i + 2]!;
    if (i > 0) {
      const lx = p[i - 3]!;
      const ly = p[i - 2]!;
      const lp = p[i - 1]!;
      const dist = Math.hypot(x - lx, y - ly);
      const n = Math.floor(dist / step);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        pushPoint(lx + (x - lx) * t, ly + (y - ly) * t, lp + (pr - lp) * t);
      }
    }
    pushPoint(x, y, pr);
  }
  if (!hit) return null;
  if (current.length > 0) kept.push(current);

  return kept.filter((pts) => pts.length >= 6).map((pts) => ({ ...obj, id: newId(), points: pts }));
}

/** מסיר נקודות כמעט כפולות, כדי לא לשמור מידע מיותר. */
export function simplifyClosePoints(points: number[], minDist: number): number[] {
  if (points.length <= 6) return points.slice();
  const out = [points[0]!, points[1]!, points[2]!];
  const minSq = minDist * minDist;
  for (let i = 3; i < points.length; i += 3) {
    const lx = out[out.length - 3]!;
    const ly = out[out.length - 2]!;
    const dx = points[i]! - lx;
    const dy = points[i + 1]! - ly;
    const isLast = i === points.length - 3;
    if (dx * dx + dy * dy >= minSq || isLast) out.push(points[i]!, points[i + 1]!, points[i + 2]!);
  }
  return out;
}
