import { getStroke, type StrokeOptions } from 'perfect-freehand';
import type { InkKind } from '../../core/document/types';

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
      streamline: 0.45,
      simulatePressure: false,
      last,
    };
  }
  return {
    size: width,
    thinning: pressure ? 0.6 : 0,
    smoothing: 0.5,
    streamline: 0.32,
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
