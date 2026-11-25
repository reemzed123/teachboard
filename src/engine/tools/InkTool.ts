import { newId } from '../../core/document/ids';
import { IDENTITY_TRANSFORM, type InkKind, type InkObject } from '../../core/document/types';
import { simplifyClosePoints } from '../../core/ink/ink';
import {
  beautifyStroke,
  createLiveFilter,
  radiusForPressure,
  type OneEuroFilter2D,
} from '../../core/ink/smoothing';
import { PEN_THINNING } from '../render/inkOutline';
import { screenToBoard } from '../viewport';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// עט ומדגיש.
// בזמן הכתיבה: כל נקודה עוברת מסנן ייצוב, ומצוירת רק החתיכה החדשה (מהיר, בלי השהיה).
// בהרמת העט: הקו "מיופה" (החלקה, הסרת ווים) ונשמר במסמך.

/** כמה מהר הלחץ המוצג עוקב אחרי הלחץ האמיתי (מונע הבהוב בעובי) */
const PRESSURE_FOLLOW = 0.35;

export class InkTool implements ToolHandler {
  private points: number[] = [];
  private active = false;
  private pressureSeen = false;
  private filter: OneEuroFilter2D | null = null;
  private livePressure = 0.5;
  private thinning = 0;

  constructor(
    private ctx: ToolContext,
    private kind: InkKind,
  ) {}

  private style() {
    const { prefs } = this.ctx.state();
    return this.kind === 'pen'
      ? {
          kind: this.kind,
          color: prefs.pen.color,
          width: prefs.pen.width,
          opacity: prefs.pen.opacity,
        }
      : {
          kind: this.kind,
          color: prefs.highlighter.color,
          width: prefs.highlighter.width,
          opacity: 0.45,
        };
  }

  private rawPressure(p: InputPoint): number {
    const { prefs } = this.ctx.state();
    if (this.kind !== 'pen' || !prefs.usePressure || p.pointerType !== 'pen') return 0.5;
    if (p.pressure > 0 && p.pressure !== 0.5) this.pressureSeen = true;
    return p.pressure > 0 ? p.pressure : this.livePressure;
  }

  /** מוסיף נקודה (אחרי ייצוב) ומצייר את החתיכה החדשה. */
  private add(p: InputPoint) {
    const view = this.ctx.view();
    let bx = p.bx;
    let by = p.by;
    if (this.filter) {
      // הייצוב נעשה בפיקסלים של המסך, כדי שיתנהג אותו דבר בכל זום.
      const f = this.filter.filter(p.sx, p.sy, p.t / 1000);
      const b = screenToBoard(view, f.x, f.y);
      bx = b.x;
      by = b.y;
    }
    const raw = this.rawPressure(p);
    this.livePressure =
      this.points.length === 0
        ? raw
        : this.livePressure + (raw - this.livePressure) * PRESSURE_FOLLOW;
    const pr = this.livePressure;

    const width = this.style().width;
    const r = radiusForPressure(width, this.thinning, pr);
    const n = this.points.length;
    if (n === 0) {
      this.ctx.live.dot(bx, by, r);
    } else {
      const ax = this.points[n - 3]!;
      const ay = this.points[n - 2]!;
      // מדלגים על תזוזות זעירות (פחות מרבע פיקסל במסך) – הן רק רעש.
      if (Math.hypot(bx - ax, by - ay) * view.scale < 0.25) return;
      const ar = radiusForPressure(width, this.thinning, this.points[n - 1]!);
      this.ctx.live.segment(ax, ay, ar, bx, by, r);
    }
    this.points.push(bx, by, pr);
  }

  down(s: PointerSample): void {
    const state = this.ctx.state();
    const style = this.style();
    this.active = true;
    this.points = [];
    this.pressureSeen = false;
    this.livePressure = 0.5;
    this.filter = createLiveFilter(state.prefs.smoothing);
    this.thinning =
      this.kind === 'pen' && state.prefs.usePressure && s.point.pointerType === 'pen'
        ? PEN_THINNING
        : 0;
    this.ctx.live.beginStroke(
      this.ctx.view(),
      style.color,
      style.opacity,
      this.kind === 'highlighter',
    );
    this.add(s.point);
  }

  move(s: PointerSample): void {
    if (!this.active) return;
    for (const p of s.coalesced.length > 0 ? s.coalesced : [s.point]) this.add(p);
  }

  up(s: PointerSample): void {
    if (!this.active) return;
    this.move(s);
    this.active = false;
    const state = this.ctx.state();
    const scale = this.ctx.view().scale;
    const beautified = beautifyStroke(this.points, state.prefs.smoothing, scale);
    const raw = simplifyClosePoints(beautified, 0.3 / scale);
    // מנרמלים כך שהנקודה הראשונה היא נקודת המוצא של האובייקט.
    const ox = raw[0]!;
    const oy = raw[1]!;
    const points = raw.map(
      (v, i) => Math.round((i % 3 === 0 ? v - ox : i % 3 === 1 ? v - oy : v) * 100) / 100,
    );
    const obj: InkObject = {
      id: newId(),
      type: 'ink',
      transform: { ...IDENTITY_TRANSFORM, x: ox, y: oy },
      style: this.style(),
      points,
      pressure: this.pressureSeen,
    };
    state.commit(this.kind === 'pen' ? 'pen' : 'highlighter', [
      { type: 'add', pageId: state.pageId, objects: [obj] },
    ]);
    this.points = [];
    this.ctx.live.clear();
  }

  cancel(): void {
    this.active = false;
    this.points = [];
    this.ctx.live.clear();
  }
}
