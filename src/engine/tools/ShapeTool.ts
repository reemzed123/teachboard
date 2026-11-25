import { newId } from '../../core/document/ids';
import { IDENTITY_TRANSFORM, type ShapeObject } from '../../core/document/types';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// קו ישר וחץ: גוררים מנקודת ההתחלה לנקודת הסוף. Shift = זוויות קבועות (כל 15°).
// הצבע והעובי – כמו העט; סוג הקו וחץ דו-כיווני – לפי ההגדרות.

export class ShapeTool implements ToolHandler {
  private start: InputPoint | null = null;
  private current: ShapeObject | null = null;

  constructor(
    private ctx: ToolContext,
    private kind: 'line' | 'arrow',
  ) {}

  private build(end: InputPoint, snap: boolean): ShapeObject | null {
    if (!this.start) return null;
    const { prefs } = this.ctx.state();
    let dx = end.bx - this.start.bx;
    let dy = end.by - this.start.by;
    if (snap) {
      const len = Math.hypot(dx, dy);
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
      dx = Math.cos(a) * len;
      dy = Math.sin(a) * len;
    }
    const obj: ShapeObject = {
      id: this.current?.id ?? newId(),
      type: 'shape',
      kind: this.kind,
      transform: { ...IDENTITY_TRANSFORM, x: this.start.bx, y: this.start.by },
      dx: Math.round(dx * 100) / 100,
      dy: Math.round(dy * 100) / 100,
      style: {
        color: prefs.pen.color,
        width: prefs.pen.width,
        opacity: prefs.pen.opacity,
        dash: prefs.shape.dash,
      },
    };
    if (this.kind === 'arrow' && prefs.shape.arrowStart) obj.arrowStart = true;
    return obj;
  }

  private render() {
    this.ctx.live.clear();
    if (this.current) this.ctx.live.drawObject(this.ctx.view(), this.current);
  }

  down(s: PointerSample): void {
    this.start = s.point;
    this.current = null;
  }

  move(s: PointerSample): void {
    if (!this.start) return;
    this.current = this.build(s.point, s.shiftKey);
    this.render();
  }

  up(s: PointerSample): void {
    if (!this.start) return;
    const obj = this.build(s.point, s.shiftKey);
    const scale = this.ctx.view().scale;
    // לחיצה בלי גרירה לא יוצרת קו
    if (obj && Math.hypot(obj.dx, obj.dy) * scale >= 4) {
      const state = this.ctx.state();
      state.commit(this.kind, [{ type: 'add', pageId: state.pageId, objects: [obj] }]);
    }
    this.cancel();
  }

  cancel(): void {
    this.start = null;
    this.current = null;
    this.ctx.live.clear();
  }
}
