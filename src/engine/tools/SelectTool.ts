import type { BoardObject, ObjectId } from '../../core/document/types';
import {
  rectFromPoints,
  rectsIntersect,
  unionRects,
  type Point,
  type Rect,
} from '../../core/geometry/rect';
import { transformAround } from '../../core/geometry/transform';
import { expandGroups } from '../../core/objects/edit';
import { objectBounds, objectHitsPoint, objectIntersectsRect } from '../../core/objects/geometry';
import { currentPage, type ViewState } from '../../features/board/boardStore';
import { boardToScreen } from '../viewport';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// בחירה ועריכה:
//  - לחיצה על אובייקט בוחרת אותו (וגם את כל הקבוצה שלו). Shift מוסיף.
//  - גרירה בשטח ריק מסמנת מלבן.
//  - גרירת הבחירה מזיזה; ידיות בפינות משנות גודל; הידית העליונה מסובבת (Shift = קפיצות של 15°).
//  - לחיצה כפולה על טקסט פותחת אותו לעריכה.

type Mode =
  | { kind: 'idle' }
  | { kind: 'marquee'; start: InputPoint; end: InputPoint }
  | { kind: 'move'; start: InputPoint; dx: number; dy: number }
  | { kind: 'scale'; pivot: Point; startDist: number; k: number }
  | { kind: 'rotate'; center: Point; startAngle: number; angle: number };

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

const HANDLE_RADIUS = 11;
const ROTATE_OFFSET = 28;
const PAD = 6;

export class SelectTool implements ToolHandler {
  private mode: Mode = { kind: 'idle' };
  private originals: BoardObject[] = [];
  private lastClick = { id: '' as ObjectId, at: 0 };

  constructor(private ctx: ToolContext) {}

  private page() {
    return currentPage(this.ctx.state());
  }

  private selected(): BoardObject[] {
    const ids = new Set(this.ctx.state().selection);
    return this.page().objects.filter((o) => ids.has(o.id));
  }

  private hitTest(p: InputPoint): BoardObject | null {
    const objects = this.page().objects;
    const tol = 6 / this.ctx.view().scale;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]!;
      if (!o.locked && objectHitsPoint(o, p.bx, p.by, tol)) return o;
    }
    return null;
  }

  private boundsOf(objs: readonly BoardObject[]): Rect | null {
    return unionRects(objs.map(objectBounds));
  }

  /** האובייקטים במצב התצוגה הזמנית (בזמן גרירה/סיבוב/הגדלה) */
  private previewObjects(): BoardObject[] {
    const m = this.mode;
    if (m.kind === 'move') {
      return this.originals.map((o) => ({
        ...o,
        transform: { ...o.transform, x: o.transform.x + m.dx, y: o.transform.y + m.dy },
      }));
    }
    if (m.kind === 'scale') {
      return this.originals.map((o) => ({
        ...o,
        transform: transformAround(o.transform, m.pivot, 0, m.k),
      }));
    }
    if (m.kind === 'rotate') {
      return this.originals.map((o) => ({
        ...o,
        transform: transformAround(o.transform, m.center, m.angle, 1),
      }));
    }
    return this.selected();
  }

  /** מיקומי הידיות במסך */
  private handles(view: ViewState, b: Rect): Record<Handle, Point> {
    const a = boardToScreen(view, b.x, b.y);
    const w = b.width * view.scale;
    const h = b.height * view.scale;
    const x1 = a.x - PAD;
    const y1 = a.y - PAD;
    const x2 = a.x + w + PAD;
    const y2 = a.y + h + PAD;
    return {
      nw: { x: x1, y: y1 },
      ne: { x: x2, y: y1 },
      sw: { x: x1, y: y2 },
      se: { x: x2, y: y2 },
      rotate: { x: (x1 + x2) / 2, y: y1 - ROTATE_OFFSET },
    };
  }

  private handleAt(p: InputPoint): Handle | null {
    const b = this.boundsOf(this.selected());
    if (!b) return null;
    const hs = this.handles(this.ctx.view(), b);
    for (const k of Object.keys(hs) as Handle[]) {
      if (Math.hypot(hs[k].x - p.sx, hs[k].y - p.sy) <= HANDLE_RADIUS) return k;
    }
    return null;
  }

  down(s: PointerSample): void {
    const p = s.point;
    const state = this.ctx.state();
    const page = this.page();
    this.originals = this.selected();

    const handle = this.originals.length ? this.handleAt(p) : null;
    if (handle) {
      const b = this.boundsOf(this.originals)!;
      if (handle === 'rotate') {
        const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        this.mode = {
          kind: 'rotate',
          center,
          startAngle: Math.atan2(p.by - center.y, p.bx - center.x),
          angle: 0,
        };
      } else {
        // שינוי גודל סביב הפינה הנגדית
        const pivot = {
          x: handle === 'nw' || handle === 'sw' ? b.x + b.width : b.x,
          y: handle === 'nw' || handle === 'ne' ? b.y + b.height : b.y,
        };
        this.mode = {
          kind: 'scale',
          pivot,
          startDist: Math.max(1e-6, Math.hypot(p.bx - pivot.x, p.by - pivot.y)),
          k: 1,
        };
      }
      return;
    }

    const hit = this.hitTest(p);
    const b = this.boundsOf(this.originals);
    const insideSelection =
      b && p.bx >= b.x && p.bx <= b.x + b.width && p.by >= b.y && p.by <= b.y + b.height;

    // לחיצה כפולה על טקסט → עריכה
    if (hit?.type === 'text') {
      const now = performance.now();
      if (this.lastClick.id === hit.id && now - this.lastClick.at < 400) {
        this.mode = { kind: 'idle' };
        state.startTextEdit({ id: hit.id, x: hit.transform.x, y: hit.transform.y });
        return;
      }
      this.lastClick = { id: hit.id, at: now };
    }

    if (hit && !state.selection.includes(hit.id)) {
      const group = expandGroups(page.objects, [hit.id]);
      state.setSelection(s.shiftKey ? [...new Set([...state.selection, ...group])] : group);
      this.originals = this.selected();
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
    const m = this.mode;
    switch (m.kind) {
      case 'marquee':
        m.end = p;
        break;
      case 'move':
        m.dx = p.bx - m.start.bx;
        m.dy = p.by - m.start.by;
        break;
      case 'scale':
        m.k = Math.max(0.05, Math.hypot(p.bx - m.pivot.x, p.by - m.pivot.y) / m.startDist);
        break;
      case 'rotate': {
        let angle =
          ((Math.atan2(p.by - m.center.y, p.bx - m.center.x) - m.startAngle) * 180) / Math.PI;
        if (s.shiftKey) angle = Math.round(angle / 15) * 15;
        m.angle = angle;
        break;
      }
      default:
        return;
    }
    if (m.kind !== 'marquee') this.ctx.objects.previewTransforms(this.previewObjects());
    this.ctx.requestOverlay();
  }

  up(s: PointerSample): void {
    const state = this.ctx.state();
    const m = this.mode;
    if (m.kind === 'marquee') {
      const rect = rectFromPoints({ x: m.start.bx, y: m.start.by }, { x: m.end.bx, y: m.end.by });
      if (rect.width > 0 || rect.height > 0) {
        const page = this.page();
        const found = page.objects
          .filter(
            (o) =>
              !o.locked && rectsIntersect(objectBounds(o), rect) && objectIntersectsRect(o, rect),
          )
          .map((o) => o.id);
        const withGroups = expandGroups(page.objects, found);
        state.setSelection(
          s.shiftKey ? [...new Set([...state.selection, ...withGroups])] : withGroups,
        );
      }
    } else if (m.kind === 'move' || m.kind === 'scale' || m.kind === 'rotate') {
      const changed =
        (m.kind === 'move' && (m.dx !== 0 || m.dy !== 0)) ||
        (m.kind === 'scale' && m.k !== 1) ||
        (m.kind === 'rotate' && m.angle !== 0);
      if (changed) {
        state.commit(m.kind, [
          { type: 'replace', pageId: state.pageId, objects: this.previewObjects() },
        ]);
      }
    }
    this.mode = { kind: 'idle' };
    this.originals = [];
    this.ctx.requestOverlay();
  }

  cancel(): void {
    if (this.mode.kind !== 'idle' && this.mode.kind !== 'marquee') {
      this.ctx.objects.resetPreview(this.originals.map((o) => o.id));
    }
    this.mode = { kind: 'idle' };
    this.originals = [];
    this.ctx.requestOverlay();
  }

  hover(p: InputPoint | null): void {
    const h = p && this.mode.kind === 'idle' ? this.handleAt(p) : null;
    this.ctx.setCursor(
      h === 'rotate' ? 'grab' : h === 'nw' || h === 'se' ? 'nwse-resize' : h ? 'nesw-resize' : null,
    );
  }

  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewState): void {
    const accent = '#2563eb';
    const objs =
      this.mode.kind === 'idle' || this.mode.kind === 'marquee'
        ? this.selected()
        : this.previewObjects();
    const b = this.boundsOf(objs);
    if (b) {
      const hs = this.handles(view, b);
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = accent;
      ctx.strokeRect(hs.nw.x, hs.nw.y, hs.se.x - hs.nw.x, hs.se.y - hs.nw.y);
      ctx.setLineDash([]);
      // קו לידית הסיבוב
      ctx.beginPath();
      ctx.moveTo(hs.rotate.x, hs.nw.y);
      ctx.lineTo(hs.rotate.x, hs.rotate.y);
      ctx.stroke();
      for (const k of Object.keys(hs) as Handle[]) {
        ctx.beginPath();
        ctx.arc(hs[k].x, hs[k].y, k === 'rotate' ? 7 : 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = accent;
        ctx.stroke();
      }
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
