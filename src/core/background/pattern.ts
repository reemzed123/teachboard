import type { Rect } from '../geometry/rect';
import type { BackgroundPattern, Page, PageBackground } from '../document/types';

// מחולל קווי רקע (משבצות, שורות, דף חשבון, מערכת צירים).
// קוד טהור: אותם קווים משמשים לציור על המסך, לייצוא תמונה ולייצוא PDF.

export type LineKind = 'minor' | 'major' | 'axis' | 'margin';

export interface PatternLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: LineKind;
}

export interface PatternLabel {
  x: number;
  y: number;
  text: string;
  align: 'center' | 'right' | 'left';
}

export interface Pattern {
  lines: PatternLine[];
  labels: PatternLabel[];
  /** חיצים בקצות הצירים (מיקום הקצה וכיוון) */
  arrows: { x: number; y: number; dx: number; dy: number }[];
}

export const PATTERN_OPTIONS: readonly BackgroundPattern[] = [
  'none',
  'grid',
  'lines',
  'math',
  'axes',
];

export const SPACING_LIMITS = { min: 12, max: 80 } as const;

/** מרווח מינימלי בפיקסלים של המסך – מתחת לזה קווים צפופים מדי לא מצוירים. */
const MIN_SCREEN_GAP = 5;

/** האזור שבו מצויר הרקע: גבולות העמוד, או (בלוח אינסופי) האזור הנראה. */
export function backgroundArea(page: Page, visible: Rect): Rect {
  if (page.layout === 'bounded') return { x: 0, y: 0, ...page.size };
  return visible;
}

/** הראשית של מערכת הצירים: מרכז העמוד, או 0,0 בלוח אינסופי. */
export function axesOrigin(page: Page): { x: number; y: number } {
  if (page.layout === 'bounded') {
    const s = page.background.spacing;
    return {
      x: Math.round(page.size.width / 2 / s) * s,
      y: Math.round(page.size.height / 2 / s) * s,
    };
  }
  return { x: 0, y: 0 };
}

function range(from: number, to: number, step: number, origin = 0): number[] {
  const out: number[] = [];
  const start = Math.ceil((from - origin) / step) * step + origin;
  for (let v = start; v <= to + 1e-6; v += step) out.push(v);
  return out;
}

/**
 * מחשב את קווי הרקע בתוך האזור area (בקואורדינטות לוח).
 * scale = קנה המידה של התצוגה (כדי לוותר על קווים צפופים מדי בזום רחוק).
 */
export function generatePattern(page: Page, area: Rect, scale: number): Pattern {
  const bg: PageBackground = page.background;
  const out: Pattern = { lines: [], labels: [], arrows: [] };
  if (bg.pattern === 'none') return out;

  const bounds = backgroundArea(page, area);
  // מציירים רק את החיתוך בין גבולות הרקע לבין מה שמבקשים
  const x1 = Math.max(bounds.x, area.x);
  const y1 = Math.max(bounds.y, area.y);
  const x2 = Math.min(bounds.x + bounds.width, area.x + area.width);
  const y2 = Math.min(bounds.y + bounds.height, area.y + area.height);
  if (x2 <= x1 || y2 <= y1) return out;

  const s = bg.spacing;
  const dense = s * scale < MIN_SCREEN_GAP;
  const origin = page.layout === 'bounded' ? { x: 0, y: 0 } : { x: 0, y: 0 };

  const vLines = (step: number, kind: LineKind, skipEvery = 0) => {
    for (const x of range(x1, x2, step, origin.x)) {
      if (skipEvery && Math.round((x - origin.x) / s) % skipEvery === 0) continue;
      out.lines.push({ x1: x, y1, x2: x, y2, kind });
    }
  };
  const hLines = (step: number, kind: LineKind, skipEvery = 0) => {
    for (const y of range(y1, y2, step, origin.y)) {
      if (skipEvery && Math.round((y - origin.y) / s) % skipEvery === 0) continue;
      out.lines.push({ x1, y1: y, x2, y2: y, kind });
    }
  };

  switch (bg.pattern) {
    case 'grid':
      if (!dense) {
        vLines(s, 'minor');
        hLines(s, 'minor');
      }
      break;
    case 'lines':
      if (!dense) hLines(s, 'minor');
      // קו שוליים בצד ימין (כתיבה מימין לשמאל) בעמוד מחברת
      if (page.layout === 'bounded') {
        const mx = page.size.width - s * 2.5;
        if (mx > x1 && mx < x2) out.lines.push({ x1: mx, y1, x2: mx, y2, kind: 'margin' });
      }
      break;
    case 'math': {
      // דף חשבון: משבצות קטנות, וקו בולט כל 5 משבצות (כמו נייר מילימטרי)
      if (!dense) {
        vLines(s, 'minor', 5);
        hLines(s, 'minor', 5);
      }
      if (s * 5 * scale >= MIN_SCREEN_GAP) {
        vLines(s * 5, 'major');
        hLines(s * 5, 'major');
      }
      break;
    }
    case 'axes': {
      const o = axesOrigin(page);
      if (!dense) {
        for (const x of range(x1, x2, s, o.x))
          if (x !== o.x) out.lines.push({ x1: x, y1, x2: x, y2, kind: 'minor' });
        for (const y of range(y1, y2, s, o.y))
          if (y !== o.y) out.lines.push({ x1, y1: y, x2, y2: y, kind: 'minor' });
      }
      if (o.y >= y1 && o.y <= y2) {
        out.lines.push({ x1, y1: o.y, x2, y2: o.y, kind: 'axis' });
        out.arrows.push({ x: x2, y: o.y, dx: 1, dy: 0 });
      }
      if (o.x >= x1 && o.x <= x2) {
        out.lines.push({ x1: o.x, y1, x2: o.x, y2, kind: 'axis' });
        out.arrows.push({ x: o.x, y: y1, dx: 0, dy: -1 });
      }
      // מספרים על הצירים – כל משבצת, או בקפיצות כשהזום רחוק
      const every = Math.max(1, Math.ceil(28 / (s * scale)));
      const step = s * every;
      const lx1 = x1 + s * 0.5;
      const lx2 = x2 - s * 0.5;
      const ly1 = y1 + s * 0.5;
      const ly2 = y2 - s * 0.5;
      if (o.y >= y1 && o.y <= y2) {
        for (const x of range(lx1, lx2, step, o.x)) {
          const n = Math.round((x - o.x) / s);
          if (n !== 0) out.labels.push({ x, y: o.y + s * 0.55, text: String(n), align: 'center' });
        }
      }
      if (o.x >= x1 && o.x <= x2) {
        for (const y of range(ly1, ly2, step, o.y)) {
          const n = -Math.round((y - o.y) / s);
          if (n !== 0)
            out.labels.push({ x: o.x - s * 0.2, y: y + s * 0.15, text: String(n), align: 'right' });
        }
        out.labels.push({ x: o.x - s * 0.2, y: o.y + s * 0.55, text: '0', align: 'right' });
      }
      break;
    }
  }
  return out;
}

/** צבעי הקווים לפי בהירות הדף: קווים בהירים על לוח כהה, ולהפך. */
export function patternColors(pageColor: string): Record<LineKind, string> & { label: string } {
  const dark = isDarkColor(pageColor);
  return dark
    ? {
        minor: 'rgba(255,255,255,0.16)',
        major: 'rgba(255,255,255,0.32)',
        axis: 'rgba(255,255,255,0.85)',
        margin: 'rgba(255,140,140,0.6)',
        label: 'rgba(255,255,255,0.8)',
      }
    : {
        minor: 'rgba(37,72,128,0.17)',
        major: 'rgba(37,72,128,0.34)',
        axis: 'rgba(20,28,40,0.85)',
        margin: 'rgba(220,38,38,0.45)',
        label: 'rgba(20,28,40,0.75)',
      };
}

export const LINE_WIDTH_PX: Record<LineKind, number> = {
  minor: 1,
  major: 1.25,
  axis: 1.6,
  margin: 1.25,
};

export function isDarkColor(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** קווי החלוקה לאזורים (עמוד מחברת בלבד) – בקואורדינטות לוח */
export function zoneLines(
  page: Pick<Page, 'layout' | 'size' | 'background'>,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const z = page.background.zones;
  if (!z || page.layout !== 'bounded') return [];
  const { width: w, height: h } = page.size;
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < z.cols; i++)
    out.push({ x1: (w * i) / z.cols, y1: 0, x2: (w * i) / z.cols, y2: h });
  for (let i = 1; i < z.rows; i++)
    out.push({ x1: 0, y1: (h * i) / z.rows, x2: w, y2: (h * i) / z.rows });
  return out;
}

export const ZONE_LINE = { color: '#8a94a6', width: 2 } as const;
