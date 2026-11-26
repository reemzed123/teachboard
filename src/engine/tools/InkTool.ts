import { newId } from '../../core/document/ids';
import { IDENTITY_TRANSFORM, type InkKind, type InkObject } from '../../core/document/types';
import { simplifyClosePoints } from '../../core/ink/ink';
import { recognizeShape } from '../../core/ink/recognize';
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
/** כמה זמן (מ"ש) העט צריך לעמוד במקום כדי שהקו יהפוך לצורה */
export const HOLD_TO_SHAPE_MS = 450;
/** תזוזה (פיקסלים במסך) שנחשבת "עדיין במקום" */
const HOLD_TOLERANCE_PX = 4;
/** גודל מינימלי (פיקסלים במסך) לזיהוי צורה – כתב יד קטן לא מזוהה */
const SHAPE_MIN_SCREEN = 40;
/** תזוזה (פיקסלים במסך) אחרי היישור שמבטלת אותו וממשיכה את הקו */
const UNSNAP_PX = 14;

/** מוסיף נקודות ביניים לצורה (כל ~6 יחידות) – כדי שמחק לפי אזור יעבוד גם עליה */
function densify(xy: number[], step: number): number[] {
  const out: number[] = [xy[0]!, xy[1]!];
  for (let i = 2; i + 1 < xy.length; i += 2) {
    const ax = xy[i - 2]!;
    const ay = xy[i - 1]!;
    const bx = xy[i]!;
    const by = xy[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
  return out;
}

export class InkTool implements ToolHandler {
  private points: number[] = [];
  private active = false;
  private pressureSeen = false;
  private filter: OneEuroFilter2D | null = null;
  private livePressure = 0.5;
  private thinning = 0;
  /** החזקת העט במקום: נקודת עוגן (מסך) וטיימר */
  private holdAnchor: { x: number; y: number } | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  /** הצורה הנקייה שהקו "התיישר" אליה (נקודות x, y) */
  private snapped: number[] | null = null;

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
    if (this.snapped) {
      // העט ממשיך לזוז אחרי היישור (למשל עצירה בפינה של משולש) – חוזרים לקו החופשי
      const a = this.holdAnchor;
      if (!a || Math.hypot(s.point.sx - a.x, s.point.sy - a.y) <= UNSNAP_PX) return;
      this.unsnap();
    }
    for (const p of s.coalesced.length > 0 ? s.coalesced : [s.point]) this.add(p);
    this.trackHold(s.point);
  }

  private unsnap() {
    this.snapped = null;
    const style = this.style();
    this.ctx.live.clear();
    this.ctx.live.beginStroke(
      this.ctx.view(),
      style.color,
      style.opacity,
      this.kind === 'highlighter',
    );
    this.redrawLive();
  }

  /** העט זז – מתחילים לספור מחדש; עומד במקום מספיק זמן – מנסים ליישר לצורה */
  private trackHold(p: InputPoint) {
    if (!this.ctx.state().prefs.shapeSnap) return;
    const a = this.holdAnchor;
    if (a && Math.hypot(p.sx - a.x, p.sy - a.y) <= HOLD_TOLERANCE_PX) return;
    this.holdAnchor = { x: p.sx, y: p.sy };
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.trySnap(), HOLD_TO_SHAPE_MS);
  }

  private trySnap() {
    if (!this.active || this.snapped) return;
    const view = this.ctx.view();
    const shape = recognizeShape(this.points, SHAPE_MIN_SCREEN / view.scale);
    if (!shape) return;
    this.snapped = densify(shape.points, 6 / view.scale);
    // מציירים מחדש את הצורה הנקייה במקום הקו
    const style = this.style();
    this.ctx.live.clear();
    this.ctx.live.beginStroke(view, style.color, style.opacity, this.kind === 'highlighter');
    const r = radiusForPressure(style.width, 0, 0.5);
    const pts = shape.points;
    this.ctx.live.dot(pts[0]!, pts[1]!, r);
    for (let i = 2; i + 1 < pts.length; i += 2)
      this.ctx.live.segment(pts[i - 2]!, pts[i - 1]!, r, pts[i]!, pts[i + 1]!, r);
  }

  private stopHold() {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.holdAnchor = null;
  }

  up(s: PointerSample): void {
    if (!this.active) return;
    this.move(s);
    this.active = false;
    this.stopHold();
    const state = this.ctx.state();
    const scale = this.ctx.view().scale;
    // צורה נקייה: עובי אחיד (בלי לחץ), בלי החלקה נוספת
    const snapped = this.snapped;
    this.snapped = null;
    const raw = snapped
      ? snapped.flatMap((v, i) => (i % 2 === 1 ? [v, 0.5] : [v]))
      : simplifyClosePoints(beautifyStroke(this.points, state.prefs.smoothing, scale), 0.3 / scale);
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
      pressure: snapped ? false : this.pressureSeen,
    };
    state.commit(this.kind === 'pen' ? 'pen' : 'highlighter', [
      { type: 'add', pageId: state.pageId, objects: [obj] },
    ]);
    this.points = [];
    this.ctx.live.clear();
  }

  /** מצייר מחדש את כל הקו שנכתב עד עכשיו (אחרי שהמשטח נמחק בשינוי גודל). */
  redrawLive(): void {
    if (!this.active || this.points.length === 0) return;
    if (this.snapped) {
      const pts = this.snapped;
      const r = radiusForPressure(this.style().width, 0, 0.5);
      this.ctx.live.dot(pts[0]!, pts[1]!, r);
      for (let i = 2; i + 1 < pts.length; i += 2)
        this.ctx.live.segment(pts[i - 2]!, pts[i - 1]!, r, pts[i]!, pts[i + 1]!, r);
      return;
    }
    const width = this.style().width;
    const p = this.points;
    this.ctx.live.dot(p[0]!, p[1]!, radiusForPressure(width, this.thinning, p[2]!));
    for (let i = 3; i < p.length; i += 3) {
      this.ctx.live.segment(
        p[i - 3]!,
        p[i - 2]!,
        radiusForPressure(width, this.thinning, p[i - 1]!),
        p[i]!,
        p[i + 1]!,
        radiusForPressure(width, this.thinning, p[i + 2]!),
      );
    }
  }

  cancel(): void {
    this.stopHold();
    this.snapped = null;
    this.active = false;
    this.points = [];
    this.ctx.live.clear();
  }
}
