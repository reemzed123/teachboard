import type { ObjectId } from '../../core/document/types';
import { inkHitsPoint, inkIntersectsRect } from '../../core/ink/ink';
import { rectFromPoints, rectsIntersect, unionRects, type Rect } from '../../core/geometry/rect';
import { currentPage, type ViewState } from '../../features/board/boardStore';
import { boardToScreen } from '../viewport';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// בחירה: לחיצה על קו בוחרת אותו (Shift מוסיף), גרירה בשטח ריק מסמנת מלבן,
// וגרירה של קו נבחר מזיזה את כל הבחירה.

type Mode =
  | { kind: 'idle' }
  | { kind: 'marquee'; start: InputPoint; end: InputPoint }
  | {
      kind: 'move';
      start: InputPoint;
      dx: number;
      dy: number;
    };

export class SelectTool implements ToolHandler {
  private mode: Mode = { kind: 'idle' };

  constructor(private ctx: ToolContext) {}

  private hitTest(p: InputPoint): ObjectId | null {
    const objects = currentPage(this.ctx.state()).objects;
    const tol = 6 / this.ctx.view().scale;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]!;
      if (o.locked) continue;
      if (inkHitsPoint(o, p.bx, p.by, tol)) return o.id;
    }
    return null;
  }

  selectionBounds(): Rect | null {
    const sel = this.ctx.state().selection;
    return unionRects(sel.map((id) => this.ctx.ink.boundsOf(id)).filter((r): r is Rect => !!r));
  }

  down(s: PointerSample): void {
    const p = s.point;
    const state = this.ctx.state();
    const hit = this.hitTest(p);
    const bounds = this.selectionBounds();
    const insideSelection =
      bounds &&
      p.bx >= bounds.x &&
      p.bx <= bounds.x + bounds.width &&
      p.by >= bounds.y &&
      p.by <= bounds.y + bounds.height;

    if (hit && !state.selection.includes(hit)) {
      state.setSelection(s.shiftKey ? [...state.selection, hit] : [hit]);
      this.mode = { kind: 'move', start: p, dx: 0, dy: 0 };
    } else if (hit || insideSelection) {
      this.mode = { kind: 'move', start: p, dx: 0, dy: 0 };
    } else {
      if (!s.shiftKey) state.setSelection([]);
      this.mode = { kind: 'marquee', start: p, end: p };
    }
    this.ctx.requestOverlay();
  }

  move(s: PointerSample): void {
    const p = s.point;
    if (this.mode.kind === 'marquee') {
      this.mode.end = p;
      this.ctx.requestOverlay();
    } else if (this.mode.kind === 'move') {
      this.mode.dx = p.bx - this.mode.start.bx;
      this.mode.dy = p.by - this.mode.start.by;
      this.ctx.ink.previewOffset(this.ctx.state().selection, this.mode.dx, this.mode.dy);
      this.ctx.requestOverlay();
    }
  }

  up(s: PointerSample): void {
    const state = this.ctx.state();
    if (this.mode.kind === 'marquee') {
      const rect = rectFromPoints(
        { x: this.mode.start.bx, y: this.mode.start.by },
        { x: this.mode.end.bx, y: this.mode.end.by },
      );
      if (rect.width > 0 || rect.height > 0) {
        const found = currentPage(state)
          .objects.filter((o) => {
            if (o.locked) return false;
            const b = this.ctx.ink.boundsOf(o.id);
            return b && rectsIntersect(b, rect) && inkIntersectsRect(o, rect);
          })
          .map((o) => o.id);
        const merged = s.shiftKey ? [...new Set([...state.selection, ...found])] : found;
        state.setSelection(merged);
      }
    } else if (this.mode.kind === 'move') {
      const { dx, dy } = this.mode;
      if (dx !== 0 || dy !== 0) {
        const ids = new Set(state.selection);
        const moved = currentPage(state)
          .objects.filter((o) => ids.has(o.id))
          .map((o) => ({
            ...o,
            transform: { ...o.transform, x: o.transform.x + dx, y: o.transform.y + dy },
          }));
        state.commit('move', [{ type: 'replace', pageId: state.pageId, objects: moved }]);
      }
    }
    this.mode = { kind: 'idle' };
    this.ctx.requestOverlay();
  }

  cancel(): void {
    if (this.mode.kind === 'move') this.ctx.ink.previewOffset(this.ctx.state().selection, 0, 0);
    this.mode = { kind: 'idle' };
    this.ctx.requestOverlay();
  }

  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewState): void {
    const accent = '#2563eb';
    const bounds = this.selectionBounds();
    if (bounds) {
      const dx = this.mode.kind === 'move' ? this.mode.dx : 0;
      const dy = this.mode.kind === 'move' ? this.mode.dy : 0;
      const a = boardToScreen(view, bounds.x + dx, bounds.y + dy);
      const pad = 4;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accent;
      ctx.strokeRect(
        a.x - pad,
        a.y - pad,
        bounds.width * view.scale + pad * 2,
        bounds.height * view.scale + pad * 2,
      );
      ctx.setLineDash([]);
    }
    if (this.mode.kind === 'marquee') {
      const { start, end } = this.mode;
      const x = Math.min(start.sx, end.sx);
      const y = Math.min(start.sy, end.sy);
      ctx.fillStyle = 'rgba(37,99,235,0.08)';
      ctx.fillRect(x, y, Math.abs(end.sx - start.sx), Math.abs(end.sy - start.sy));
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent;
      ctx.strokeRect(x, y, Math.abs(end.sx - start.sx), Math.abs(end.sy - start.sy));
    }
  }
}
