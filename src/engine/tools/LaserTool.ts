import type { ViewState } from '../../features/board/boardStore';
import { boardToScreen } from '../viewport';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// מצביע לייזר: נקודה אדומה זוהרת שעוקבת אחרי העט/העכבר.
// בלחיצה – שובל שנעלם תוך רגע. שום דבר לא נשמר בשיעור.

const FADE_MS = 1100;
const COLOR = '255, 38, 38';

interface TrailPoint {
  x: number;
  y: number;
  t: number;
  /** תחילת קו חדש (לא מחברים לנקודה הקודמת) */
  start?: boolean;
}

export class LaserTool implements ToolHandler {
  private pos: { x: number; y: number } | null = null;
  private trail: TrailPoint[] = [];
  private pressed = false;

  constructor(
    private ctx: ToolContext,
    private now: () => number = () => performance.now(),
  ) {}

  private add(p: InputPoint, start = false) {
    this.pos = { x: p.bx, y: p.by };
    if (this.pressed) this.trail.push({ x: p.bx, y: p.by, t: this.now(), start });
  }

  down(s: PointerSample): void {
    this.pressed = true;
    this.add(s.point, true);
    this.ctx.requestOverlay();
  }

  move(s: PointerSample): void {
    for (const p of s.coalesced.length ? s.coalesced : [s.point]) this.add(p);
    this.ctx.requestOverlay();
  }

  up(): void {
    this.pressed = false;
    this.ctx.requestOverlay();
  }

  cancel(): void {
    this.pressed = false;
    this.trail = [];
    this.ctx.requestOverlay();
  }

  hover(p: InputPoint | null): void {
    this.pos = p ? { x: p.bx, y: p.by } : null;
    this.ctx.requestOverlay();
  }

  /** לבדיקות: כמה נקודות בשובל עדיין נראות */
  visibleTrail(): number {
    const now = this.now();
    return this.trail.filter((p) => now - p.t < FADE_MS).length;
  }

  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewState): void {
    const now = this.now();
    this.trail = this.trail.filter((p) => now - p.t < FADE_MS);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]!;
      const b = this.trail[i]!;
      if (b.start) continue;
      const age = (now - b.t) / FADE_MS;
      const pa = boardToScreen(view, a.x, a.y);
      const pb = boardToScreen(view, b.x, b.y);
      ctx.strokeStyle = `rgba(${COLOR}, ${0.85 * (1 - age)})`;
      ctx.lineWidth = 5 * (1 - age * 0.6);
      ctx.shadowColor = `rgba(${COLOR}, ${0.7 * (1 - age)})`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    if (this.pos) {
      const p = boardToScreen(view, this.pos.x, this.pos.y);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
      glow.addColorStop(0, `rgba(${COLOR}, 0.95)`);
      glow.addColorStop(0.35, `rgba(${COLOR}, 0.6)`);
      glow.addColorStop(1, `rgba(${COLOR}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff5f5';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // השובל עוד דועך – ממשיכים לצייר בפריים הבא
    if (this.trail.length > 0) this.ctx.requestOverlay();
  }
}
