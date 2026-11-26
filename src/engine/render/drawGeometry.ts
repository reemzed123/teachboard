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

/** הטקסט של זווית/קטע: הערך המחושב, ביטוי של המורה (x+3), או שניהם */
export function valueText(e: GeoElement, value: string): string {
  const text = e.style.text?.trim();
  if (!text) return value;
  return e.style.showValue ? `${text} = ${value}` : text;
}

/** גודל קשת במעלות (0–360) */
export function arcDegrees(s: Extract<Solved, { t: 'arc' }>): number {
  let sweep = s.a1 - s.a0;
  while (sweep <= 0) sweep += Math.PI * 2;
  return (sweep * 180) / Math.PI;
}

/** מלבן של תווית (קואורדינטות מקומיות) – לגרירה ולעריכה */
export interface LabelBox {
  id: string;
  kind: 'letter' | 'value';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** התוויות שצוירו בכל בנייה (מתעדכן בכל ציור) */
export const geoLabelBoxes = new Map<string, LabelBox[]>();

export function labelAt(objectId: string, x: number, y: number): LabelBox | null {
  const boxes = geoLabelBoxes.get(objectId) ?? [];
  // האחרונה שצוירה – למעלה
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]!;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export const DEFAULT_ARC_RADIUS = 26;

export function angleRadius(e: GeoElement): number {
  return e.style.arcRadius ?? DEFAULT_ARC_RADIUS;
}

function segmentLabelCenter(s: Extract<Solved, { t: 'ln' }>) {
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  // בצד "החיצוני" לפי כיוון הקטע
  const nx = (s.y2 - s.y1) / len;
  const ny = -(s.x2 - s.x1) / len;
  return { x: (s.x1 + s.x2) / 2 + nx * 16, y: (s.y1 + s.y2) / 2 + ny * 16 };
}

function angleLabelCenter(e: GeoElement, s: Extract<Solved, { t: 'ang' }>) {
  const mid = s.a0 + s.sweep / 2;
  const r = angleRadius(e) + 20;
  return { x: s.vx + Math.cos(mid) * r, y: s.vy + Math.sin(mid) * r };
}

function letterCenter(s: { x: number; y: number }) {
  return { x: s.x + 12, y: s.y - 12 };
}

/** זוויות כפולות (אותו קודקוד ואותן זרועות) – מציגים רק אחת, עדיפות לזווית עם ביטוי */
export function duplicateAngles(elements: readonly GeoElement[]): Set<string> {
  const best = new Map<string, GeoElement>();
  for (const e of elements) {
    if (e.kind !== 'angle' || e.style.hidden || e.parents.length !== 3) continue;
    const [a, v, c] = e.parents as [string, string, string];
    const key = `${v}|${[a, c].sort().join('|')}`;
    const prev = best.get(key);
    if (!prev || (!prev.style.text && e.style.text)) best.set(key, e);
  }
  const keep = new Set([...best.values()].map((e) => e.id));
  return new Set(
    elements
      .filter((e) => e.kind === 'angle' && !keep.has(e.id) && !e.style.hidden)
      .map((e) => e.id),
  );
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
  const boxes: LabelBox[] = [];
  geoLabelBoxes.set(o.id, boxes);
  /** תווית במרכז (cx, cy) + ההזזה של המשתמש; נרשמת לגרירה ולעריכה בלחיצה כפולה */
  const place = (
    e: GeoElement,
    kind: LabelBox['kind'],
    text: string,
    cx: number,
    cy: number,
    color: string,
    size: number,
  ) => {
    ctx.font = `600 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width;
    const x = cx + (e.style.labelOffset?.dx ?? 0);
    const y = cy + (e.style.labelOffset?.dy ?? 0);
    label(ctx, text, x - w / 2, y + size / 2, color, size);
    boxes.push({ id: e.id, kind, x: x - w / 2 - 3, y: y - size / 2 - 3, w: w + 6, h: size + 6 });
  };
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
    // ערך/ביטוי לקטע – תווית אחת ליד אמצע הקטע
    if (s.t === 'ln' && s.mode === 'segment' && e.style.text) {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      const c = segmentLabelCenter(s);
      place(
        e,
        'value',
        valueText(e, formatNumber(len / UNITS_PER_CM, 2)),
        c.x,
        c.y,
        e.style.color,
        14,
      );
    }
    // מעלות הקשת
    if (s.t === 'arc' && (e.style.showLabel === true || e.style.text)) {
      const mid = s.a0 + (arcDegrees(s) * Math.PI) / 360;
      const text = valueText(e, `${formatNumber(arcDegrees(s), 1)}°`);
      place(
        e,
        'value',
        text,
        s.cx + Math.cos(mid) * (s.r + 16),
        s.cy + Math.sin(mid) * (s.r + 16),
        e.style.color,
        13,
      );
    }
  });

  // 3. זוויות: קשת (או ריבוע לזווית ישרה) ומספר מעלות. זווית כפולה (אותו קודקוד וזרועות) – פעם אחת.
  const skipAngles = duplicateAngles(o.elements);
  pass((e, s) => {
    if (s.t !== 'ang' || skipAngles.has(e.id)) return;
    ctx.strokeStyle = e.style.color;
    ctx.lineWidth = 1.6;
    const right = Math.abs(s.deg - 90) < 0.05;
    const r = angleRadius(e);
    if (right) {
      const a = s.a0;
      const b = s.a0 + s.sweep;
      const k = r * 0.55;
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
    if (e.style.showLabel !== false || e.style.text) {
      const deg = `${formatNumber(s.deg, 1)}°`;
      const text =
        e.style.showLabel === false && !e.style.showValue
          ? (e.style.text ?? deg)
          : valueText(e, deg);
      const c = angleLabelCenter(e, s);
      place(e, 'value', text, c.x, c.y, e.style.color, 13);
    }
  });

  // 4. מדידות. אורך קטע שיש לו ביטוי – הביטוי מחליף את המספר (לא שתי תוויות).
  pass((e, s) => {
    if (s.t !== 'meas') return;
    const parent = byId.get(e.parents[0] ?? '');
    const parentSol = parent ? sol.get(parent.id) : undefined;
    const onSegment = parent?.kind === 'segment' && parentSol?.t === 'ln' && s.what === 'length';
    if (onSegment && parent.style.text) return;
    const text = valueText(
      e,
      measureText({ ...e, style: { ...e.style, label: parent?.style.label ?? e.style.label } }, s),
    );
    const c =
      onSegment && parentSol?.t === 'ln'
        ? segmentLabelCenter(parentSol)
        : { x: s.x + 6 + text.length * 3.8, y: s.y - 14 };
    place(e, 'value', text, c.x, c.y, e.style.color, 14);
  });

  // 5. נקודות ושמות (תמיד למעלה)
  pass((e, s) => {
    if (s.t !== 'pt') return;
    const free = e.kind === 'point' || e.kind === 'glider';
    ctx.beginPath();
    ctx.arc(s.x, s.y, free ? 4.5 : 3.5, 0, Math.PI * 2);
    if (!e.style.hideDot) {
      ctx.fillStyle = free ? e.style.color : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = e.style.color;
      ctx.stroke();
    }
    highlight(e);
    if (e.style.label && e.style.showLabel !== false) {
      const c = letterCenter(s);
      place(e, 'letter', e.style.label, c.x, c.y, '#1c2430', 15);
    }
  });
}
