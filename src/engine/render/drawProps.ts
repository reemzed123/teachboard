import type { FractionBarsObject, NumberLineObject } from '../../core/document/types';
import { formatNumber } from '../../core/math/numeric';

// עזרים מתמטיים: ציר מספרים ורצועות שברים (קואורדינטות מקומיות של האובייקט).

const FONT = '"Heebo Variable", "Segoe UI", Arial, sans-serif';

/** אילו שנתות מקבלות מספר – כדי שהמספרים לא יעלו זה על זה */
export function numberLineLabelEvery(o: NumberLineObject): number {
  const count = Math.round((o.to - o.from) / o.step);
  const room = o.width / Math.max(1, count);
  const labelW = 26;
  return Math.max(1, Math.ceil(labelW / room));
}

export function drawNumberLine(ctx: CanvasRenderingContext2D, o: NumberLineObject): void {
  const pad = 18;
  const y = o.height * 0.45;
  const x0 = pad;
  const x1 = o.width - pad;
  const count = Math.round((o.to - o.from) / o.step);
  const X = (i: number) => x0 + ((x1 - x0) * i) / Math.max(1, count);
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  // הציר וחצים בשני הקצוות
  ctx.beginPath();
  ctx.moveTo(4, y);
  ctx.lineTo(o.width - 4, y);
  ctx.stroke();
  for (const [tx, dir] of [
    [o.width - 2, 1],
    [2, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx - dir * 10, y - 5);
    ctx.lineTo(tx - dir * 10, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  const every = numberLineLabelEvery(o);
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.direction = 'ltr';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= count; i++) {
    const v = o.from + i * o.step;
    const major = i % every === 0;
    const h = major ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(X(i), y - h);
    ctx.lineTo(X(i), y + h);
    ctx.stroke();
    if (major) ctx.fillText(formatNumber(v, 3), X(i), y + 12);
  }
}

export function drawFractionBars(ctx: CanvasRenderingContext2D, o: FractionBarsObject): void {
  const W = o.width;
  const H = o.rowHeight;
  ctx.font = `${Math.min(18, H * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  o.denominators.forEach((d, r) => {
    const top = r * H;
    const cw = W / d;
    for (let i = 0; i < d; i++) {
      // צבעים מתחלפים רכים לכל שורה
      const hue = (r * 47) % 360;
      ctx.fillStyle = `hsl(${hue} 80% ${i % 2 ? 90 : 85}%)`;
      ctx.fillRect(i * cw, top, cw, H);
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(i * cw, top, cw, H);
      ctx.fillStyle = o.color;
      if (cw > 18) ctx.fillText(d === 1 ? '1' : `1/${d}`, i * cw + cw / 2, top + H / 2);
    }
  });
}
