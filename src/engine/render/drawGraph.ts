import type { GraphObject, TableObject } from '../../core/document/types';
import { extrema, verticalAsymptotes } from '../../core/math/analysis';
import { findRoots, formatNumber, intersections, niceStep } from '../../core/math/numeric';
import { compileExpression, type RealFn } from '../../core/math/parse';

// ציור מערכת צירים וגרפים בתוך מלבן האובייקט (קואורדינטות מקומיות).

const fnCache = new Map<string, RealFn | null>();

/** הפונקציה המחושבת לביטוי (או null אם לא ניתן לפענח) */
export function functionFor(latex: string): RealFn | null {
  if (!fnCache.has(latex)) {
    try {
      fnCache.set(latex, compileExpression(latex));
    } catch {
      fnCache.set(latex, null);
    }
    if (fnCache.size > 500) fnCache.delete(fnCache.keys().next().value!);
  }
  return fnCache.get(latex) ?? null;
}

const FONT = '"Heebo Variable", "Segoe UI", Arial, sans-serif';

export interface GraphPoint {
  x: number;
  y: number;
  color: string;
  /** נקודת קיצון (מוצגת עם max / min) */
  kind?: 'max' | 'min';
}

/** אסימפטוטה אנכית: x וצבע הפונקציה */
export interface GraphAsymptote {
  x: number;
  color: string;
}

const asymptoteCache = new WeakMap<GraphObject, GraphAsymptote[]>();

/** האסימפטוטות האנכיות שמוצגות (מחושבות פעם אחת לכל גרסה של הגרף) */
export function graphAsymptotes(o: GraphObject): GraphAsymptote[] {
  if (!o.showAsymptotes) return [];
  let out = asymptoteCache.get(o);
  if (!out) {
    out = [];
    for (const f of o.functions) {
      const fn = f.visible ? functionFor(f.latex) : null;
      if (!fn) continue;
      for (const x of verticalAsymptotes(fn, o.range.xMin, o.range.xMax))
        out.push({ x, color: f.color });
    }
    asymptoteCache.set(o, out);
  }
  return out;
}

/** נקודות החיתוך שמוצגות (עם הצירים ובין הגרפים) */
/** מטמון: הגרף לא משתנה (אובייקט חדש בכל שינוי), אז לא מחשבים שוב בכל ציור */
const pointsCache = new WeakMap<GraphObject, GraphPoint[]>();

export function graphPoints(o: GraphObject): GraphPoint[] {
  let pts = pointsCache.get(o);
  if (!pts) {
    pts = computeGraphPoints(o);
    pointsCache.set(o, pts);
  }
  return pts;
}

function computeGraphPoints(o: GraphObject): GraphPoint[] {
  const { xMin, xMax, yMin, yMax } = o.range;
  const fns = o.functions
    .filter((f) => f.visible)
    .map((f) => ({ f, fn: functionFor(f.latex) }))
    .filter((e): e is { f: (typeof o.functions)[number]; fn: RealFn } => !!e.fn);
  const pts: GraphPoint[] = [];
  const inside = (x: number, y: number) =>
    x >= xMin && x <= xMax && y >= yMin && y <= yMax && Number.isFinite(y);
  if (o.showIntercepts) {
    for (const { f, fn } of fns) {
      for (const r of findRoots(fn, xMin, xMax)) pts.push({ x: r, y: 0, color: f.color });
      if (xMin <= 0 && xMax >= 0) {
        const y0 = fn(0);
        if (inside(0, y0)) pts.push({ x: 0, y: y0, color: f.color });
      }
    }
  }
  if (o.showExtrema) {
    for (const { f, fn } of fns) {
      for (const e of extrema(fn, xMin, xMax)) {
        if (inside(e.x, e.y)) pts.push({ x: e.x, y: e.y, color: f.color, kind: e.kind });
      }
    }
  }
  if (o.showIntersections) {
    for (let i = 0; i < fns.length; i++) {
      for (let j = i + 1; j < fns.length; j++) {
        for (const p of intersections(fns[i]!.fn, fns[j]!.fn, xMin, xMax)) {
          if (inside(p.x, p.y)) pts.push({ ...p, color: '#1c2430' });
        }
      }
    }
  }
  // בלי כפילויות (למשל חיתוך בראשית שהוא גם חיתוך עם הצירים)
  const eps = (xMax - xMin) / 1000;
  return pts.filter(
    (p, i) => pts.findIndex((q) => Math.abs(q.x - p.x) < eps && Math.abs(q.y - p.y) < eps) === i,
  );
}

export function drawGraph(ctx: CanvasRenderingContext2D, o: GraphObject): void {
  const W = o.width;
  const H = o.height;
  const { xMin, xMax, yMin, yMax } = o.range;
  const X = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const Y = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  const sx = niceStep(xMax - xMin, Math.max(4, W / 70));
  const sy = niceStep(yMax - yMin, Math.max(4, H / 70));

  if (o.grid) {
    ctx.strokeStyle = 'rgba(37,72,128,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(xMin / sx) * sx; x <= xMax; x += sx) {
      ctx.moveTo(X(x), 0);
      ctx.lineTo(X(x), H);
    }
    for (let y = Math.ceil(yMin / sy) * sy; y <= yMax; y += sy) {
      ctx.moveTo(0, Y(y));
      ctx.lineTo(W, Y(y));
    }
    ctx.stroke();
  }

  // צירים (או קצה המלבן אם 0 מחוץ לתחום)
  const ax = Math.min(Math.max(X(0), 0), W);
  const ay = Math.min(Math.max(Y(0), 0), H);
  ctx.strokeStyle = '#1c2430';
  ctx.fillStyle = '#1c2430';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, ay);
  ctx.lineTo(W, ay);
  ctx.moveTo(ax, H);
  ctx.lineTo(ax, 0);
  ctx.stroke();
  const arrow = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * 9 - dy * 4.5, y - dy * 9 + dx * 4.5);
    ctx.lineTo(x - dx * 9 + dy * 4.5, y - dy * 9 - dx * 4.5);
    ctx.closePath();
    ctx.fill();
  };
  arrow(W, ay, 1, 0);
  arrow(ax, 0, 0, -1);

  // מספרים על הצירים
  ctx.font = `12px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillStyle = 'rgba(20,28,40,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(xMin / sx) * sx; x <= xMax - sx * 0.3; x += sx) {
    if (Math.abs(x) < sx / 2) continue;
    ctx.fillText(formatNumber(x), X(x), Math.min(ay + 4, H - 14));
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax - sy * 0.3; y += sy) {
    if (Math.abs(y) < sy / 2) continue;
    ctx.fillText(formatNumber(y), Math.max(ax - 4, 26), Y(y));
  }

  // הגרפים: דגימה צפופה, וקטיעה בקפיצות (אסימפטוטות) ובנקודות לא מוגדרות
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const f of o.functions) {
    if (!f.visible) continue;
    const fn = functionFor(f.latex);
    if (!fn) continue;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = f.width;
    ctx.beginPath();
    const n = Math.max(200, Math.round(W * 2));
    let pen = false;
    let prevY = 0;
    for (let i = 0; i <= n; i++) {
      const x = xMin + ((xMax - xMin) * i) / n;
      const y = fn(x);
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      const py = Y(y);
      if (pen && Math.abs(py - prevY) > H * 1.5) pen = false;
      if (pen) ctx.lineTo(X(x), Math.max(-H, Math.min(2 * H, py)));
      else ctx.moveTo(X(x), Math.max(-H, Math.min(2 * H, py)));
      pen = true;
      prevY = py;
    }
    ctx.stroke();
  }

  // אסימפטוטות אנכיות: קו מקווקו בצבע הפונקציה, עם x = …
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const a of graphAsymptotes(o)) {
    ctx.strokeStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(X(a.x), 0);
    ctx.lineTo(X(a.x), H);
    ctx.stroke();
    ctx.fillStyle = a.color;
    ctx.fillText(`x = ${formatNumber(a.x)}`, X(a.x) + 4, 6);
  }
  ctx.restore();

  // נקודות חיתוך עם תוויות
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const placed: LabelRect[] = [];
  for (const p of graphPoints(o)) {
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.color;
    ctx.stroke();
    ctx.fillStyle = '#1c2430';
    const coords = `(${formatNumber(p.x)}, ${formatNumber(p.y)})`;
    const text = p.kind ? `${p.kind} ${coords}` : coords;
    const pos = placeLabel(placed, X(p.x), Y(p.y), ctx.measureText(text).width, 14);
    ctx.fillText(text, pos.x, pos.y);
  }
  ctx.restore();

  ctx.strokeStyle = '#c3cbd6';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);
}

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: LabelRect, b: LabelRect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * מיקום לתווית של נקודה (px, py) שלא עולה על תוויות קודמות:
 * מעל-ימין; אם תפוס – מתחת-ימין; אחר כך מעל-שמאל ומתחת-שמאל. מחזיר את נקודת הבסיס לכתיבה.
 */
export function placeLabel(
  placed: LabelRect[],
  px: number,
  py: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const options = [
    { x: px + 6, y: py - 4 },
    { x: px + 6, y: py + 4 + h },
    { x: px - 6 - w, y: py - 4 },
    { x: px - 6 - w, y: py + 4 + h },
  ];
  const rectOf = (o: { x: number; y: number }) => ({ x: o.x, y: o.y - h, w, h });
  const free = options.find((o) => !placed.some((r) => overlaps(r, rectOf(o)))) ?? options[0]!;
  placed.push(rectOf(free));
  return free;
}

export function drawTable(ctx: CanvasRenderingContext2D, o: TableObject): void {
  const cols = Math.max(0, ...o.rows.map((r) => r.length));
  const W = cols * o.cellWidth;
  const H = o.rows.length * o.cellHeight;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const header = o.header !== false;
  if (header) {
    ctx.fillStyle = 'rgba(37,99,235,0.08)';
    ctx.fillRect(0, 0, W, o.cellHeight);
  }
  ctx.strokeStyle = '#9aa6b5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r <= o.rows.length; r++) {
    ctx.moveTo(0, r * o.cellHeight);
    ctx.lineTo(W, r * o.cellHeight);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(c * o.cellWidth, 0);
    ctx.lineTo(c * o.cellWidth, H);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.color;
  o.rows.forEach((row, r) => {
    ctx.font = `${r === 0 && header ? 700 : 400} ${o.fontSize}px ${FONT}`;
    // עמודות מימין לשמאל (כמו טבלה בעברית), או משמאל לימין (לוח 100)
    row.forEach((cell, c) => {
      ctx.direction = /[֐-׿]/.test(cell) ? 'rtl' : 'ltr';
      const x = o.dir === 'ltr' ? (c + 0.5) * o.cellWidth : W - (c + 0.5) * o.cellWidth;
      ctx.fillText(cell, x, (r + 0.5) * o.cellHeight);
    });
  });
}
