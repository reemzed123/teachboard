import type { GraphObject } from '../document/types';
import type { Point } from '../geometry/rect';
import { toLocal } from '../geometry/transform';

// שינויי תצוגה של מערכת צירים: הגדלת המסגרת מרחיבה את התחום (רואים יותר מהמישור),
// זום והזזה בתוך המערכת.

export const FUNCTION_NAMES = ['f', 'g', 'h', 'k', 'p', 'q', 'r', 's'] as const;

export function functionName(index: number): string {
  return FUNCTION_NAMES[index] ?? `f${index + 1}`;
}

/**
 * שינוי גודל המסגרת סביב נקודת ציר (pivot, בקואורדינטות לוח) ביחס k.
 * המספרים והקווים נשארים באותו גודל; התחום גדל/קטן בהתאם, והנקודה שמתחת ל-pivot נשארת במקומה.
 */
export function resizeGraph(g: GraphObject, pivot: Point, k: number): GraphObject {
  const { xMin, xMax, yMin, yMax } = g.range;
  const local = toLocal(g.transform, pivot.x, pivot.y);
  const fx = local.x / g.width;
  const fy = local.y / g.height;
  const spanX = xMax - xMin;
  const spanY = yMax - yMin;
  const ax = xMin + fx * spanX;
  const ay = yMax - fy * spanY;
  const nxMin = ax - fx * spanX * k;
  const nyMax = ay + fy * spanY * k;
  return {
    ...g,
    width: g.width * k,
    height: g.height * k,
    range: { xMin: nxMin, xMax: nxMin + spanX * k, yMin: nyMax - spanY * k, yMax: nyMax },
    transform: {
      ...g.transform,
      x: pivot.x + (g.transform.x - pivot.x) * k,
      y: pivot.y + (g.transform.y - pivot.y) * k,
    },
  };
}

/** זום סביב מרכז התחום (factor < 1 = התקרבות) */
export function zoomGraph(g: GraphObject, factor: number): GraphObject['range'] {
  const { xMin, xMax, yMin, yMax } = g.range;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const hx = ((xMax - xMin) / 2) * factor;
  const hy = ((yMax - yMin) / 2) * factor;
  return { xMin: cx - hx, xMax: cx + hx, yMin: cy - hy, yMax: cy + hy };
}

/** הזזת התחום בחלק מגודלו (dx, dy ביחידות של "רוחב התחום") */
export function panGraph(g: GraphObject, dx: number, dy: number): GraphObject['range'] {
  const { xMin, xMax, yMin, yMax } = g.range;
  const sx = (xMax - xMin) * dx;
  const sy = (yMax - yMin) * dy;
  return { xMin: xMin + sx, xMax: xMax + sx, yMin: yMin + sy, yMax: yMax + sy };
}

/** תחום התחלתי: הראשית במרכז, יחידות שוות בשני הצירים */
export function defaultRange(width: number, height: number): GraphObject['range'] {
  const half = 8;
  const hy = (half * height) / width;
  return { xMin: -half, xMax: half, yMin: -hy, yMax: hy };
}
