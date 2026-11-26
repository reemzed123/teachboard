import { visibleObjects } from '../../core/document/layers';
import { newId } from '../../core/document/ids';
import type { GeoElement, GeometryObject } from '../../core/document/types';
import {
  emptyGeometry,
  freeAncestors,
  hitElement,
  isDraggable,
  removeElements,
  solvedBounds,
  UNITS_PER_CM,
  type HitType,
  type Solution,
} from '../../core/geometry/construction';
import { toLocal } from '../../core/geometry/transform';
import { shapeError } from '../../core/geometry/shapes';
import {
  buildStep,
  CIRCLE_TOOLS,
  newPoint,
  ON_CIRCLE_TOOLS,
  TOOL_SLOTS,
  type Slot,
} from '../../core/geometry/tools';
import { currentPage, type ViewState } from '../../features/board/boardStore';
import { geometrySelection } from '../render/drawObject';
import { getSolution } from '../render/geoCache';
import { boardToScreen } from '../viewport';
import type { InputPoint, PointerSample, ToolContext, ToolHandler } from './types';

// כלי הגיאומטריה: בונה צעדים בבנייה של העמוד, ומאפשר לגרור נקודות (וכל הבנייה מתעדכנת).

const SLOT_HIT: Record<Slot, HitType[]> = {
  P: ['point'],
  L: ['line'],
  C: ['circle'],
  X: ['line', 'circle'],
  S: ['segment'],
  G: ['polygon'],
};

type Drag = {
  /** הנקודות החופשיות שזזות, ומיקומן ההתחלתי */
  ids: { id: string; x: number; y: number }[];
  start: { x: number; y: number };
  moved: boolean;
  current: GeometryObject;
};

export class GeometryTool implements ToolHandler {
  /** הקלטים שנבחרו עד עכשיו לכלי הנוכחי */
  private picked: string[] = [];
  private hoverLocal: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  /** הכלי שהקלטים שנאספו שייכים אליו (החלפת כלי מתחילה מחדש) */
  private pickedFor: string | null = null;

  constructor(private ctx: ToolContext) {}

  private prefs() {
    return this.ctx.state().prefs.geo;
  }

  /** הבנייה של העמוד (או null אם עוד אין) */
  private construction(): GeometryObject | null {
    const page = currentPage(this.ctx.state());
    return (
      (visibleObjects(page).find((o) => o.type === 'geometry' && !o.locked) as
        GeometryObject | undefined) ?? null
    );
  }

  private local(o: GeometryObject | null, p: InputPoint) {
    return o ? toLocal(o.transform, p.bx, p.by) : { x: p.bx, y: p.by };
  }

  private tol() {
    return 10 / this.ctx.view().scale;
  }

  /** שומר את הבנייה (צעד אחד לביטול) ומעדכן את המלבן שלה */
  private commit(label: string, next: GeometryObject, isNew: boolean) {
    const sol = getSolution(next);
    const withExtent: GeometryObject = sol ? { ...next, extent: solvedBounds(sol) } : next;
    const s = this.ctx.state();
    s.commit(label, [
      isNew
        ? { type: 'add', pageId: s.pageId, objects: [withExtent] }
        : { type: 'replace', pageId: s.pageId, objects: [withExtent] },
    ]);
  }

  private style() {
    return { color: this.prefs().color, width: 2 };
  }

  private setHighlight(o: GeometryObject | null, ids: string[]) {
    if (o) geometrySelection.set(o.id, new Set(ids));
    this.ctx.objects.layer.batchDraw();
  }

  down(s: PointerSample): void {
    const tool = this.prefs().tool;
    if (this.pickedFor !== tool) {
      this.picked = [];
      this.pickedFor = tool;
    }
    let o = this.construction();
    const sol = o ? getSolution(o) : null;
    if (o && !sol) return; // המנוע עוד נטען
    const p = this.local(o, s.point);
    const els = o?.elements ?? [];

    // ---- הזזה / בחירה ----
    if (tool === 'move' || tool === 'delete') {
      if (!o || !sol) return;
      const hit = hitElement(els, sol, p.x, p.y, this.tol(), 'any');
      if (tool === 'delete') {
        if (hit) this.commit('geoDelete', { ...o, elements: removeElements(els, [hit.id]) }, false);
        this.ctx.state().setGeoSelection(null);
        return;
      }
      this.ctx.state().setGeoSelection(hit ? { objectId: o.id, ids: [hit.id] } : null);
      this.setHighlight(o, hit ? [hit.id] : []);
      if (!hit) return;
      // נקודה חופשית/גולשת – גוררים אותה; קטע/מצולע – גוררים את כל הנקודות החופשיות שלו
      const ids = isDraggable(hit) ? [hit.id] : freeAncestors(els, hit.id);
      const pos = ids
        .map((id) => els.find((e) => e.id === id))
        .filter((e): e is GeoElement => !!e)
        .map((e) => ({ id: e.id, x: e.params?.x ?? 0, y: e.params?.y ?? 0 }));
      if (pos.length) this.drag = { ids: pos, start: p, moved: false, current: o };
      return;
    }

    // ---- כלי בנייה: איסוף קלטים ----
    // מעגל שנבחר מראש מהסרגל הקופץ
    const prefill = this.ctx.state().geoPrefill;
    if (prefill) {
      this.ctx.state().setGeoPrefill(null);
      if (this.picked.length === 0 && els.some((e) => e.id === prefill)) this.picked = [prefill];
    }

    // צורה ידועה עם מידות לא תקינות – לא בונים (ההסבר מופיע בחלונית)
    const shape = this.prefs().shape;
    if (tool === 'shape' && shapeError(shape.id, shape.dims)) return;
    const options = TOOL_SLOTS[tool];
    const step = this.picked.length;
    // נקודה קודמת לכל סוג אחר (לחיצה ליד קצה קטע = הנקודה)
    const needed: Slot[] = (
      tool === 'polygon'
        ? (['P'] as Slot[])
        : [...new Set(options.map((opt) => opt[step]).filter((x): x is Slot => !!x))]
    ).sort((a, b) => (a === 'P' ? -1 : 0) - (b === 'P' ? -1 : 0));
    if (needed.length === 0) return;

    let created: GeoElement | null = null;
    let chosen: string | null = null;

    // קודם: אלמנט קיים מהסוג המתאים (נקודה קיימת מקבלת עדיפות)
    if (o && sol) {
      outer: for (const slot of needed) {
        for (const type of SLOT_HIT[slot]) {
          const hit = hitElement(els, sol, p.x, p.y, this.tol(), type);
          if (hit) {
            chosen = hit.id;
            break outer;
          }
        }
      }
    }
    // במצולע: לחיצה על הנקודה הראשונה סוגרת אותו
    const closing =
      tool === 'polygon' && chosen !== null && chosen === this.picked[0] && this.picked.length >= 3;

    if (!chosen && needed.includes('P')) {
      // נקודה חדשה: על ישר/מעגל (גולשת) אם לחצו עליהם, אחרת חופשית
      const on = o && sol ? hitElement(els, sol, p.x, p.y, this.tol(), 'any') : null;
      // מיתר/רדיוס/זוויות במעגל: הנקודות החדשות תמיד על המעגל שנבחר
      const onPath =
        ON_CIRCLE_TOOLS.has(tool) && this.picked[0]
          ? this.picked[0]
          : on && (sol!.get(on.id)?.t === 'ln' || sol!.get(on.id)?.t === 'circ')
            ? on.id
            : undefined;
      created = newPoint(els, p.x, p.y, this.style(), onPath);
      chosen = created.id;
    }
    if (!chosen) return; // לחיצה שלא מתאימה לשלב הזה – מתעלמים

    // שומרים נקודה חדשה מיד (רואים אותה מייד, וגם אם הכלי לא יושלם)
    const isNew = !o;
    if (!o) o = emptyGeometry(newId());
    let elements = created ? [...o.elements, created] : o.elements;

    if (!closing) this.picked.push(chosen);
    const complete =
      tool === 'polygon'
        ? closing
        : options.some((opt) => opt.length === this.picked.length && this.matches(opt, elements));

    if (complete) {
      const byId = new Map(elements.map((e) => [e.id, e]));
      const added = buildStep(tool, this.picked, {
        elements,
        style: this.style(),
        n: this.prefs().n,
        r: this.prefs().radiusCm * UNITS_PER_CM,
        kindOf: (id) => byId.get(id)?.kind,
        parentsOf: (id) => byId.get(id)?.parents ?? [],
        shape,
        unitsPerCm: UNITS_PER_CM,
        posOf: (id) => {
          const s = sol?.get(id);
          if (s?.t === 'pt') return { x: s.x, y: s.y };
          const e = byId.get(id);
          return e?.params?.x !== undefined ? { x: e.params.x, y: e.params.y ?? 0 } : undefined;
        },
      });
      elements = [...elements, ...added];
      this.picked = [];
      // כלי מעגל (מהסרגל הקופץ): חוזרים לבחירה, והמעגל נשאר מסומן – אפשר להוסיף עוד
      if (CIRCLE_TOOLS.includes(tool)) {
        const circle = inputsCircle(added, elements);
        this.ctx.state().updatePrefs((p) => ({ ...p, geo: { ...p.geo, tool: 'move' } }));
        if (circle && o) {
          this.ctx.state().setGeoSelection({ objectId: o.id, ids: [circle] });
          this.setHighlight(o, [circle]);
        }
      }
    }
    if (created || complete) this.commit(tool, { ...o, elements }, isNew);
    this.ctx.requestOverlay();
  }

  /** האם הקלטים שנבחרו מתאימים לאפשרות (למשל [S] מול [P,P]) */
  private matches(opt: Slot[], elements: readonly GeoElement[]): boolean {
    const o = this.construction();
    const sol: Solution | null = o ? getSolution({ ...o, elements: [...elements] }) : null;
    return opt.every((slot, i) => {
      const id = this.picked[i];
      const s = id ? sol?.get(id) : undefined;
      if (!s) return slot === 'P';
      switch (slot) {
        case 'P':
          return s.t === 'pt';
        case 'L':
          return s.t === 'ln';
        case 'S':
          return s.t === 'ln' && s.mode === 'segment';
        case 'C':
          return s.t === 'circ' || s.t === 'arc' || s.t === 'curve';
        case 'X':
          return s.t === 'ln' || s.t === 'circ';
        case 'G':
          return s.t === 'poly' || s.t === 'circ';
      }
    });
  }

  move(s: PointerSample): void {
    const o = this.construction();
    this.hoverLocal = this.local(o, s.point);
    if (this.drag && o) {
      const p = this.hoverLocal;
      const dx = p.x - this.drag.start.x;
      const dy = p.y - this.drag.start.y;
      this.drag.moved = this.drag.moved || Math.hypot(dx, dy) * this.ctx.view().scale > 2;
      const pos = new Map(this.drag.ids.map((d) => [d.id, d]));
      const elements = o.elements.map((e) => {
        const d = pos.get(e.id);
        return d ? { ...e, params: { ...e.params, x: d.x + dx, y: d.y + dy } } : e;
      });
      this.drag.current = { ...o, elements };
      // תצוגה חיה: כל הבנייה מתעדכנת בזמן הגרירה
      this.ctx.objects.previewTransforms([this.drag.current]);
    }
    this.ctx.requestOverlay();
  }

  up(): void {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return;
    // נקודות גולשות נשמרות במיקום שעל הישר/המעגל
    const sol = getSolution(d.current);
    const elements = d.current.elements.map((e) => {
      const s = e.kind === 'glider' ? sol?.get(e.id) : undefined;
      return s && s.t === 'pt'
        ? {
            ...e,
            params: { ...e.params, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100 },
          }
        : e;
    });
    this.commit('geoMove', { ...d.current, elements }, false);
  }

  cancel(): void {
    if (this.drag) {
      const o = this.construction();
      if (o) this.ctx.objects.resetPreview([o.id]);
    }
    this.drag = null;
    this.picked = [];
    this.ctx.requestOverlay();
  }

  hover(p: InputPoint | null): void {
    const o = this.construction();
    this.hoverLocal = p ? this.local(o, p) : null;
    this.ctx.requestOverlay();
  }

  /** קו "גומי" מהנקודה האחרונה שנבחרה אל העט, ונקודות שנבחרו מודגשות */
  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewState): void {
    const o = this.construction();
    if (!o || this.picked.length === 0) return;
    const sol = getSolution(o);
    if (!sol) return;
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = 'rgba(37,99,235,0.25)';
    let last: { x: number; y: number } | null = null;
    for (const id of this.picked) {
      const s = sol.get(id);
      if (s?.t !== 'pt') continue;
      const w = boardToScreen(view, s.x + o.transform.x, s.y + o.transform.y);
      ctx.beginPath();
      ctx.arc(w.x, w.y, 9, 0, Math.PI * 2);
      ctx.fill();
      last = w;
    }
    if (last && this.hoverLocal) {
      const h = boardToScreen(
        view,
        this.hoverLocal.x + o.transform.x,
        this.hoverLocal.y + o.transform.y,
      );
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const tool = this.prefs().tool;
      if (tool === 'circle' && this.picked.length === 1) {
        ctx.arc(last.x, last.y, Math.hypot(h.x - last.x, h.y - last.y), 0, Math.PI * 2);
      } else {
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(h.x, h.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/** המעגל שהבנייה נשענת עליו (כדי להשאיר אותו מסומן) */
function inputsCircle(
  added: readonly GeoElement[],
  elements: readonly GeoElement[],
): string | null {
  const kinds = new Set(['circle', 'circleR', 'circle3', 'arc']);
  const byId = new Map(elements.map((e) => [e.id, e]));
  for (const e of added) {
    for (const p of [e.id, ...e.parents]) {
      const el = byId.get(p);
      if (!el) continue;
      if (kinds.has(el.kind) && !el.style.hidden) return el.id;
      // נקודה על מעגל
      const parent = el.kind === 'glider' ? byId.get(el.parents[0] ?? '') : undefined;
      if (parent && kinds.has(parent.kind)) return parent.id;
    }
  }
  return null;
}
