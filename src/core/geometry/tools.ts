import { newId } from '../document/ids';
import type { GeoElement, GeoKind, GeoStyle, MeasureKind } from '../document/types';
import { nextPointLabel } from './construction';
import { planShape, type ShapeDims, type ShapeId } from './shapes';

// כלי הבנייה: מה כל כלי צריך (נקודות/ישרים/מעגלים), ואילו צעדים הוא מוסיף לבנייה.

export type GeoToolId =
  | 'move'
  | 'point'
  | 'segment'
  | 'line'
  | 'ray'
  | 'polygon'
  | 'regularPolygon'
  | 'shape'
  | 'circle'
  | 'circleR'
  | 'circle3'
  | 'arc'
  | 'ellipse'
  | 'chord'
  | 'radius'
  | 'centralAngle'
  | 'inscribedAngle'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'parallel'
  | 'perpBisector'
  | 'angleBisector'
  | 'median'
  | 'altitude'
  | 'tangent'
  | 'angle'
  | 'length'
  | 'area'
  | 'perimeter'
  | 'delete';

/** P נקודה, L ישר/קטע, C מעגל/קשת, X ישר או מעגל, S קטע, G מצולע או מעגל */
export type Slot = 'P' | 'L' | 'C' | 'X' | 'S' | 'G';

/** לכל כלי – אפשרויות קלט (למשל אמצע: שתי נקודות, או קטע אחד) */
export const TOOL_SLOTS: Record<GeoToolId, Slot[][]> = {
  move: [],
  delete: [],
  point: [['P']],
  segment: [['P', 'P']],
  line: [['P', 'P']],
  ray: [['P', 'P']],
  polygon: [], // נקודות עד סגירה
  regularPolygon: [['P', 'P']],
  shape: [['P']],
  circle: [['P', 'P']],
  circleR: [['P']],
  circle3: [['P', 'P', 'P']],
  arc: [['P', 'P', 'P']],
  ellipse: [['P', 'P', 'P']],
  chord: [['C', 'P', 'P']],
  radius: [['C', 'P']],
  centralAngle: [['C', 'P', 'P']],
  inscribedAngle: [['C', 'P', 'P', 'P']],
  midpoint: [['S'], ['P', 'P']],
  intersection: [['X', 'X']],
  perpendicular: [['L', 'P']],
  parallel: [['L', 'P']],
  perpBisector: [['S'], ['P', 'P']],
  angleBisector: [['P', 'P', 'P']],
  median: [['P', 'S']],
  altitude: [['P', 'L']],
  tangent: [['P', 'C']],
  angle: [['P', 'P', 'P']],
  length: [['S'], ['C']],
  area: [['G']],
  perimeter: [['G']],
};

export interface BuildContext {
  elements: readonly GeoElement[];
  style: Pick<GeoStyle, 'color' | 'width'>;
  /** מספר צלעות למצולע משוכלל */
  n: number;
  /** רדיוס (יחידות לוח) למעגל ברדיוס נתון */
  r: number;
  /** סוג כל קלט שנבחר (לפי ה-id) */
  kindOf(id: string): GeoKind | undefined;
  parentsOf(id: string): string[];
  /** צורה ידועה: סוג, מידות (ס"מ/מעלות), גודל קבוע או חופשי */
  shape?: { id: ShapeId; dims: ShapeDims; fixed: boolean };
  /** יחידות לוח בס"מ */
  unitsPerCm?: number;
  /** מיקום נקודה (לבניית הצורה סביב הנקודה שנלחצה) */
  posOf?(id: string): { x: number; y: number } | undefined;
}

/** הכלים שבהם נקודה חדשה נוצרת על המעגל שנבחר ראשון */
export const ON_CIRCLE_TOOLS: ReadonlySet<GeoToolId> = new Set([
  'chord',
  'radius',
  'centralAngle',
  'inscribedAngle',
]);

/** בונה את הצעדים החדשים מהקלטים שנבחרו */
export function buildStep(tool: GeoToolId, inputs: string[], ctx: BuildContext): GeoElement[] {
  const out: GeoElement[] = [];
  const all = () => [...ctx.elements, ...out];
  const mk = (kind: GeoKind, parents: string[], extra: Partial<GeoElement> = {}): GeoElement => {
    const e: GeoElement = { id: newId('e'), kind, parents, style: { ...ctx.style }, ...extra };
    out.push(e);
    return e;
  };
  const point = (kind: GeoKind, parents: string[], params?: GeoElement['params']) =>
    mk(kind, parents, { params, style: { ...ctx.style, label: nextPointLabel(all()) } });
  const measure = (what: MeasureKind, id: string) => mk('measure', [id], { params: { what } });
  const edges = (pts: string[]) => {
    for (let i = 0; i < pts.length; i++) mk('segment', [pts[i]!, pts[(i + 1) % pts.length]!]);
    mk('polygon', pts, { style: { ...ctx.style, width: 0, fill: true } });
  };
  /** קטע → שתי הנקודות שלו */
  const ends = (id: string) => (ctx.kindOf(id) === 'segment' ? ctx.parentsOf(id) : [id]);
  const [a, b, c] = inputs as [string, string, string];
  /** מרכז המעגל (קיים, או בנייה מוסתרת: חיתוך אנכים אמצעיים) */
  const centerOf = (circle: string): string | undefined => {
    const kind = ctx.kindOf(circle);
    const ps = ctx.parentsOf(circle);
    if (kind === 'circle' || kind === 'circleR' || kind === 'arc') return ps[0];
    if (kind === 'circle3' && ps.length === 3) {
      const hidden = { ...ctx.style, hidden: true };
      const l1 = mk('perpBisector', [ps[0]!, ps[1]!], { style: hidden });
      const l2 = mk('perpBisector', [ps[1]!, ps[2]!], { style: hidden });
      return point('intersection', [l1.id, l2.id], { index: 0 }).id;
    }
    return undefined;
  };

  switch (tool) {
    case 'segment':
    case 'line':
    case 'ray':
      mk(tool, [a, b]);
      break;
    case 'polygon':
      if (inputs.length >= 3) edges(inputs);
      break;
    case 'regularPolygon': {
      const pts = [a, b];
      for (let k = 2; k < ctx.n; k++) pts.push(point('regularVertex', [a, b], { n: ctx.n, k }).id);
      edges(pts);
      break;
    }
    case 'shape': {
      const sh = ctx.shape;
      const plan = sh ? planShape(sh.id, sh.dims) : null;
      const at = ctx.posOf?.(a);
      if (!sh || !plan || !at) break;
      const len = plan.base * (ctx.unitsPerCm ?? 1);
      const bx = Math.round((at.x + len) * 100) / 100;
      const by = Math.round(at.y * 100) / 100;
      // גודל קבוע: B "גולשת" על מעגל מוסתר ברדיוס הבסיס (אפשר רק לסובב ולהזיז)
      let bId: string;
      if (sh.fixed) {
        const ring = mk('circleR', [a], {
          params: { r: len },
          style: { ...ctx.style, hidden: true },
        });
        bId = mk('glider', [ring.id], { params: { x: bx, y: by } }).id;
      } else bId = mk('point', [], { params: { x: bx, y: by } }).id;
      const ids = plan.vertices.map((v) => {
        if (v === 'A') return a;
        if (v === 'B') return bId;
        const u = Math.round(v[0] * 1e6) / 1e6;
        const w = Math.round(v[1] * 1e6) / 1e6;
        return mk('relPoint', [a, bId], { params: { u, v: w } }).id;
      });
      // שמות לפי סדר הקודקודים במצולע
      for (const id of ids) {
        const e = out.find((x) => x.id === id);
        if (e) e.style = { ...e.style, label: nextPointLabel(all()) };
      }
      edges(ids);
      break;
    }
    case 'chord':
      mk('segment', [b, c]);
      break;
    case 'radius': {
      const o = centerOf(a);
      if (o) mk('segment', [o, b]);
      break;
    }
    case 'centralAngle': {
      const o = centerOf(a);
      if (!o) break;
      mk('segment', [o, b]);
      mk('segment', [o, c]);
      mk('angle', [b, o, c]);
      break;
    }
    case 'inscribedAngle': {
      // מעגל, קודקוד על המעגל, ושתי נקודות קצה של הקשת
      const d = inputs[3]!;
      mk('segment', [b, c]);
      mk('segment', [b, d]);
      mk('angle', [c, b, d]);
      break;
    }
    case 'circle':
      mk('circle', [a, b]);
      break;
    case 'circleR':
      mk('circleR', [a], { params: { r: ctx.r } });
      break;
    case 'circle3':
    case 'arc':
    case 'ellipse':
      mk(tool, [a, b, c]);
      break;
    case 'midpoint': {
      const [p, q] = inputs.length === 1 ? ends(a) : [a, b];
      point('midpoint', [p!, q!]);
      break;
    }
    case 'intersection': {
      const lines = [
        'segment',
        'line',
        'ray',
        'parallel',
        'perpendicular',
        'perpBisector',
        'angleBisector',
      ];
      const bothLines = lines.includes(ctx.kindOf(a) ?? '') && lines.includes(ctx.kindOf(b) ?? '');
      point('intersection', [a, b], { index: 0 });
      if (!bothLines) point('intersection', [a, b], { index: 1 });
      break;
    }
    case 'perpendicular':
    case 'parallel':
      mk(tool, [a, b]);
      break;
    case 'perpBisector': {
      const [p, q] = inputs.length === 1 ? ends(a) : [a, b];
      mk('perpBisector', [p!, q!]);
      break;
    }
    case 'angleBisector':
      mk('angleBisector', [a, b, c]);
      break;
    case 'median': {
      const [p, q] = ends(b);
      const m = point('midpoint', [p!, q!]);
      mk('segment', [a, m.id]);
      break;
    }
    case 'altitude': {
      const foot = point('foot', [a, b]);
      mk('segment', [a, foot.id], { style: { ...ctx.style, dash: 'dashed' } });
      const base = ctx.parentsOf(b)[0];
      if (base)
        mk('angle', [a, foot.id, base], { style: { ...ctx.style, showLabel: false, width: 1.5 } });
      break;
    }
    case 'tangent': {
      // משיק מנקודה חיצונית: חיתוך המעגל עם מעגל שהקוטר שלו הוא הקטע מהנקודה למרכז
      const center = ctx.parentsOf(b)[0];
      if (!center) break;
      const hidden = { ...ctx.style, hidden: true };
      const m = mk('midpoint', [a, center], { style: hidden });
      const aux = mk('circle', [m.id, a], { style: hidden });
      const t1 = point('intersection', [aux.id, b], { index: 0 });
      const t2 = point('intersection', [aux.id, b], { index: 1 });
      mk('line', [a, t1.id]);
      mk('line', [a, t2.id]);
      break;
    }
    case 'angle':
      mk('angle', [a, b, c]);
      break;
    case 'length':
      measure(ctx.kindOf(a) === 'segment' ? 'length' : 'radius', a);
      break;
    case 'area':
      measure('area', a);
      break;
    case 'perimeter':
      measure('perimeter', a);
      break;
    default:
      break;
  }
  return out;
}

/** נקודה חדשה (חופשית, או "גולשת" על ישר/מעגל) */
export function newPoint(
  elements: readonly GeoElement[],
  x: number,
  y: number,
  style: Pick<GeoStyle, 'color' | 'width'>,
  on?: string,
): GeoElement {
  return {
    id: newId('e'),
    kind: on ? 'glider' : 'point',
    parents: on ? [on] : [],
    params: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 },
    style: { ...style, label: nextPointLabel(elements) },
  };
}
