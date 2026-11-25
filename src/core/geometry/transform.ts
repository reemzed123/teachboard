import type { Transform } from '../document/types';
import type { Point, Rect } from './rect';

// המרת נקודות בין מערכת הצירים המקומית של אובייקט לבין הלוח.

const DEG = Math.PI / 180;

export function toWorld(t: Transform, x: number, y: number): Point {
  const c = Math.cos(t.rotation * DEG) * t.scale;
  const s = Math.sin(t.rotation * DEG) * t.scale;
  return { x: t.x + x * c - y * s, y: t.y + x * s + y * c };
}

export function toLocal(t: Transform, x: number, y: number): Point {
  const dx = x - t.x;
  const dy = y - t.y;
  const c = Math.cos(-t.rotation * DEG) / t.scale;
  const s = Math.sin(-t.rotation * DEG) / t.scale;
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** המלבן התוחם (בלוח) של מלבן מקומי אחרי סיבוב וקנה מידה */
export function worldBounds(t: Transform, local: Rect): Rect {
  const pts = [
    toWorld(t, local.x, local.y),
    toWorld(t, local.x + local.width, local.y),
    toWorld(t, local.x, local.y + local.height),
    toWorld(t, local.x + local.width, local.y + local.height),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * מפעיל על אובייקט הזזה/סיבוב/הגדלה סביב נקודת ציר (לעריכת בחירה).
 * angle במעלות, k = יחס הגדלה.
 */
export function transformAround(
  t: Transform,
  pivot: Point,
  angle: number,
  k: number,
  dx = 0,
  dy = 0,
): Transform {
  const c = Math.cos(angle * DEG) * k;
  const s = Math.sin(angle * DEG) * k;
  const rx = t.x - pivot.x;
  const ry = t.y - pivot.y;
  return {
    x: pivot.x + rx * c - ry * s + dx,
    y: pivot.y + rx * s + ry * c + dy,
    rotation: normalizeAngle(t.rotation + angle),
    scale: t.scale * k,
  };
}

export function normalizeAngle(a: number): number {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return Math.round(r * 1000) / 1000;
}
