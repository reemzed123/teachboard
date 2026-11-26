import type { SmoothingLevel } from '../../core/ink/smoothing';
import type { LineDash } from '../../core/document/types';
import { TOOL_SLOTS, type GeoToolId } from '../../core/geometry/tools';
import {
  DEFAULT_DIMS,
  SHAPE_IDS,
  type DimKey,
  type ShapeDims,
  type ShapeId,
} from '../../core/geometry/shapes';

const GEO_TOOL_IDS = Object.keys(TOOL_SLOTS);

// העדפות הכלים (צבע, עובי וכו') – נזכרות בין פתיחות של התוכנה.

export type ToolId =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'hand'
  | 'text'
  | 'line'
  | 'arrow'
  | 'geometry'
  | 'laser';
export type EraserMode = 'stroke' | 'area';

export interface ToolPrefs {
  pen: { color: string; width: number; opacity: number };
  highlighter: { color: string; width: number };
  eraser: { mode: EraserMode; size: number };
  /** שימוש בלחץ העט, כשהחומרה מדווחת עליו */
  usePressure: boolean;
  /** החלקת כתב יד: 0 ללא, 1 עדינה, 2 רגילה, 3 חזקה */
  smoothing: SmoothingLevel;
  /** קו ישר וחץ (הצבע והעובי – כמו העט) */
  shape: { dash: LineDash; arrowStart: boolean };
  text: { fontSize: number; bold: boolean };
  /** סרגל הצבעים האישי של המורה */
  favorites: string[];
  /** גיאומטריה: הכלי הנוכחי, צבע, מספר צלעות למצולע משוכלל, רדיוס (ס"מ) */
  geo: {
    tool: GeoToolId;
    color: string;
    n: number;
    radiusCm: number;
    /** צורה ידועה: הסוג, המידות (ס"מ / מעלות), וגודל קבוע או חופשי */
    shape: { id: ShapeId; dims: ShapeDims; fixed: boolean };
  };
}

export const MAX_POLYGON_SIDES = 20;

export const TEXT_SIZES = [16, 24, 32, 48, 72] as const;
export const MAX_FAVORITES = 12;

export const PEN_COLORS = [
  '#1c2430',
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#be185d',
  '#ffffff',
] as const;

export const HIGHLIGHTER_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6', '#fb923c'] as const;

export const PEN_WIDTHS = [2, 4, 8] as const;
export const HIGHLIGHTER_WIDTHS = [14, 22, 32] as const;
export const ERASER_SIZES = [10, 24, 48] as const;

export const WIDTH_LIMITS = { min: 1, max: 60 } as const;

export function defaultToolPrefs(): ToolPrefs {
  return {
    pen: { color: PEN_COLORS[0], width: 4, opacity: 1 },
    highlighter: { color: HIGHLIGHTER_COLORS[0], width: 22 },
    eraser: { mode: 'stroke', size: 24 },
    usePressure: true,
    smoothing: 2,
    shape: { dash: 'solid', arrowStart: false },
    text: { fontSize: 32, bold: false },
    favorites: [],
    geo: {
      tool: 'point',
      color: '#1c2430',
      n: 5,
      radiusCm: 3,
      shape: { id: 'rectangle', dims: { ...DEFAULT_DIMS }, fixed: true },
    },
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const color = (v: unknown, fallback: string) =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback;

/** קורא העדפות שמורות (שעלולות להיות פגומות) ומחזיר העדפות תקינות. */
export function parseToolPrefs(raw: unknown): ToolPrefs {
  const d = defaultToolPrefs();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, Record<string, unknown> | undefined>;
  return {
    pen: {
      color: color(r.pen?.color, d.pen.color),
      width: clamp(r.pen?.width, WIDTH_LIMITS.min, WIDTH_LIMITS.max, d.pen.width),
      opacity: clamp(r.pen?.opacity, 0.1, 1, d.pen.opacity),
    },
    highlighter: {
      color: color(r.highlighter?.color, d.highlighter.color),
      width: clamp(r.highlighter?.width, WIDTH_LIMITS.min, WIDTH_LIMITS.max, d.highlighter.width),
    },
    eraser: {
      mode: r.eraser?.mode === 'area' ? 'area' : 'stroke',
      size: clamp(r.eraser?.size, 4, 120, d.eraser.size),
    },
    usePressure:
      typeof (raw as Record<string, unknown>).usePressure === 'boolean'
        ? ((raw as Record<string, unknown>).usePressure as boolean)
        : d.usePressure,
    smoothing: [0, 1, 2, 3].includes((raw as Record<string, unknown>).smoothing as number)
      ? ((raw as Record<string, unknown>).smoothing as SmoothingLevel)
      : d.smoothing,
    shape: {
      dash: (['solid', 'dashed', 'dotted'] as const).includes(r.shape?.dash as LineDash)
        ? (r.shape!.dash as LineDash)
        : d.shape.dash,
      arrowStart: r.shape?.arrowStart === true,
    },
    text: {
      fontSize: clamp(r.text?.fontSize, 8, 200, d.text.fontSize),
      bold: r.text?.bold === true,
    },
    favorites: Array.isArray((raw as Record<string, unknown>).favorites)
      ? [
          ...new Set(
            ((raw as Record<string, unknown>).favorites as unknown[])
              .filter((c): c is string => typeof c === 'string' && HEX.test(c))
              .map((c) => c.toLowerCase()),
          ),
        ].slice(0, MAX_FAVORITES)
      : d.favorites,
    geo: {
      tool: (GEO_TOOL_IDS as readonly string[]).includes(r.geo?.tool as string)
        ? (r.geo!.tool as GeoToolId)
        : d.geo.tool,
      color: color(r.geo?.color, d.geo.color),
      n: Math.round(clamp(r.geo?.n, 3, MAX_POLYGON_SIDES, d.geo.n)),
      radiusCm: clamp(r.geo?.radiusCm, 0.1, 100, d.geo.radiusCm),
      shape: parseShape(r.geo?.shape, d.geo.shape),
    },
  };
}

function parseShape(raw: unknown, d: ToolPrefs['geo']['shape']): ToolPrefs['geo']['shape'] {
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as { id?: unknown; dims?: Record<string, unknown>; fixed?: unknown };
  const dims = { ...d.dims };
  for (const k of Object.keys(dims) as DimKey[]) {
    dims[k] = clamp(r.dims?.[k], 0.1, k === 'angle' ? 179 : 100, d.dims[k]);
  }
  return {
    id: (SHAPE_IDS as readonly unknown[]).includes(r.id) ? (r.id as ShapeId) : d.id,
    dims,
    fixed: typeof r.fixed === 'boolean' ? r.fixed : d.fixed,
  };
}
