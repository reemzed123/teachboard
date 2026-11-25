import { newId } from '../../core/document/ids';
import { IDENTITY_TRANSFORM, type InkKind, type InkObject } from '../../core/document/types';
import { simplifyClosePoints } from '../../core/ink/ink';
import { outlinePath } from '../render/inkOutline';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// עט ומדגיש: אוסף נקודות, מצייר אותן מיד על המשטח המהיר, ושומר במסמך בסיום.

export class InkTool implements ToolHandler {
  private points: number[] = [];
  private active = false;
  private pressureSeen = false;

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

  private pressureOf(p: InputPoint): number {
    const { prefs } = this.ctx.state();
    if (this.kind !== 'pen' || !prefs.usePressure || p.pointerType !== 'pen') return 0.5;
    if (p.pressure > 0 && p.pressure !== 0.5) this.pressureSeen = true;
    return p.pressure > 0 ? p.pressure : 0.5;
  }

  private add(p: InputPoint) {
    this.points.push(p.bx, p.by, this.pressureOf(p));
  }

  private render(predicted: InputPoint[] = []) {
    const style = this.style();
    let pts = this.points;
    if (predicted.length > 0) {
      pts = pts.slice();
      for (const p of predicted) pts.push(p.bx, p.by, this.pressureOf(p));
    }
    const path = outlinePath(pts, this.kind, style.width, this.pressureSeen, false);
    this.ctx.live.clear();
    this.ctx.live.fillBoardPath(
      this.ctx.view(),
      path,
      style.color,
      style.opacity,
      this.kind === 'highlighter',
    );
  }

  down(s: PointerSample): void {
    this.active = true;
    this.points = [];
    this.pressureSeen = false;
    this.add(s.point);
    this.render();
  }

  move(s: PointerSample): void {
    if (!this.active) return;
    const samples = s.coalesced.length > 0 ? s.coalesced : [s.point];
    for (const p of samples) this.add(p);
    this.render(s.predicted);
  }

  up(s: PointerSample): void {
    if (!this.active) return;
    this.move({ ...s, predicted: [] });
    this.active = false;
    const scale = this.ctx.view().scale;
    const raw = simplifyClosePoints(this.points, 0.4 / scale);
    // מנרמלים כך שהנקודה הראשונה היא נקודת המוצא של האובייקט.
    const ox = raw[0]!;
    const oy = raw[1]!;
    const points = raw.map((v, i) => (i % 3 === 0 ? v - ox : i % 3 === 1 ? v - oy : v));
    const obj: InkObject = {
      id: newId(),
      type: 'ink',
      transform: { ...IDENTITY_TRANSFORM, x: ox, y: oy },
      style: this.style(),
      points: points.map((v) => Math.round(v * 100) / 100),
      pressure: this.pressureSeen,
    };
    const state = this.ctx.state();
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
