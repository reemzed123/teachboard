import type { Op } from '../../core/document/ops';
import type { InkObject, ObjectId } from '../../core/document/types';
import { eraseInkCircle } from '../../core/ink/ink';
import { objectHitsPoint } from '../../core/objects/geometry';
import { rectsIntersect } from '../../core/geometry/rect';
import { currentPage, type ViewState } from '../../features/board/boardStore';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// מחק בשני מצבים:
//  - "קווים שלמים": כל קו שהמחק נוגע בו נמחק כולו.
//  - "אזור": נמחק רק החלק שהמחק עבר עליו (הקו נחתך לחלקים).
// כל המחיקה בתנועה אחת נרשמת כפעולה אחת (ביטול אחד מחזיר הכול).

export class EraserTool implements ToolHandler {
  private active = false;
  private removed = new Set<ObjectId>();
  /** מצב "אזור": האובייקט המקורי → החלקים שנשארו ממנו */
  private pieces = new Map<ObjectId, InkObject[]>();
  private cursor: InputPoint | null = null;

  constructor(private ctx: ToolContext) {}

  private radius(): number {
    // גודל המחק קבוע על המסך, בלי קשר לזום.
    return this.ctx.state().prefs.eraser.size / 2 / this.ctx.view().scale;
  }

  private eraseAt(p: InputPoint) {
    const state = this.ctx.state();
    const r = this.radius();
    const area = state.prefs.eraser.mode === 'area';
    const box = { x: p.bx - r, y: p.by - r, width: r * 2, height: r * 2 };

    for (const obj of currentPage(state).objects) {
      if (obj.locked) continue;
      const bounds = this.ctx.objects.boundsOf(obj.id);
      if (!bounds || !rectsIntersect(bounds, box)) continue;
      // קווים ישרים, חצים וטקסט נמחקים בשלמותם (גם במצב "אזור")
      if (!area || obj.type !== 'ink') {
        if (!this.removed.has(obj.id) && objectHitsPoint(obj, p.bx, p.by, r))
          this.removed.add(obj.id);
        continue;
      }
      const current = this.pieces.get(obj.id) ?? [obj];
      let changed = false;
      const next: InkObject[] = [];
      for (const piece of current) {
        const res = eraseInkCircle(piece, p.bx, p.by, r);
        if (res === null) next.push(piece);
        else {
          changed = true;
          next.push(...res);
        }
      }
      if (changed) this.pieces.set(obj.id, next);
    }

    if (area) {
      this.ctx.objects.setHidden([...this.pieces.keys(), ...this.removed]);
      this.renderPieces();
    } else {
      this.ctx.objects.setHidden(this.removed);
    }
  }

  private renderPieces() {
    const view = this.ctx.view();
    this.ctx.live.clear();
    for (const list of this.pieces.values()) {
      for (const o of list) this.ctx.live.drawObject(view, o);
    }
  }

  down(s: PointerSample): void {
    this.active = true;
    this.removed.clear();
    this.pieces.clear();
    this.eraseAt(s.point);
    this.hover(s.point);
  }

  move(s: PointerSample): void {
    this.hover(s.point);
    if (!this.active) return;
    for (const p of s.coalesced.length > 0 ? s.coalesced : [s.point]) this.eraseAt(p);
  }

  up(): void {
    if (!this.active) return;
    this.active = false;
    const state = this.ctx.state();
    const pageId = state.pageId;
    const ops: Op[] = [];

    if (this.removed.size > 0) {
      ops.push({ type: 'remove', pageId, ids: [...this.removed] });
    }
    if (this.pieces.size > 0) {
      // מהשכבה העליונה לתחתונה, כדי שהמיקומים בסדר השכבות יישארו נכונים.
      const objects = currentPage(state).objects;
      const indexed = [...this.pieces.entries()]
        .map(([id, list]) => ({ id, list, index: objects.findIndex((o) => o.id === id) }))
        .filter((e) => e.index >= 0)
        .sort((a, b) => b.index - a.index);
      for (const e of indexed) {
        ops.push({ type: 'remove', pageId, ids: [e.id] });
        if (e.list.length > 0) ops.push({ type: 'add', pageId, objects: e.list, index: e.index });
      }
    }

    this.removed.clear();
    this.pieces.clear();
    if (ops.length > 0) state.commit('erase', ops);
    this.ctx.objects.setHidden([]);
    this.ctx.live.clear();
  }

  cancel(): void {
    this.active = false;
    this.removed.clear();
    this.pieces.clear();
    this.ctx.objects.setHidden([]);
    this.ctx.live.clear();
  }

  hover(p: InputPoint | null): void {
    this.cursor = p;
    this.ctx.requestOverlay();
  }

  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewState): void {
    if (!this.cursor) return;
    const r = this.radius() * view.scale;
    ctx.beginPath();
    ctx.arc(this.cursor.sx, this.cursor.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(28,36,48,0.7)';
    ctx.stroke();
  }
}
