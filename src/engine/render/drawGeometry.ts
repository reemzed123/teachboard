import type { GeoElement, GeometryObject } from '../../core/document/types';
import { UNITS_PER_CM, type Solved } from '../../core/geometry/construction';
import { formatNumber } from '../../core/math/numeric';
import { getSolution } from './geoCache';

// ציור בנייה גיאומטרית (קואורדינטות מקומיות של האובייקט).

const FONT = '"Heebo Variable", "Segoe UI", Arial, sans-serif';
/** אורך "אינסופי" לישר (ביחידות לוח) */
const FAR = 20000;

function lineEnds(s: Extract<Solved, { t: 'ln' }>): [number, number, number, number] {
  if (s.mode === 'segment') return [s.x1, s.y1, s.x2, s.y2];
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = (dx / len) * FAR;
  const uy = (dy / len) * FAR;
  return s.mode === 'ray'
    ? [s.x1, s.y1, s.x1 + ux, s.y1 + uy]
    : [s.x1 - ux, s.y1 - uy, s.x1 + ux, s.y1 + uy];
}

/** קווקווים קטנים בניצב לאמצע קטע (סימון קטעים שווים) */
function drawTicks(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  n: number,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 5;
    const cx = mx + ux * o;
    const cy = my + uy * o;
    ctx.moveTo(cx - uy * 7, cy + ux * 7);
    ctx.lineTo(cx + uy * 7, cy - ux * 7);
  }
  ctx.stroke();
}

/** חיצים קטנים באמצע קטע (סימון ישרים מקבילים) */
function drawParallelArrows(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  n: number,
) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const tx = mx + ux * (i * 7 - (n - 1) * 3.5 + 4);
    const ty = my + uy * (i * 7 - (n - 1) * 3.5 + 4);
    ctx.moveTo(tx - ux * 7 - uy * 5, ty - uy * 7 + ux * 5);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - ux * 7 + uy * 5, ty - uy * 7 - ux * 5);
  }
  ctx.stroke();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 15,
) {
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function measureText(e: GeoElement, s: Extract<Solved, { t: 'meas' }>): string {
  const cm = (v: number) => formatNumber(v / UNITS_PER_CM, 2);
  const area = (v: number) => formatNumber(v / UNITS_PER_CM ** 2, 2);
  switch (s.what) {
    case 'area':
      return `S = ${area(s.value)}`;
    case 'perimeter':
      return `P = ${cm(s.value)}`;
    case 'radius':
      return `r = ${cm(s.value)}`;
    case 'diameter':
      return `d = ${cm(s.value)}`;
    default:
      return e.style.label ? `${e.style.label} = ${cm(s.value)}` : cm(s.value);
  }
}

/** ציור הבנייה. selected = אלמנטים מודגשים (בעריכה). */
export function drawGeometry(
  ctx: CanvasRenderingContext2D,
  o: GeometryObject,
  selected?: ReadonlySet<string>,
): void {
  const sol = getSolution(o);
  if (!sol) return;
  const byId = new Map(o.elements.map((e) => [e.id, e]));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pass = (fn: (e: GeoElement, s: Solved) => void) => {
    for (const e of o.elements) {
      if (e.style.hidden) continue;
      const s = sol.get(e.id);
      if (s && s.t !== 'none') fn(e, s);
    }
  };
  const highlight = (e: GeoElement) => {
    if (!selected?.has(e.id)) return;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = e.style.width + 8;
    ctx.stroke();
    ctx.restore();
  };

  // 1. מילוי מצולעים ומעגלים
  pass((e, s) => {
    if (!e.style.fill) return;
    ctx.beginPath();
    if (s.t === 'poly') {
      ctx.moveTo(s.pts[0]!, s.pts[1]!);
      for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i]!, s.pts[i + 1]!);
      ctx.closePath();
    } else if (s.t === 'circ') ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
    else return;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = e.style.color;
    ctx.fill();
    ctx.restore();
  });

  // 2. קווים, מעגלים, עקומות, מצולעים
  pass((e, s) => {
    // מצולע עם עובי 0 – רק מילוי (הצלעות הן קטעים נפרדים)
    if (s.t === 'poly' && e.style.width === 0) return;
    ctx.strokeStyle = e.style.color;
    ctx.lineWidth = e.style.width;
    ctx.setLineDash(e.style.dash === 'dashed' ? [8, 6] : e.style.dash === 'dotted' ? [1, 5] : []);
    ctx.beginPath();
    if (s.t === 'ln') {
      const [x1, y1, x2, y2] = lineEnds(s);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else if (s.t === 'circ') ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
    else if (s.t === 'arc') {
      let a1 = s.a1;
      while (a1 <= s.a0) a1 += Math.PI * 2;
      ctx.arc(s.cx, s.cy, s.r, s.a0, a1);
    } else if (s.t === 'curve' || s.t === 'poly') {
      ctx.moveTo(s.pts[0]!, s.pts[1]!);
      for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i]!, s.pts[i + 1]!);
      if (s.t === 'poly') ctx.closePath();
    } else {
      ctx.setLineDash([]);
      return;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    highlight(e);
    if (s.t === 'ln' && s.mode === 'segment') {
      ctx.lineWidth = Math.max(1.5, e.style.width * 0.8);
      if (e.style.ticks) drawTicks(ctx, s.x1, s.y1, s.x2, s.y2, e.style.ticks);
      if (e.style.arrows) drawParallelArrows(ctx, s.x1, s.y1, s.x2, s.y2, e.style.arrows);
    }
    if (s.t === 'ln' && s.mode !== 'segment' && e.style.arrows) {
      drawParallelArrows(ctx, s.x1, s.y1, s.x2, s.y2, e.style.arrows);
    }
  });

  // 3. זוויות: קשת (או ריבוע לזווית ישרה) ומספר מעלות
  pass((e, s) => {
    if (s.t !== 'ang') return;
    ctx.strokeStyle = e.style.color;
    ctx.lineWidth = 1.6;
    const right = Math.abs(s.deg - 90) < 0.05;
    const r = 26;
    if (right) {
      const a = s.a0;
      const b = s.a0 + s.sweep;
      const k = 14;
      ctx.beginPath();
      ctx.moveTo(s.vx + Math.cos(a) * k, s.vy + Math.sin(a) * k);
      ctx.lineTo(s.vx + (Math.cos(a) + Math.cos(b)) * k, s.vy + (Math.sin(a) + Math.sin(b)) * k);
      ctx.lineTo(s.vx + Math.cos(b) * k, s.vy + Math.sin(b) * k);
      ctx.stroke();
    } else {
      const arcs = Math.max(1, e.style.arcs ?? 1);
      for (let i = 0; i < arcs; i++) {
        ctx.beginPath();
        ctx.arc(s.vx, s.vy, r + i * 5, s.a0, s.a0 + s.sweep, s.sweep < 0);
        ctx.stroke();
      }
    }
    highlight(e);
    const mid = s.a0 + s.sweep / 2;
    const tx = s.vx + Math.cos(mid) * (r + 20);
    const ty = s.vy + Math.sin(mid) * (r + 20);
    if (e.style.showLabel !== false) {
      ctx.font = `13px ${FONT}`;
      const text = `${formatNumber(s.deg, 1)}°`;
      const w = ctx.measureText(text).width;
      label(ctx, text, tx - w / 2, ty + 7, e.style.color, 13);
    }
  });

  // 4. מדידות
  pass((e, s) => {
    if (s.t !== 'meas') return;
    const parent = byId.get(e.parents[0] ?? '');
    const text = measureText(
      { ...e, style: { ...e.style, label: parent?.style.label ?? e.style.label } },
      s,
    );
    label(ctx, text, s.x + 6, s.y - 6, e.style.color, 14);
  });

  // 5. נקודות ושמות (תמיד למעלה)
  pass((e, s) => {
    if (s.t !== 'pt') return;
    const free = e.kind === 'point' || e.kind === 'glider';
    ctx.beginPath();
    ctx.arc(s.x, s.y, free ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = free ? e.style.color : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = e.style.color;
    ctx.stroke();
    highlight(e);
    if (e.style.label && e.style.showLabel !== false)
      label(ctx, e.style.label, s.x + 7, s.y - 5, '#1c2430');
  });
}
