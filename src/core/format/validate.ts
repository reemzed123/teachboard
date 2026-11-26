import { SPACING_LIMITS } from '../background/pattern';
import { newId } from '../document/ids';
import { MAX_LAYERS } from '../document/layers';
import {
  DEFAULT_BACKGROUND,
  DOCUMENT_VERSION,
  type BackgroundPattern,
  type BoardDocument,
  type BoardObject,
  type InkObject,
  type LineDash,
  type Page,
  type ShapeObject,
  type TextObject,
  type MathObject,
  type GraphObject,
  type TableObject,
  type GeometryObject,
  type GeoElement,
  type GeoKind,
  type GeoStyle,
  type MeasureKind,
  type Transform,
  type PageBackground,
  type PageLayer,
} from '../document/types';

// בדיקת תקינות של מסמך שנקרא מאחסון או מקובץ.
// העיקרון: לא סומכים על שום ערך. בונים מסמך חדש ונקי, ומעתיקים רק שדות מוכרים
// בטיפוס ובטווח הנכון. מסמך לא תקין נדחה עם הודעה ברורה – והתוכנה לא קורסת.

export type FormatErrorCode = 'notDocument' | 'newerVersion' | 'invalid' | 'tooLarge';

export class FormatError extends Error {
  constructor(
    public code: FormatErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'FormatError';
  }
}

export const LIMITS = {
  pages: 2000,
  objectsTotal: 300_000,
  pointsPerObject: 600_000,
  idLength: 64,
  coordinate: 1e7,
} as const;

const PATTERNS: readonly BackgroundPattern[] = ['none', 'grid', 'lines', 'math', 'axes'];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ASSET_ID = /^[a-f0-9]{64}$/;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

function fail(detail: string): never {
  throw new FormatError('invalid', detail);
}

function cleanId(v: unknown, used: Set<string>, prefix: string): string {
  let id = typeof v === 'string' && ID.test(v) ? v : newId(prefix);
  if (used.has(id)) id = newId(prefix);
  used.add(id);
  return id;
}

function cleanLayers(v: unknown): PageLayer[] {
  if (!Array.isArray(v)) return [];
  const out: PageLayer[] = [];
  const seen = new Set<string>();
  for (const l of v.slice(0, MAX_LAYERS)) {
    if (!isObj(l) || typeof l.id !== 'string' || !ID.test(l.id) || seen.has(l.id)) continue;
    seen.add(l.id);
    const name = typeof l.name === 'string' ? cleanString(l.name, 40) : '';
    const layer: PageLayer = { id: l.id, name: name || l.id };
    if (l.hidden === true) layer.hidden = true;
    out.push(layer);
  }
  return out;
}

function cleanBackground(v: unknown): PageBackground {
  if (!isObj(v)) return { ...DEFAULT_BACKGROUND };
  const bg: PageBackground = {
    pattern: PATTERNS.includes(v.pattern as BackgroundPattern)
      ? (v.pattern as BackgroundPattern)
      : 'none',
    color: typeof v.color === 'string' && HEX.test(v.color) ? v.color.toLowerCase() : '#ffffff',
    spacing: Math.round(
      Math.min(SPACING_LIMITS.max, Math.max(SPACING_LIMITS.min, num(v.spacing, 0, 1e9) ?? 32)),
    ),
  };
  if (typeof v.imageAssetId === 'string' && ASSET_ID.test(v.imageAssetId)) {
    bg.imageAssetId = v.imageAssetId;
  }
  if (isObj(v.zones)) {
    const cols = Math.round(num(v.zones.cols, 1, 4) ?? 1);
    const rows = Math.round(num(v.zones.rows, 1, 4) ?? 1);
    if (cols > 1 || rows > 1) bg.zones = { cols, rows };
  }
  if (isObj(v.pdf) && typeof v.pdf.assetId === 'string' && ASSET_ID.test(v.pdf.assetId)) {
    const page = num(v.pdf.page, 0, 100000);
    if (page !== null) bg.pdf = { assetId: v.pdf.assetId, page: Math.floor(page) };
  }
  return bg;
}

function cleanTransform(v: unknown): Transform {
  const t = isObj(v) ? v : {};
  const C = LIMITS.coordinate;
  return {
    x: num(t.x, -C, C) ?? 0,
    y: num(t.y, -C, C) ?? 0,
    rotation: num(t.rotation, -1e4, 1e4) ?? 0,
    scale: num(t.scale, 0.001, 1000) ?? 1,
  };
}

const color = (v: unknown): string | null =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null;

/** שדות משותפים: נעילה וקבוצה */
function withCommon<T extends { locked?: boolean; groupId?: string; layer?: string }>(
  obj: T,
  v: Obj,
): T {
  if (v.locked === true) obj.locked = true;
  if (typeof v.groupId === 'string' && ID.test(v.groupId)) obj.groupId = v.groupId;
  if (typeof v.layer === 'string' && ID.test(v.layer)) obj.layer = v.layer;
  return obj;
}

const DASHES: readonly LineDash[] = ['solid', 'dashed', 'dotted'];

function cleanShape(v: Obj, id: string): ShapeObject | null {
  const st = isObj(v.style) ? v.style : null;
  if (!st) return null;
  const C = LIMITS.coordinate;
  const dx = num(v.dx, -C, C);
  const dy = num(v.dy, -C, C);
  const c = color(st.color);
  const width = num(st.width, 0.1, 500);
  const opacity = num(st.opacity, 0, 1);
  if (dx === null || dy === null || !c || width === null || opacity === null) return null;
  if (v.kind !== 'line' && v.kind !== 'arrow') return null;
  const obj: ShapeObject = {
    id,
    type: 'shape',
    kind: v.kind,
    transform: cleanTransform(v.transform),
    dx,
    dy,
    style: {
      color: c,
      width,
      opacity,
      dash: DASHES.includes(st.dash as LineDash) ? (st.dash as LineDash) : 'solid',
    },
  };
  if (v.arrowStart === true) obj.arrowStart = true;
  return withCommon(obj, v);
}

function cleanText(v: Obj, id: string): TextObject | null {
  if (typeof v.text !== 'string' || v.text.length === 0 || v.text.length > 20000) return null;
  const fontSize = num(v.fontSize, 4, 1000);
  const c = color(v.color);
  const width = num(v.width, 0, 1e6);
  const height = num(v.height, 0, 1e6);
  if (fontSize === null || !c || width === null || height === null) return null;
  const obj: TextObject = {
    id,
    type: 'text',
    transform: cleanTransform(v.transform),
    // תווי בקרה (חוץ ממעבר שורה) מוסרים
    text: [...v.text].filter((ch) => ch === '\n' || ch.charCodeAt(0) >= 32).join(''),
    fontSize,
    color: c,
    dir: v.dir === 'ltr' ? 'ltr' : 'rtl',
    width,
    height,
  };
  if (v.bold === true) obj.bold = true;
  return withCommon(obj, v);
}

/** טקסט חופשי: אורך מוגבל, בלי תווי בקרה (מלבד מעבר שורה) */
function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) return null;
  return [...v].filter((ch) => ch === '\n' || ch.charCodeAt(0) >= 32).join('');
}

function cleanMath(v: Obj, id: string): MathObject | null {
  const latex = cleanString(v.latex, 5000);
  const c = color(v.color);
  const fontSize = num(v.fontSize, 4, 1000);
  const width = num(v.width, 0, 1e6);
  const height = num(v.height, 0, 1e6);
  if (!latex || !c || fontSize === null || width === null || height === null) return null;
  return withCommon<MathObject>(
    {
      id,
      type: 'math',
      transform: cleanTransform(v.transform),
      latex,
      color: c,
      fontSize,
      width,
      height,
    },
    v,
  );
}

function cleanGraph(v: Obj, id: string): GraphObject | null {
  const width = num(v.width, 20, 1e5);
  const height = num(v.height, 20, 1e5);
  const r = isObj(v.range) ? v.range : null;
  if (width === null || height === null || !r) return null;
  const R = 1e9;
  const xMin = num(r.xMin, -R, R);
  const xMax = num(r.xMax, -R, R);
  const yMin = num(r.yMin, -R, R);
  const yMax = num(r.yMax, -R, R);
  if (
    xMin === null ||
    xMax === null ||
    yMin === null ||
    yMax === null ||
    xMin >= xMax ||
    yMin >= yMax
  )
    return null;
  const fns = Array.isArray(v.functions) ? v.functions.slice(0, 20) : [];
  const used = new Set<string>();
  const functions = fns.flatMap((f) => {
    if (!isObj(f)) return [];
    const latex = cleanString(f.latex, 2000);
    const c = color(f.color);
    if (latex === null || !c) return [];
    return [
      {
        id: cleanId(f.id, used, 'f'),
        latex,
        color: c,
        width: num(f.width, 0.5, 20) ?? 2.5,
        visible: f.visible !== false,
      },
    ];
  });
  return withCommon<GraphObject>(
    {
      id,
      type: 'graph',
      transform: cleanTransform(v.transform),
      width,
      height,
      range: { xMin, xMax, yMin, yMax },
      grid: v.grid !== false,
      showIntercepts: v.showIntercepts === true,
      showIntersections: v.showIntersections === true,
      functions,
    },
    v,
  );
}

function cleanTable(v: Obj, id: string): TableObject | null {
  if (!Array.isArray(v.rows) || v.rows.length === 0 || v.rows.length > 200) return null;
  const rows = v.rows.map((row) =>
    Array.isArray(row)
      ? row.slice(0, 30).map((c) => (typeof c === 'string' ? (cleanString(c, 200) ?? '') : ''))
      : [],
  );
  const c = color(v.color);
  const fontSize = num(v.fontSize, 4, 500);
  const cellWidth = num(v.cellWidth, 4, 5000);
  const cellHeight = num(v.cellHeight, 4, 5000);
  if (!c || fontSize === null || cellWidth === null || cellHeight === null) return null;
  return withCommon<TableObject>(
    {
      id,
      type: 'table',
      transform: cleanTransform(v.transform),
      rows,
      fontSize,
      color: c,
      cellWidth,
      cellHeight,
    },
    v,
  );
}

function cleanInk(v: Obj, id: string): InkObject | null {
  const st = isObj(v.style) ? v.style : null;
  if (!st) return null;
  const C = LIMITS.coordinate;
  const pts = v.points;
  if (!Array.isArray(pts) || pts.length === 0 || pts.length % 3 !== 0) return null;
  if (pts.length > LIMITS.pointsPerObject) throw new FormatError('tooLarge', 'points');
  const points: number[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const n = num(pts[i], i % 3 === 2 ? 0 : -C, i % 3 === 2 ? 1 : C);
    if (n === null) return null;
    points[i] = n;
  }
  const kind = st.kind === 'highlighter' ? 'highlighter' : st.kind === 'pen' ? 'pen' : null;
  const inkColor = color(st.color);
  const width = num(st.width, 0.1, 500);
  const opacity = num(st.opacity, 0, 1);
  if (!kind || !inkColor || width === null || opacity === null) return null;
  const obj: InkObject = {
    id,
    type: 'ink',
    transform: cleanTransform(v.transform),
    style: { kind, color: inkColor, width, opacity },
    points,
    pressure: v.pressure === true,
  };
  return withCommon(obj, v);
}

const GEO_KINDS = new Set([
  'point',
  'glider',
  'midpoint',
  'intersection',
  'foot',
  'segment',
  'line',
  'ray',
  'parallel',
  'perpendicular',
  'perpBisector',
  'angleBisector',
  'circle',
  'circleR',
  'circle3',
  'arc',
  'ellipse',
  'polygon',
  'regularVertex',
  'angle',
  'measure',
]);
const MEASURES = new Set(['length', 'area', 'perimeter', 'radius', 'diameter']);

function cleanGeometry(v: Obj, id: string): GeometryObject | null {
  if (!Array.isArray(v.elements) || v.elements.length > 2000) return null;
  const seen = new Set<string>();
  const elements: GeoElement[] = [];
  const C = LIMITS.coordinate;
  for (const raw of v.elements) {
    if (!isObj(raw) || typeof raw.id !== 'string' || !ID.test(raw.id) || seen.has(raw.id)) continue;
    if (!GEO_KINDS.has(raw.kind as string)) continue;
    const parents = Array.isArray(raw.parents) ? raw.parents : [];
    // כל הורה חייב להופיע קודם (אחרת – הצעד וכל מה שתלוי בו מדולגים)
    if (parents.length > 64 || !parents.every((p) => typeof p === 'string' && seen.has(p)))
      continue;
    const pr = isObj(raw.params) ? raw.params : {};
    const params: GeoElement['params'] = {};
    const x = num(pr.x, -C, C);
    const y = num(pr.y, -C, C);
    if (x !== null) params.x = x;
    if (y !== null) params.y = y;
    const idx = num(pr.index, 0, 1);
    if (idx !== null) params.index = Math.round(idx);
    const r = num(pr.r, 0.001, C);
    if (r !== null) params.r = r;
    const u = num(pr.u, -1000, 1000);
    if (u !== null) params.u = u;
    const vv = num(pr.v, -1000, 1000);
    if (vv !== null) params.v = vv;
    const n = num(pr.n, 3, 50);
    if (n !== null) params.n = Math.round(n);
    const k = num(pr.k, 2, 50);
    if (k !== null) params.k = Math.round(k);
    if (MEASURES.has(pr.what as string)) params.what = pr.what as MeasureKind;
    const st = isObj(raw.style) ? raw.style : {};
    const style: GeoStyle = {
      color: color(st.color) ?? '#1c2430',
      width: num(st.width, 0, 50) ?? 2,
    };
    if (DASHES.includes(st.dash as LineDash)) style.dash = st.dash as LineDash;
    const label = typeof st.label === 'string' ? cleanString(st.label, 20) : null;
    if (label) style.label = label;
    if (typeof st.showLabel === 'boolean') style.showLabel = st.showLabel;
    for (const key of ['ticks', 'arrows', 'arcs'] as const) {
      const val = num(st[key], 0, 3);
      if (val !== null && val > 0) style[key] = Math.round(val);
    }
    if (st.fill === true) style.fill = true;
    if (st.hidden === true) style.hidden = true;
    const text = typeof st.text === 'string' ? cleanString(st.text, 40) : null;
    if (text) style.text = text;
    if (st.showValue === true) style.showValue = true;
    const tag = typeof st.tag === 'string' ? cleanString(st.tag, 120) : null;
    if (tag) style.tag = tag;
    seen.add(raw.id);
    elements.push({
      id: raw.id,
      kind: raw.kind as GeoKind,
      parents: parents as string[],
      params,
      style,
    });
  }
  const ex = isObj(v.extent) ? v.extent : {};
  return withCommon<GeometryObject>(
    {
      id,
      type: 'geometry',
      transform: cleanTransform(v.transform),
      elements,
      extent: {
        x: num(ex.x, -C, C) ?? 0,
        y: num(ex.y, -C, C) ?? 0,
        width: num(ex.width, 0, C) ?? 0,
        height: num(ex.height, 0, C) ?? 0,
      },
    },
    v,
  );
}

/** בודק לכל סוג אובייקט. סוג שלא מופיע כאן מדולג. */
const CLEANERS: Record<string, (v: Obj, id: string) => BoardObject | null> = {
  ink: cleanInk,
  shape: cleanShape,
  text: cleanText,
  math: cleanMath,
  graph: cleanGraph,
  table: cleanTable,
  geometry: cleanGeometry,
};

export interface ValidationReport {
  /** אובייקטים שדולגו כי לא היו תקינים או מסוג לא מוכר */
  skippedObjects: number;
}

/**
 * מקבל ערך כלשהו ומחזיר מסמך תקין, או זורק FormatError.
 * מסמכים מגרסה ישנה מוסבים לגרסה הנוכחית (כשיהיו כאלה).
 */
export function validateDocument(raw: unknown, report?: ValidationReport): BoardDocument {
  if (!isObj(raw) || !Array.isArray(raw.pages)) throw new FormatError('notDocument', 'shape');
  const version = num(raw.version, 1, 1e6);
  if (version === null) throw new FormatError('notDocument', 'version');
  if (version > DOCUMENT_VERSION) throw new FormatError('newerVersion', String(version));
  // כאן יתווספו המרות מגרסאות ישנות: if (version < 2) raw = migrate1to2(raw) ...

  if (raw.pages.length === 0) fail('no pages');
  if (raw.pages.length > LIMITS.pages) throw new FormatError('tooLarge', 'pages');

  const usedIds = new Set<string>();
  let total = 0;
  let skipped = 0;
  const pages: Page[] = raw.pages.map((p: unknown): Page => {
    if (!isObj(p)) fail('page');
    const size = isObj(p.size) ? p.size : {};
    const objects: BoardObject[] = [];
    const list = Array.isArray(p.objects) ? p.objects : [];
    total += list.length;
    if (total > LIMITS.objectsTotal) throw new FormatError('tooLarge', 'objects');
    for (const o of list) {
      const cleaner = isObj(o) && typeof o.type === 'string' ? CLEANERS[o.type] : undefined;
      if (!cleaner || !isObj(o)) {
        skipped++;
        continue;
      }
      const clean = cleaner(o, cleanId(o.id, usedIds, 'o'));
      if (clean) objects.push(clean);
      else skipped++;
    }
    const layers = cleanLayers(p.layers);
    const layerIds = new Set(layers.map((l) => l.id));
    // אובייקט בשכבה שלא קיימת – עובר לשכבה הראשית
    for (const o of objects) if (o.layer && !layerIds.has(o.layer)) delete o.layer;
    return {
      ...(layers.length ? { layers } : {}),
      id: cleanId(p.id, usedIds, 'p'),
      layout: p.layout === 'infinite' ? 'infinite' : 'bounded',
      size: {
        width: num(size.width, 50, 20000) ?? 1123,
        height: num(size.height, 50, 20000) ?? 794,
      },
      background: cleanBackground(p.background),
      objects,
    };
  });

  if (report) report.skippedObjects = skipped;
  return { version: DOCUMENT_VERSION, pages };
}

/** כל מזהי המשאבים (תמונות) שהמסמך משתמש בהם */
export function referencedAssets(doc: BoardDocument): string[] {
  const ids = new Set<string>();
  for (const p of doc.pages) {
    if (p.background.imageAssetId) ids.add(p.background.imageAssetId);
    if (p.background.pdf) ids.add(p.background.pdf.assetId);
  }
  return [...ids];
}
