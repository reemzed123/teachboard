import { getStroke, type StrokeOptions } from 'perfect-freehand';
import type { InkKind } from '../../core/document/types';

/** כמה הלחץ משפיע על העובי (0 = לא משפיע) */
export const PEN_THINNING = 0.6;

// הופך את נקודות המרכז של הקו (עם לחץ) לצורה ממולאת – כך נוצרת תחושת כתיבה טבעית.

export function strokeOptions(
  kind: InkKind,
  width: number,
  pressure: boolean,
  last: boolean,
): StrokeOptions {
  if (kind === 'highlighter') {
    return {
      size: width,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0,
      simulatePressure: false,
      last,
    };
  }
  // בלי "streamline": ההחלקה כבר נעשתה בזמן הכתיבה ובייפוי (core/ink/smoothing),
  // ו-streamline גורם לקו "להיגרר" אחרי העט.
  return {
    size: width,
    thinning: pressure ? PEN_THINNING : 0,
    smoothing: 0.5,
    streamline: 0,
    simulatePressure: false,
    last,
  };
}

/** flat [x,y,p,...] → [[x,y,p], ...] */
export function toTriples(points: readonly number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 2 < points.length; i += 3)
    out.push([points[i]!, points[i + 1]!, points[i + 2]!]);
  return out;
}

/** מצולע המתאר של הקו (לייצוא וקטורי ל-PDF) */
export function outlinePolygon(
  points: readonly number[],
  kind: InkKind,
  width: number,
  pressure: boolean,
): number[][] {
  return getStroke(toTriples(points), strokeOptions(kind, width, pressure, true));
}

/** מצולע → נתיב SVG עם עקומות חלקות (אותה צורה כמו על המסך) */
export function polygonToSvgPath(poly: number[][]): string {
  const n = poly.length;
  if (n < 3) return '';
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  const mid = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  const start = mid(poly[0]!, poly[1]!);
  let d = `M${f(start[0]!)} ${f(start[1]!)}`;
  for (let i = 1; i <= n; i++) {
    const a = poly[i % n]!;
    const m = mid(a, poly[(i + 1) % n]!);
    d += `Q${f(a[0]!)} ${f(a[1]!)} ${f(m[0]!)} ${f(m[1]!)}`;
  }
  return d + 'Z';
}

export function outlinePath(
  points: readonly number[],
  kind: InkKind,
  width: number,
  pressure: boolean,
  last: boolean,
): Path2D {
  const outline = getStroke(toTriples(points), strokeOptions(kind, width, pressure, last));
  return polygonToPath(outline);
}

/** מצולע → Path2D עם עקומות חלקות בין נקודות האמצע (מראה עגול ונקי). */
export function polygonToPath(poly: number[][]): Path2D {
  const path = new Path2D();
  const n = poly.length;
  if (n === 0) return path;
  if (n < 3) {
    const [x, y] = poly[0]!;
    path.arc(x!, y!, 0.5, 0, Math.PI * 2);
    return path;
  }
  const first = poly[0]!;
  const second = poly[1]!;
  path.moveTo((first[0]! + second[0]!) / 2, (first[1]! + second[1]!) / 2);
  for (let i = 1; i <= n; i++) {
    const a = poly[i % n]!;
    const b = poly[(i + 1) % n]!;
    path.quadraticCurveTo(a[0]!, a[1]!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2);
  }
  path.closePath();
  return path;
}
