import type {
  BoardObject,
  InkObject,
  LineDash,
  ShapeObject,
  TextObject,
} from '../../core/document/types';
import { arrowHeadSize } from '../../core/objects/geometry';
import { outlinePath } from './inkOutline';

// ציור אובייקט על canvas. אותו קוד משמש את המסך, ייצוא התמונה והתמונות הממוזערות –
// כך מה שרואים הוא בדיוק מה שמיוצא.

export const TEXT_FONT_FAMILY = '"Heebo Variable", "Segoe UI", Arial, sans-serif';
export const TEXT_LINE_HEIGHT = 1.3;

const inkPaths = new WeakMap<InkObject, Path2D>();

function inkPath(o: InkObject): Path2D {
  let p = inkPaths.get(o);
  if (!p) {
    p = outlinePath(o.points, o.style.kind, o.style.width, o.pressure, true);
    inkPaths.set(o, p);
  }
  return p;
}

export function dashPattern(dash: LineDash, width: number): number[] {
  if (dash === 'dashed') return [width * 3, width * 2.5];
  if (dash === 'dotted') return [0.001, width * 2];
  return [];
}

function drawShape(ctx: CanvasRenderingContext2D, o: ShapeObject) {
  const { dx, dy } = o;
  const len = Math.hypot(dx, dy);
  const ux = len ? dx / len : 1;
  const uy = len ? dy / len : 0;
  const head = o.kind === 'arrow' ? Math.min(arrowHeadSize(o.style.width), len * 0.45) : 0;
  const startHead = o.kind === 'arrow' && o.arrowStart ? head : 0;

  ctx.strokeStyle = o.style.color;
  ctx.fillStyle = o.style.color;
  ctx.lineWidth = o.style.width;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashPattern(o.style.dash, o.style.width));
  ctx.beginPath();
  // הקו נעצר בבסיס ראש החץ, כדי שלא יבלוט מהחוד
  ctx.moveTo(ux * startHead * 0.8, uy * startHead * 0.8);
  ctx.lineTo(dx - ux * head * 0.8, dy - uy * head * 0.8);
  ctx.stroke();
  ctx.setLineDash([]);

  const tip = (x: number, y: number, dirX: number, dirY: number) => {
    const bx = x - dirX * head;
    const by = y - dirY * head;
    const w = head * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(bx - dirY * w, by + dirX * w);
    ctx.lineTo(bx + dirY * w, by - dirX * w);
    ctx.closePath();
    ctx.fill();
  };
  if (head > 0) tip(dx, dy, ux, uy);
  if (startHead > 0) tip(0, 0, -ux, -uy);
}

export function textFont(o: Pick<TextObject, 'fontSize' | 'bold'>): string {
  return `${o.bold ? 700 : 400} ${o.fontSize}px ${TEXT_FONT_FAMILY}`;
}

function drawText(ctx: CanvasRenderingContext2D, o: TextObject) {
  ctx.fillStyle = o.color;
  ctx.font = textFont(o);
  ctx.direction = o.dir;
  ctx.textAlign = o.dir === 'rtl' ? 'right' : 'left';
  ctx.textBaseline = 'top';
  const lh = o.fontSize * TEXT_LINE_HEIGHT;
  const pad = (lh - o.fontSize) / 2;
  o.text.split('\n').forEach((line, i) => ctx.fillText(line, 0, i * lh + pad));
}

/** מצייר את האובייקט בקואורדינטות המקומיות שלו (המיקום/סיבוב כבר הוחלו). */
export function drawObjectLocal(ctx: CanvasRenderingContext2D, o: BoardObject): void {
  switch (o.type) {
    case 'ink':
      ctx.fillStyle = o.style.color;
      ctx.fill(inkPath(o));
      break;
    case 'shape':
      drawShape(ctx, o);
      break;
    case 'text':
      drawText(ctx, o);
      break;
  }
}

export function objectOpacity(o: BoardObject): number {
  return o.type === 'text' ? 1 : o.style.opacity;
}

export function objectBlend(o: BoardObject): GlobalCompositeOperation {
  return o.type === 'ink' && o.style.kind === 'highlighter' ? 'multiply' : 'source-over';
}

/** מצייר אובייקט בקואורדינטות לוח (לייצוא). */
export function drawObjectWorld(ctx: CanvasRenderingContext2D, o: BoardObject): void {
  ctx.save();
  ctx.translate(o.transform.x, o.transform.y);
  ctx.rotate((o.transform.rotation * Math.PI) / 180);
  ctx.scale(o.transform.scale, o.transform.scale);
  ctx.globalAlpha = objectOpacity(o);
  ctx.globalCompositeOperation = objectBlend(o);
  drawObjectLocal(ctx, o);
  ctx.restore();
}

// ---------- מדידת טקסט ----------

let measureCtx: CanvasRenderingContext2D | null = null;

/** מודד תיבת טקסט (לפני שמירה כאובייקט). */
export function measureText(
  text: string,
  fontSize: number,
  bold: boolean,
): { width: number; height: number } {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const lines = text.split('\n');
  let width = 0;
  if (measureCtx) {
    measureCtx.font = textFont({ fontSize, bold });
    for (const l of lines) width = Math.max(width, measureCtx.measureText(l).width);
  } else {
    width = Math.max(...lines.map((l) => l.length)) * fontSize * 0.55;
  }
  return {
    width: Math.ceil(width) + 2,
    height: Math.ceil(lines.length * fontSize * TEXT_LINE_HEIGHT),
  };
}

/** כיוון לפי התו "החזק" הראשון: עברית/ערבית → מימין לשמאל. */
export function detectDirection(text: string): 'rtl' | 'ltr' {
  for (const ch of text) {
    if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefe]/.test(ch)) return 'rtl';
    if (/[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff]/.test(ch)) return 'ltr';
  }
  return 'rtl';
}
