import { bisect, findRoots } from './numeric';
import type { RealFn } from './parse';

// חקירת פונקציה נומרית: נקודות קיצון ואסימפטוטות אנכיות בתחום [a, b].

export interface Extremum {
  x: number;
  y: number;
  kind: 'max' | 'min';
}

export const MAX_ANALYSIS_POINTS = 30;

/** נקודות קיצון: הנגזרת (נומרית, מרכזית) מחליפה סימן, והפונקציה רציפה שם */
export function extrema(f: RealFn, a: number, b: number, samples = 2000): Extremum[] {
  const span = b - a;
  const h = span * 1e-6;
  const d: RealFn = (x) => (f(x + h) - f(x - h)) / (2 * h);
  const step = span / samples;
  const out: Extremum[] = [];
  let x0 = a;
  let d0 = d(x0);
  for (let i = 1; i <= samples && out.length < MAX_ANALYSIS_POINTS; i++) {
    const x1 = a + i * step;
    const d1 = d(x1);
    if (Number.isFinite(d0) && Number.isFinite(d1) && d0 !== 0 && Math.sign(d0) !== Math.sign(d1)) {
      const r = d1 === 0 ? x1 : bisect(d, x0, x1);
      const y = f(r);
      // רציפה: הערכים משני הצדדים קרובים לערך בנקודה (לא אסימפטוטה כמו ב-1/x²)
      const yl = f(r - step);
      const yr = f(r + step);
      const near = (v: number) =>
        Number.isFinite(v) && Math.abs(v - y) <= Math.abs(step) * (1 + Math.abs(y)) * 50;
      if (Number.isFinite(y) && near(yl) && near(yr)) {
        out.push({ x: r, y, kind: d0 > 0 ? 'max' : 'min' });
      }
    }
    x0 = x1;
    d0 = d1;
  }
  return out;
}

/** אסימפטוטות אנכיות: נקודות שבהן |f| שואף לאינסוף (שורשים של 1/f שבהם f עצומה משני הצדדים) */
export function verticalAsymptotes(f: RealFn, a: number, b: number): number[] {
  const span = b - a;
  const inv: RealFn = (x) => {
    const v = f(x);
    return Number.isFinite(v) ? 1 / v : Number.isNaN(v) ? NaN : 0;
  };
  const delta = span * 1e-6;
  const huge = (v: number) => (!Number.isFinite(v) ? !Number.isNaN(v) : Math.abs(v) > 1e4);
  return findRoots(inv, a, b)
    .filter((r) => r > a + delta && r < b - delta)
    .filter((r) => huge(f(r - delta)) || huge(f(r + delta)))
    .slice(0, MAX_ANALYSIS_POINTS);
}
