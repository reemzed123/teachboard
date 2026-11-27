// כלי מדידה ושרטוט וירטואליים (סרגל, מד-זווית, משולש, מחוגה) – גיאומטריה טהורה.
// המיקום והסיבוב בקואורדינטות לוח. הכלים לא נשמרים בשיעור (כמו כלים אמיתיים על השולחן).

import { UNITS_PER_CM } from './geometry/construction';

export interface Placed {
  x: number;
  y: number;
  /** סיבוב במעלות */
  angle: number;
}

export interface CompassState {
  cx: number;
  cy: number;
  r: number;
  /** כיוון זרוע העיפרון (מעלות) */
  angle: number;
}

export interface Instruments {
  ruler?: Placed;
  protractor?: Placed;
  setSquare?: Placed & { kind: '45' | '60' };
  compass?: CompassState;
}

export const RULER = { length: 15 * UNITS_PER_CM + 40, width: 64, pad: 20 } as const;
export const PROTRACTOR_R = 5.5 * UNITS_PER_CM;
export const SET_SQUARE = 9 * UNITS_PER_CM;

export interface Pt {
  x: number;
  y: number;
}
export interface Edge {
  a: Pt;
  b: Pt;
}

/** נקודה מקומית של כלי → קואורדינטות לוח */
export function place(p: Placed, lx: number, ly: number): Pt {
  const r = (p.angle * Math.PI) / 180;
  return {
    x: p.x + lx * Math.cos(r) - ly * Math.sin(r),
    y: p.y + lx * Math.sin(r) + ly * Math.cos(r),
  };
}

/** צורת המשולש (קואורדינטות מקומיות, הזווית הישרה בראשית) */
export function setSquareCorners(kind: '45' | '60'): Pt[] {
  const a = SET_SQUARE;
  const b = kind === '45' ? a : a * Math.tan(Math.PI / 6);
  return [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: 0, y: -b },
  ];
}

/** הקצוות שאפשר לשרטט לאורכם (קואורדינטות לוח) */
export function drawingEdges(ins: Instruments): Edge[] {
  const out: Edge[] = [];
  if (ins.ruler) {
    // הקצה העליון של הסרגל (עם השנתות)
    const h = RULER.length / 2;
    out.push({
      a: place(ins.ruler, -h, -RULER.width / 2),
      b: place(ins.ruler, h, -RULER.width / 2),
    });
  }
  if (ins.setSquare) {
    const c = setSquareCorners(ins.setSquare.kind);
    for (let i = 0; i < 3; i++)
      out.push({
        a: place(ins.setSquare, c[i]!.x, c[i]!.y),
        b: place(ins.setSquare, c[(i + 1) % 3]!.x, c[(i + 1) % 3]!.y),
      });
  }
  if (ins.protractor) {
    // הקו הישר (הבסיס) של מד-הזווית
    out.push({
      a: place(ins.protractor, -PROTRACTOR_R, 0),
      b: place(ins.protractor, PROTRACTOR_R, 0),
    });
  }
  return out;
}

/** הקצה הקרוב לנקודה (בתוך tol), אם יש */
export function nearestEdge(edges: readonly Edge[], p: Pt, tol: number): Edge | null {
  let best: Edge | null = null;
  let bestD = tol;
  for (const e of edges) {
    const q = projectOnEdge(e, p);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** היטל נקודה על הקצה (נשאר בתוך אורך הקצה) */
export function projectOnEdge(e: Edge, p: Pt): Pt {
  const dx = e.b.x - e.a.x;
  const dy = e.b.y - e.a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - e.a.x) * dx + (p.y - e.a.y) * dy) / len2));
  return { x: e.a.x + t * dx, y: e.a.y + t * dy };
}

/** נקודות של קשת מחוגה (לקו בעט): מזווית a0 בסיבוב sweep (מעלות, יכול להיות שלילי) */
export function arcPoints(c: CompassState, a0: number, sweep: number, step = 2): Pt[] {
  const sweepAbs = Math.min(360, Math.abs(sweep));
  const n = Math.max(2, Math.ceil(sweepAbs / step));
  const dir = Math.sign(sweep) || 1;
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (dir * sweepAbs * i) / n) * Math.PI) / 180;
    out.push({ x: c.cx + c.r * Math.cos(a), y: c.cy + c.r * Math.sin(a) });
  }
  return out;
}

/** זווית מעודכנת בזמן סיבוב: מצטברת (כדי שאפשר יהיה להשלים מעגל שלם) */
export function unwrapAngle(prev: number, next: number): number {
  let d = next - prev;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return prev + d;
}
