import type { GeoElement, GeoKind, GeometryObject } from '../document/types';

// כלים טהורים לבנייה גיאומטרית: שמות, תלויות, מחיקה, ופתרון (מיקומים) לאחר חישוב.

/** תוצאת החישוב לכל אלמנט */
export type Solved =
  | { t: 'pt'; x: number; y: number }
  | { t: 'ln'; x1: number; y1: number; x2: number; y2: number; mode: 'segment' | 'line' | 'ray' }
  | { t: 'circ'; cx: number; cy: number; r: number }
  | { t: 'arc'; cx: number; cy: number; r: number; a0: number; a1: number }
  | { t: 'curve'; pts: number[] }
  | { t: 'poly'; pts: number[] }
  | { t: 'ang'; vx: number; vy: number; a0: number; sweep: number; deg: number }
  | { t: 'meas'; value: number; what: string; x: number; y: number }
  | { t: 'none' };

export type Solution = Map<string, Solved>;

export const POINT_KINDS: ReadonlySet<GeoKind> = new Set([
  'point',
  'glider',
  'midpoint',
  'intersection',
  'foot',
  'regularVertex',
]);
export const LINE_KINDS: ReadonlySet<GeoKind> = new Set([
  'segment',
  'line',
  'ray',
  'parallel',
  'perpendicular',
  'perpBisector',
  'angleBisector',
]);
export const CURVE_KINDS: ReadonlySet<GeoKind> = new Set([
  'circle',
  'circleR',
  'circle3',
  'arc',
  'ellipse',
]);

/** האם האלמנט "חופשי" – אפשר לגרור אותו ישירות */
export function isDraggable(e: GeoElement): boolean {
  return e.kind === 'point' || e.kind === 'glider';
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** השם הפנוי הבא לנקודה: A, B, … Z, A₁, B₁ … */
export function nextPointLabel(elements: readonly GeoElement[]): string {
  const used = new Set(elements.map((e) => e.style.label).filter(Boolean));
  for (let round = 0; round < 100; round++) {
    for (const L of LETTERS) {
      const name = round === 0 ? L : `${L}${round}`;
      if (!used.has(name)) return name;
    }
  }
  return `P${elements.length}`;
}

/** כל האלמנטים שתלויים (ישירות או בעקיפין) באלמנטים שנבחרו – כולל אותם */
export function withDependents(
  elements: readonly GeoElement[],
  ids: readonly string[],
): Set<string> {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of elements) {
      if (!out.has(e.id) && e.parents.some((p) => out.has(p))) {
        out.add(e.id);
        grew = true;
      }
    }
  }
  return out;
}

/** מוחק אלמנטים ואת כל מה שנבנה עליהם */
export function removeElements(
  elements: readonly GeoElement[],
  ids: readonly string[],
): GeoElement[] {
  const gone = withDependents(elements, ids);
  return elements.filter((e) => !gone.has(e.id));
}

// ---------- חישובים מספריים ----------

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** שטח מצולע (נוסחת השרוך) */
export function polygonArea(pts: readonly number[]): number {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i * 2]! * pts[j * 2 + 1]! - pts[j * 2]! * pts[i * 2 + 1]!;
  }
  return Math.abs(a) / 2;
}

export function polygonPerimeter(pts: readonly number[]): number {
  let p = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p += dist(pts[i * 2]!, pts[i * 2 + 1]!, pts[j * 2]!, pts[j * 2 + 1]!);
  }
  return p;
}

/**
 * זווית ABC בקודקוד B: הזווית הקטנה (0–180), כיוון ההתחלה וגודל הסיבוב (לציור הקשת).
 */
export function angleAt(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const a0 = Math.atan2(ay - by, ax - bx);
  const a1 = Math.atan2(cy - by, cx - bx);
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  return { a0, sweep, deg: (Math.abs(sweep) * 180) / Math.PI };
}

/** יחידות התצוגה: 1 ס"מ = 37.8 יחידות לוח (96 נקודות לאינץ') */
export const UNITS_PER_CM = 96 / 2.54;

export function solvedBounds(sol: Solution): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const s of sol.values()) {
    if (s.t === 'pt') add(s.x, s.y);
    else if (s.t === 'ln' && s.mode === 'segment') {
      add(s.x1, s.y1);
      add(s.x2, s.y2);
    } else if (s.t === 'circ' || s.t === 'arc') {
      add(s.cx - s.r, s.cy - s.r);
      add(s.cx + s.r, s.cy + s.r);
    } else if (s.t === 'curve' || s.t === 'poly') {
      for (let i = 0; i + 1 < s.pts.length; i += 2) add(s.pts[i]!, s.pts[i + 1]!);
    }
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  const pad = 12;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

export function emptyGeometry(id: string): GeometryObject {
  return {
    id,
    type: 'geometry',
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    elements: [],
    extent: { x: 0, y: 0, width: 0, height: 0 },
  };
}

// ---------- פגיעה (מה נמצא מתחת לעט) ----------

export type HitType = 'point' | 'line' | 'circle' | 'segment' | 'polygon' | 'any';

function segDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mode: 'segment' | 'line' | 'ray',
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  if (mode === 'segment') t = Math.max(0, Math.min(1, t));
  else if (mode === 'ray') t = Math.max(0, t);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** המרחק מנקודה לאלמנט (Infinity אם לא רלוונטי) */
export function distanceTo(s: Solved, x: number, y: number): number {
  switch (s.t) {
    case 'pt':
      return Math.hypot(s.x - x, s.y - y);
    case 'ln':
      return segDist(x, y, s.x1, s.y1, s.x2, s.y2, s.mode);
    case 'circ':
      return Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r);
    case 'arc': {
      const a = Math.atan2(y - s.cy, x - s.cx);
      let a1 = s.a1;
      while (a1 <= s.a0) a1 += Math.PI * 2;
      let aa = a;
      while (aa < s.a0) aa += Math.PI * 2;
      return aa <= a1 ? Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r) : Infinity;
    }
    case 'curve':
    case 'poly': {
      let best = Infinity;
      const n = s.pts.length / 2;
      const last = s.t === 'poly' ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const j = (i + 1) % n;
        best = Math.min(
          best,
          segDist(
            x,
            y,
            s.pts[i * 2]!,
            s.pts[i * 2 + 1]!,
            s.pts[j * 2]!,
            s.pts[j * 2 + 1]!,
            'segment',
          ),
        );
      }
      return best;
    }
    case 'ang':
      return Math.hypot(s.vx - x, s.vy - y) < 34 ? 10 : Infinity;
    default:
      return Infinity;
  }
}

function matches(e: GeoElement, s: Solved, type: HitType): boolean {
  switch (type) {
    case 'point':
      return s.t === 'pt';
    case 'line':
      return s.t === 'ln';
    case 'segment':
      return s.t === 'ln' && s.mode === 'segment';
    case 'circle':
      return s.t === 'circ' || s.t === 'arc' || s.t === 'curve';
    case 'polygon':
      return s.t === 'poly' || s.t === 'circ';
    case 'any':
      return s.t !== 'none' && !e.style.hidden;
  }
}

/**
 * האלמנט הקרוב ביותר מהסוג המבוקש, בטווח tol.
 * נקודות מקבלות עדיפות (כדי שאפשר יהיה לתפוס נקודה שיושבת על קו).
 */
export function hitElement(
  elements: readonly GeoElement[],
  sol: Solution,
  x: number,
  y: number,
  tol: number,
  type: HitType,
): GeoElement | null {
  let best: GeoElement | null = null;
  let bestD = Infinity;
  for (const e of elements) {
    if (e.style.hidden) continue;
    const s = sol.get(e.id);
    if (!s || !matches(e, s, type)) continue;
    const d = distanceTo(s, x, y) - (s.t === 'pt' ? tol : 0);
    if (d <= tol && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** נקודות חופשיות שהאלמנט נבנה עליהן (כדי להזיז קטע/מצולע שלם) */
export function freeAncestors(elements: readonly GeoElement[], id: string): string[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const out = new Set<string>();
  const visit = (eid: string) => {
    const e = byId.get(eid);
    if (!e) return;
    if (e.kind === 'point') out.add(e.id);
    else e.parents.forEach(visit);
  };
  visit(id);
  return [...out];
}
