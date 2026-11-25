import type { SmoothingLevel } from '../../core/ink/smoothing';

// העדפות הכלים (צבע, עובי וכו') – נזכרות בין פתיחות של התוכנה.

export type ToolId = 'select' | 'pen' | 'highlighter' | 'eraser' | 'hand';
export type EraserMode = 'stroke' | 'area';

export interface ToolPrefs {
  pen: { color: string; width: number; opacity: number };
  highlighter: { color: string; width: number };
  eraser: { mode: EraserMode; size: number };
  /** שימוש בלחץ העט, כשהחומרה מדווחת עליו */
  usePressure: boolean;
  /** החלקת כתב יד: 0 ללא, 1 עדינה, 2 רגילה, 3 חזקה */
  smoothing: SmoothingLevel;
}

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
  };
}
