import Konva from 'konva';
import { inflate, unionRects, type Rect } from '../core/geometry/rect';
import {
  currentPage,
  type BoardState,
  type BoardStore,
  type ViewState,
} from '../features/board/boardStore';
import type { ToolId } from '../features/board/toolPrefs';
import { BackgroundLayer, type ImageSource } from './render/BackgroundLayer';
import { onMathReady } from './render/mathCache';
import { loadGeometryKernel, onGeometryReady } from './render/geoCache';
import { geometrySelection } from './render/drawObject';
import { ObjectLayer } from './render/ObjectLayer';
import { LiveCanvas } from './render/LiveCanvas';
import { EraserTool } from './tools/EraserTool';
import { InkTool } from './tools/InkTool';
import { SelectTool } from './tools/SelectTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { GeometryTool } from './tools/GeometryTool';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './tools/types';
import { fitRect, screenToBoard, visibleBoardRect, zoomAt } from './viewport';

type Gesture =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | {
      kind: 'pinch';
      startDist: number;
      startMidX: number;
      startMidY: number;
      startView: ViewState;
    };

/** כמה זמן אחרי סוף תנועת גלילה/זום מציירים את הלוח מחדש בחדות. */
const SETTLE_MS = 120;
/** בזמן תנועה ארוכה – ציור חד מחדש לכל היותר בתדירות הזו. */
const LIVE_RENDER_MS = 150;

/**
 * מנוע הלוח: מחבר בין הקלט (עט, עכבר, מגע), הכלים, והציור.
 * לא תלוי ב-React – הממשק רק יוצר אותו ומשמיד אותו.
 */
export class BoardEngine {
  private stageEl = document.createElement('div');
  private stage: Konva.Stage;
  private objects = new ObjectLayer();
  private background: BackgroundLayer;
  private live = new LiveCanvas();
  private overlay = document.createElement('canvas');
  private overlayCtx: CanvasRenderingContext2D;
  private tools: Record<Exclude<ToolId, 'hand'>, ToolHandler>;

  private width = 0;
  private height = 0;
  private hostRect: DOMRect;
  private view: ViewState;
  private renderedView: ViewState;
  private lastRenderAt = 0;
  private settleTimer = 0;
  private overlayFrame = 0;

  private activeTool: ToolHandler | null = null;
  private activePointerId: number | null = null;
  private gesture: Gesture | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private spaceDown = false;
  private readonly rawUpdates = typeof window !== 'undefined' && 'onpointerrawupdate' in window;
  /** האם התקבל pointerrawupdate בקו הנוכחי (אם לא – עובדים עם pointermove הרגיל) */
  private rawSeen = false;
  private disposers: (() => void)[] = [];
  /** סמן זמני שהכלי ביקש (למשל מעל ידית סיבוב) */
  private toolCursor: string | null = null;
  /** כל עוד המורה לא הזיז/הגדיל ידנית – התצוגה מתאימה את עצמה לגודל המסך */
  private autoFit = false;

  constructor(
    private host: HTMLElement,
    private store: BoardStore,
    images: ImageSource | null = null,
  ) {
    this.background = new BackgroundLayer(images);
    // נוסחה שסיימה להיטען – מציירים מחדש
    this.disposers.push(onMathReady(() => this.objects.layer.batchDraw()));
    this.disposers.push(onGeometryReady(() => this.objects.layer.batchDraw()));
    const offImages = images?.onChange?.(() => this.renderView());
    if (offImages) this.disposers.push(offImages);
    host.classList.add('tb-board-host');
    this.stageEl.className = 'tb-board-stage';
    this.overlay.className = 'tb-board-overlay';
    host.append(this.stageEl, this.live.canvas, this.overlay);
    const octx = this.overlay.getContext('2d');
    if (!octx) throw new Error('Canvas 2D is not available');
    this.overlayCtx = octx;

    this.hostRect = host.getBoundingClientRect();
    this.width = Math.max(1, Math.round(this.hostRect.width));
    this.height = Math.max(1, Math.round(this.hostRect.height));
    this.stage = new Konva.Stage({
      container: this.stageEl,
      width: this.width,
      height: this.height,
    });
    this.stage.add(this.background.layer);
    this.stage.add(this.objects.layer);

    const ctx: ToolContext = {
      store,
      state: () => store.getState(),
      view: () => this.view,
      objects: this.objects,
      live: this.live,
      requestOverlay: () => this.requestOverlay(),
      setCursor: (cursor) => {
        this.toolCursor = cursor;
        this.updateCursor();
      },
    };
    this.tools = {
      pen: new InkTool(ctx, 'pen'),
      highlighter: new InkTool(ctx, 'highlighter'),
      eraser: new EraserTool(ctx),
      select: new SelectTool(ctx),
      line: new ShapeTool(ctx, 'line'),
      arrow: new ShapeTool(ctx, 'arrow'),
      text: new TextTool(ctx),
      geometry: new GeometryTool(ctx),
    };

    this.view = store.getState().view;
    this.renderedView = this.view;
    this.objects.sync(currentPage(store.getState()).objects);
    this.resize();
    this.restorePageView();
    this.updateCursor();

    this.listen();
  }

  // ---------- חיבור לאירועים ----------

  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as EventListener, opts);
    this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
  }

  private listen() {
    const h = this.host;
    this.on(h, 'pointerdown', (e) => this.onPointerDown(e));
    this.on(h, 'pointermove', (e) => this.onPointerMove(e));
    // pointerrawupdate: אירועי עט מיידיים, בלי לחכות לפריים הבא (פחות השהיה). קיים ב-Chrome/Edge.
    if (this.rawUpdates) {
      this.on(h, 'pointerrawupdate' as keyof HTMLElementEventMap, (e) =>
        this.onRawUpdate(e as PointerEvent),
      );
    }
    this.on(h, 'pointerup', (e) => this.onPointerUp(e, false));
    this.on(h, 'pointercancel', (e) => this.onPointerUp(e, true));
    this.on(h, 'pointerleave', () => this.currentHandler()?.hover?.(null));
    this.on(h, 'wheel', (e) => this.onWheel(e), { passive: false });
    // לחצן הצד של העט / קליק ימני לא פותח תפריט מעל הלוח.
    this.on(h, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'keydown', (e) => this.onKey(e, true));
    this.on(window, 'keyup', (e) => this.onKey(e, false));
    this.on(window, 'blur', () => {
      this.spaceDown = false;
      this.updateCursor();
    });

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(h);
    this.disposers.push(() => ro.disconnect());

    const unsub = this.store.subscribe((s, prev) => this.onStoreChange(s, prev));
    this.disposers.push(unsub);
  }

  private onStoreChange(s: BoardState, prev: BoardState) {
    const pageChanged = s.pageId !== prev.pageId || s.docEpoch !== prev.docEpoch;
    if (pageChanged) {
      this.activeTool?.cancel();
      this.activeTool = null;
      this.activePointerId = null;
    }
    if (s.doc !== prev.doc || pageChanged) {
      this.objects.sync(currentPage(s).objects);
      this.requestOverlay();
    }
    if (pageChanged) {
      this.restorePageView();
    } else if (currentPage(s) !== currentPage(prev)) {
      // רקע/סוג העמוד השתנו – מציירים מחדש את הרקע.
      this.renderView();
    }
    if (s.selection !== prev.selection) this.requestOverlay();
    if (s.tool !== prev.tool) {
      this.activeTool?.cancel();
      this.activeTool = null;
      this.activePointerId = null;
      if (prev.tool !== 'hand') this.tools[prev.tool].hover?.(null);
      this.toolCursor = null;
      // מנוע הגיאומטריה נטען רק כשבוחרים בכלי (לא בכל הפעלה של התוכנה)
      if (s.tool === 'geometry') void loadGeometryKernel();
      if (prev.tool === 'geometry') {
        // יוצאים מהגיאומטריה: מבטלים הדגשות
        geometrySelection.clear();
        s.setGeoSelection(null);
        this.objects.layer.batchDraw();
      }
      this.updateCursor();
      this.requestOverlay();
    }
    if (s.prefs !== prev.prefs) this.requestOverlay();
    // טקסט בעריכה מוסתר מהלוח (תיבת העריכה מוצגת במקומו)
    if (s.textEdit !== prev.textEdit) {
      this.objects.setHidden(s.textEdit?.id ? [s.textEdit.id] : []);
    }
    // שינוי תצוגה שהגיע מבחוץ (כפתורי זום) – מציירים מיד.
    if (s.view !== prev.view && s.view !== this.view) {
      this.autoFit = false;
      this.view = s.view;
      this.renderView();
    }
  }

  // ---------- קלט ----------

  private point(e: PointerEvent): InputPoint {
    const sx = e.clientX - this.hostRect.left;
    const sy = e.clientY - this.hostRect.top;
    const b = screenToBoard(this.view, sx, sy);
    return {
      sx,
      sy,
      bx: b.x,
      by: b.y,
      pressure: e.pressure,
      pointerType: e.pointerType,
      t: e.timeStamp,
    };
  }

  private sample(e: PointerEvent, withCoalesced: boolean): PointerSample {
    // "חיזוי" תנועת העט (getPredictedEvents) הוסר בכוונה: עם Windows Ink הוא גרם לרעד בקצה הקו.
    const coalesced =
      withCoalesced && typeof e.getCoalescedEvents === 'function'
        ? e.getCoalescedEvents().map((c) => this.point(c))
        : [];
    return { point: this.point(e), coalesced, shiftKey: e.shiftKey };
  }

  private currentHandler(): ToolHandler | null {
    const tool = this.store.getState().tool;
    return tool === 'hand' ? null : this.tools[tool];
  }

  private onPointerDown(e: PointerEvent) {
    // מרגע שהמורה מתחיל לעבוד על הלוח – התצוגה לא זזה מעצמה
    // (למשל כשהחלונית נסגרת אוטומטית והלוח מתרחב, באמצע קו).
    this.autoFit = false;
    this.hostRect = this.host.getBoundingClientRect();
    const state = this.store.getState();
    if (e.pointerType === 'pen') state.markPen(e.pressure > 0 && e.pressure !== 0.5);

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        // שתי אצבעות: מבטלים את מה שהאצבע הראשונה התחילה, ועוברים לזום/הזזה.
        this.activeTool?.cancel();
        this.activeTool = null;
        this.activePointerId = null;
        this.startPinch();
        return;
      }
      if (this.touches.size > 2) return;
      // אחרי שזוהה עט: אצבע אחת מזיזה את הלוח ולא מציירת (מונע ציור בכף היד).
      if (state.penDetected) {
        this.startPan(e);
        return;
      }
    }

    if (e.button === 1 || this.spaceDown || state.tool === 'hand') {
      this.startPan(e);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // קצה המחק של העט מפעיל מחק זמנית.
    const penEraser = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0);
    const handler = penEraser ? this.tools.eraser : this.currentHandler();
    if (!handler) return;

    e.preventDefault();
    this.capture(e.pointerId);
    this.activeTool = handler;
    this.activePointerId = e.pointerId;
    this.rawSeen = false;
    handler.down(this.sample(e, false));
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.gesture?.kind === 'pinch') {
        this.updatePinch();
        return;
      }
    }
    if (this.gesture?.kind === 'pan' && this.gesture.pointerId === e.pointerId) {
      const dx = e.clientX - this.gesture.lastX;
      const dy = e.clientY - this.gesture.lastY;
      this.gesture.lastX = e.clientX;
      this.gesture.lastY = e.clientY;
      this.setViewLive({ ...this.view, x: this.view.x + dx, y: this.view.y + dy });
      return;
    }
    if (this.activeTool && e.pointerId === this.activePointerId) {
      // כשמגיעים אירועי pointerrawupdate – התנועה כבר טופלה שם.
      if (!this.rawSeen) this.activeTool.move(this.sample(e, true));
      return;
    }
    if (e.pointerType !== 'touch' && !this.activeTool) {
      this.currentHandler()?.hover?.(this.point(e));
    }
  }

  private onRawUpdate(e: PointerEvent) {
    if (this.activeTool && e.pointerId === this.activePointerId && !this.gesture) {
      this.rawSeen = true;
      this.activeTool.move(this.sample(e, true));
    }
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean) {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.gesture?.kind === 'pinch' && this.touches.size < 2) {
        this.gesture = null;
        this.settleNow();
        return;
      }
    }
    if (this.gesture?.kind === 'pan' && this.gesture.pointerId === e.pointerId) {
      this.gesture = null;
      this.updateCursor();
      this.settleNow();
      return;
    }
    if (this.activeTool && e.pointerId === this.activePointerId) {
      const tool = this.activeTool;
      this.activeTool = null;
      this.activePointerId = null;
      if (cancelled) tool.cancel();
      else tool.up(this.sample(e, false));
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.hostRect = this.host.getBoundingClientRect();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+גלגלת או צביטה במשטח מגע: זום סביב העכבר.
      const sx = e.clientX - this.hostRect.left;
      const sy = e.clientY - this.hostRect.top;
      this.setViewLive(zoomAt(this.view, sx, sy, this.view.scale * Math.exp(-dy * 0.0025)));
    } else if (e.shiftKey && dx === 0) {
      this.setViewLive({ ...this.view, x: this.view.x - dy });
    } else {
      this.setViewLive({ ...this.view, x: this.view.x - dx, y: this.view.y - dy });
    }
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.code !== 'Space') return;
    const target = e.target as HTMLElement | null;
    const typing =
      target &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'MATH-FIELD'].includes(target.tagName));
    if (typing) return;
    e.preventDefault();
    if (this.spaceDown !== down) {
      this.spaceDown = down;
      this.updateCursor();
    }
  }

  /** "תופס" את העט/העכבר, כדי לקבל אירועים גם אם יצא מגבולות הלוח. */
  private capture(pointerId: number) {
    try {
      this.host.setPointerCapture(pointerId);
    } catch {
      // לא קריטי: בלי תפיסה, יציאה מהלוח באמצע קו פשוט תסיים אותו.
    }
  }

  // ---------- מחוות הזזה וזום ----------

  private startPan(e: PointerEvent) {
    e.preventDefault();
    this.capture(e.pointerId);
    this.gesture = { kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    this.host.style.cursor = 'grabbing';
  }

  private pinchMetrics() {
    const [a, b] = [...this.touches.values()];
    return {
      dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1,
      midX: (a!.x + b!.x) / 2 - this.hostRect.left,
      midY: (a!.y + b!.y) / 2 - this.hostRect.top,
    };
  }

  private startPinch() {
    const m = this.pinchMetrics();
    this.gesture = {
      kind: 'pinch',
      startDist: m.dist,
      startMidX: m.midX,
      startMidY: m.midY,
      startView: this.view,
    };
  }

  private updatePinch() {
    if (this.gesture?.kind !== 'pinch' || this.touches.size < 2) return;
    const g = this.gesture;
    const m = this.pinchMetrics();
    const b = screenToBoard(g.startView, g.startMidX, g.startMidY);
    const zoomed = zoomAt(
      g.startView,
      g.startMidX,
      g.startMidY,
      (g.startView.scale * m.dist) / g.startDist,
    );
    this.setViewLive({
      scale: zoomed.scale,
      x: m.midX - b.x * zoomed.scale,
      y: m.midY - b.y * zoomed.scale,
    });
  }

  // ---------- תצוגה וציור ----------

  /**
   * עדכון תצוגה בזמן תנועה: מזיזים את התמונה הקיימת של הלוח (מהיר מאוד),
   * ומציירים מחדש בחדות רק מדי פעם ובסוף התנועה.
   */
  private setViewLive(view: ViewState) {
    this.autoFit = false;
    this.view = view;
    this.store.getState().setView(view);
    const r = this.renderedView;
    const k = view.scale / r.scale;
    const transform = `matrix(${k},0,0,${k},${view.x - r.x * k},${view.y - r.y * k})`;
    for (const layer of [this.background.layer, this.objects.layer]) {
      const canvas = layer.getNativeCanvasElement();
      canvas.style.transformOrigin = '0 0';
      canvas.style.transform = transform;
    }
    this.requestOverlay();

    const now = performance.now();
    if (now - this.lastRenderAt > LIVE_RENDER_MS) this.renderView();
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.renderView(), SETTLE_MS);
  }

  private settleNow() {
    clearTimeout(this.settleTimer);
    this.renderView();
  }

  private renderView() {
    const v = this.view;
    this.stage.position({ x: v.x, y: v.y });
    this.stage.scale({ x: v.scale, y: v.scale });
    const visible = visibleBoardRect(v, this.width, this.height);
    const page = currentPage(this.store.getState());
    this.host.dataset.layout = page.layout;
    this.background.update(page, visible, v.scale);
    this.background.layer.draw();
    this.background.layer.getNativeCanvasElement().style.transform = '';
    this.objects.setViewRect(inflate(visible, 64 / v.scale));
    this.objects.layer.draw();
    this.objects.layer.getNativeCanvasElement().style.transform = '';
    this.renderedView = v;
    this.lastRenderAt = performance.now();
    this.requestOverlay();
  }

  private resize() {
    this.hostRect = this.host.getBoundingClientRect();
    this.width = Math.max(1, Math.round(this.hostRect.width));
    this.height = Math.max(1, Math.round(this.hostRect.height));
    this.stage.size({ width: this.width, height: this.height });
    this.live.resize(this.width, this.height);
    this.activeTool?.redrawLive?.();
    const dpr = window.devicePixelRatio || 1;
    this.overlay.width = Math.round(this.width * dpr);
    this.overlay.height = Math.round(this.height * dpr);
    this.overlay.style.width = `${this.width}px`;
    this.overlay.style.height = `${this.height}px`;
    if (this.autoFit) this.fitContent();
    else this.renderView();
  }

  private requestOverlay() {
    if (this.overlayFrame) return;
    this.overlayFrame = requestAnimationFrame(() => {
      this.overlayFrame = 0;
      const ctx = this.overlayCtx;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.currentHandler()?.drawOverlay?.(ctx, this.view);
    });
  }

  private updateCursor() {
    if (this.gesture?.kind === 'pan') return;
    const tool = this.store.getState().tool;
    this.host.dataset.tool = tool;
    this.host.style.cursor =
      this.spaceDown || tool === 'hand'
        ? 'grab'
        : (this.toolCursor ??
          (tool === 'eraser'
            ? 'none'
            : tool === 'select'
              ? 'default'
              : tool === 'text'
                ? 'text'
                : 'crosshair'));
  }

  // ---------- פעולות חיצוניות (כפתורי זום) ----------

  private setView(view: ViewState) {
    this.view = view;
    this.store.getState().setView(view);
    this.renderView();
  }

  zoomBy(factor: number) {
    this.autoFit = false;
    this.setView(zoomAt(this.view, this.width / 2, this.height / 2, this.view.scale * factor));
  }

  zoomTo(scale: number) {
    this.autoFit = false;
    this.setView(zoomAt(this.view, this.width / 2, this.height / 2, scale));
  }

  /**
   * התאמה למסך: בעמוד מחברת – כל העמוד (וגם תוכן שחורג ממנו);
   * בלוח אינסופי – כל התוכן, ובלוח ריק – חזרה להתחלה ב-100%.
   */
  fitContent() {
    const page = currentPage(this.store.getState());
    const parts = page.objects
      .map((o) => this.objects.boundsOf(o.id))
      .filter((r): r is Rect => !!r);
    if (page.layout === 'bounded') parts.push({ x: 0, y: 0, ...page.size });
    const bounds = unionRects(parts);
    // משאירים מקום לסרגלי העמודים והזום בתחתית.
    const bottomBars = 56;
    this.setView(
      bounds
        ? fitRect(bounds, this.width, Math.max(100, this.height - bottomBars), 20, 4)
        : { x: 0, y: 0, scale: 1 },
    );
    this.autoFit = true;
  }

  /** חזרה לתצוגה האחרונה של העמוד, או התאמה למסך אם אין. */
  private restorePageView() {
    const s = this.store.getState();
    const saved = s.pageViews[s.pageId];
    if (saved) {
      this.autoFit = false;
      this.setView(saved);
      return;
    }
    const page = currentPage(s);
    if (page.layout === 'bounded' || page.objects.length > 0) this.fitContent();
    else {
      this.autoFit = false;
      this.setView({ x: this.width / 2, y: this.height / 2, scale: 1 });
    }
  }

  get objectCount(): number {
    return this.objects.count;
  }

  destroy() {
    clearTimeout(this.settleTimer);
    cancelAnimationFrame(this.overlayFrame);
    this.activeTool?.cancel();
    for (const d of this.disposers) d();
    this.objects.destroy();
    this.stage.destroy();
    this.host.replaceChildren();
    this.host.classList.remove('tb-board-host');
  }
}
