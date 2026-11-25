import type { ViewState } from '../../features/board/boardStore';

// משטח ציור נפרד וקל לקו שנכתב ברגע זה ולתצוגות זמניות.
// "desynchronized" מאפשר לדפדפן להציג את הציור מהר יותר (פחות השהיה בעט).

export class LiveCanvas {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor() {
    this.canvas.className = 'tb-live-canvas';
    const ctx =
      this.canvas.getContext('2d', { desynchronized: true, alpha: true }) ??
      this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.dpr = window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.style.opacity = '';
    this.canvas.style.mixBlendMode = '';
  }

  /**
   * מתחיל קו חי. השקיפות מוחלת על המשטח כולו (ולא על כל חתיכה),
   * כך שחפיפה בין חתיכות לא יוצרת כתמים כהים.
   */
  beginStroke(view: ViewState, color: string, opacity: number, multiply: boolean): void {
    this.clear();
    this.canvas.style.opacity = String(opacity);
    this.canvas.style.mixBlendMode = multiply ? 'multiply' : '';
    const { ctx, dpr } = this;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** נקודה עגולה (תחילת קו). קואורדינטות לוח. */
  dot(x: number, y: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * מצייר רק את החתיכה החדשה של הקו: מ-A ל-B, עם רדיוס משתנה.
   * זמן קבוע לכל תנועה, בלי קשר לאורך הקו – זה מה שמונע השהיה.
   */
  segment(ax: number, ay: number, ar: number, bx: number, by: number, br: number): void {
    const { ctx } = this;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    ctx.beginPath();
    if (len > 0.0001) {
      const nx = -dy / len;
      const ny = dx / len;
      ctx.moveTo(ax + nx * ar, ay + ny * ar);
      ctx.lineTo(bx + nx * br, by + ny * br);
      ctx.lineTo(bx - nx * br, by - ny * br);
      ctx.lineTo(ax - nx * ar, ay - ny * ar);
      ctx.closePath();
    }
    ctx.moveTo(bx + br, by);
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  /** מצייר צורה בקואורדינטות לוח. */
  fillBoardPath(
    view: ViewState,
    path: Path2D,
    color: string,
    opacity: number,
    multiply: boolean,
  ): void {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = multiply ? 'multiply' : 'source-over';
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  get size() {
    return { width: this.width, height: this.height };
  }
}
