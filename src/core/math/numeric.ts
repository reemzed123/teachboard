import type { RealFn } from './parse';

// חישובים מספריים לגרפים: נקודות חיתוך, טבלת ערכים, עיגול להצגה.

const finite = (v: number) => Number.isFinite(v);

/** חיפוש בינארי לשורש בין a ל-b (כש-f מחליפה סימן) */
export function bisect(f: RealFn, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

/** מינימום של |f| בקטע (לשורשים "משיקים", כמו x² ב-0) */
function goldenMinAbs(f: RealFn, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  for (let i = 0; i < 60; i++) {
    if (Math.abs(f(c)) < Math.abs(f(d))) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

/**
 * נקודות שבהן f(x)=0 בתחום [a, b].
 * מוצא גם החלפת סימן וגם נגיעה באפס (שורש כפול). מתעלם מקפיצות של אסימפטוטה (כמו tan).
 */
export function findRoots(f: RealFn, a: number, b: number, samples = 2000): number[] {
  const roots: number[] = [];
  const step = (b - a) / samples;
  const tol = Math.max(1e-9, (b - a) * 1e-9);
  /** "אפס" לצורך זיהוי קטע שבו הפונקציה מתאפסת לגמרי (למשל f−g כששתי הפונקציות זהות) */
  const zero = (v: number) => Math.abs(v) < 1e-12;
  /** קטעים שבהם הפונקציה אפס ברצף – אין בהם "נקודות" חיתוך */
  const flat: [number, number][] = [];
  const add = (r: number) => {
    if (!finite(r) || r < a - tol || r > b + tol) return;
    const v = f(r);
    if (!finite(v) || Math.abs(v) > 1e-6 * Math.max(1, b - a)) return;
    if (roots.every((q) => Math.abs(q - r) > step * 0.5)) roots.push(r);
  };
  let x0 = a;
  let y0 = f(x0);
  let prevAbs = Math.abs(y0);
  let falling = false;
  for (let i = 1; i <= samples; i++) {
    const x1 = a + i * step;
    const y1 = f(x1);
    if (finite(y0) && finite(y1)) {
      if (zero(y0) && zero(y1)) {
        const last = flat[flat.length - 1];
        if (last && Math.abs(last[1] - x0) < step * 0.5) last[1] = x1;
        else flat.push([x0, x1]);
      } else if (y0 === 0) add(x0);
      else if (Math.sign(y0) !== Math.sign(y1) && y1 !== 0) {
        const r = bisect(f, x0, x1);
        // החלפת סימן "אמיתית" ולא קפיצה (אסימפטוטה): הערך בשורש קטן
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) add(r);
      }
      // מינימום מקומי של |f| שנוגע ב-0 (שורש כפול)
      const abs1 = Math.abs(y1);
      if (falling && abs1 > prevAbs) add(goldenMinAbs(f, x0 - step, x1));
      falling = abs1 < prevAbs;
      prevAbs = abs1;
    } else {
      falling = false;
      prevAbs = Infinity;
    }
    x0 = x1;
    y0 = y1;
  }
  if (finite(y0) && y0 === 0) add(x0);
  const inFlat = (r: number) => flat.some(([p, q]) => r >= p - step && r <= q + step);
  // הגנה: פונקציה שמתנודדת מהר מאוד – לא יותר מ-MAX_ROOTS נקודות
  return roots
    .filter((r) => !inFlat(r))
    .sort((p, q) => p - q)
    .slice(0, MAX_ROOTS);
}

/** מספר מקסימלי של שורשים/חיתוכים שמוחזרים (מונע הצפה של הגרף) */
export const MAX_ROOTS = 50;

/** נקודות החיתוך של שתי פונקציות */
export function intersections(
  f: RealFn,
  g: RealFn,
  a: number,
  b: number,
): { x: number; y: number }[] {
  return findRoots((x) => f(x) - g(x), a, b).map((x) => ({ x, y: f(x) }));
}

/** עיגול להצגה: עד 2 ספרות אחרי הנקודה, בלי אפסים מיותרים ובלי "‎-0" */
export function formatNumber(v: number, digits = 2): string {
  if (!finite(v)) return '—';
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const out = (Object.is(r, -0) ? 0 : r).toFixed(digits).replace(/\.?0+$/, '');
  return out === '-0' ? '0' : out;
}

export interface TableRow {
  x: number;
  y: number;
}

export function valueTable(f: RealFn, from: number, step: number, count: number): TableRow[] {
  const rows: TableRow[] = [];
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  for (let i = 0; i < n; i++) {
    const x = Math.round((from + i * step) * 1e9) / 1e9;
    rows.push({ x, y: f(x) });
  }
  return rows;
}

/** מרווח "נעים" בין שנתות (1, 2, 5, 10...) כך שיהיו בערך target שנתות */
export function niceStep(range: number, target = 10): number {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = Math.round((raw / mag) * 1e9) / 1e9;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return Number((nice * mag).toPrecision(12));
}
