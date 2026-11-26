// ייצוב והחלקה של כתב יד.
//
// שני שלבים:
//  1. בזמן הכתיבה – מסנן "One Euro": מחליק רעד כשהעט זז לאט (שם רואים רעד),
//     וכמעט לא מוסיף השהיה כשהעט זז מהר.
//  2. בהרמת העט – "ייפוי": הסרת "ווים" קטנים בתחילת/סוף הקו, החלקת הצורה
//     והחלקת הלחץ. העוצמה לפי בחירת המורה.

/** 0 = ללא, 1 = עדינה, 2 = רגילה, 3 = חזקה */
export type SmoothingLevel = 0 | 1 | 2 | 3;

export const SMOOTHING_LEVELS: readonly SmoothingLevel[] = [0, 1, 2, 3];

interface Preset {
  /** One Euro: תדר חיתוך מינימלי (נמוך = יותר החלקה במהירות נמוכה) */
  minCutoff: number;
  /** One Euro: כמה המהירות מקטינה את ההחלקה (גבוה = פחות השהיה בתנועה מהירה) */
  beta: number;
  /** ייפוי: רדיוס ההחלקה בנקודות */
  window: number;
  /** ייפוי: אורך מקסימלי של "וו" שיוסר, בפיקסלים של המסך */
  hookLength: number;
  /** החלקת לחץ: רדיוס בנקודות */
  pressureWindow: number;
}

const PRESETS: Record<SmoothingLevel, Preset | null> = {
  0: null,
  1: { minCutoff: 3.0, beta: 0.02, window: 1, hookLength: 4, pressureWindow: 2 },
  2: { minCutoff: 1.6, beta: 0.012, window: 3, hookLength: 5, pressureWindow: 3 },
  3: { minCutoff: 0.8, beta: 0.006, window: 6, hookLength: 7, pressureWindow: 5 },
};

// ---------- One Euro filter ----------

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  get last(): number | null {
    return this.y;
  }
}

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** מסנן One Euro לנקודה דו-ממדית (Casiez et al., 2012). */
export class OneEuroFilter2D {
  private x = new LowPass();
  private y = new LowPass();
  private dx = new LowPass();
  private dy = new LowPass();
  private lastT: number | null = null;
  private readonly dCutoff = 1;

  constructor(
    private minCutoff: number,
    private beta: number,
  ) {}

  /** t בשניות. מחזיר את הנקודה המוחלקת. */
  filter(px: number, py: number, t: number): { x: number; y: number } {
    const prevX = this.x.last;
    const prevY = this.y.last;
    if (this.lastT === null || prevX === null || prevY === null) {
      this.lastT = t;
      return { x: this.x.filter(px, 1), y: this.y.filter(py, 1) };
    }
    // אירועים עם אותו זמן (קלט מאוחד) – מניחים מרווח קטן.
    const dt = Math.max(t - this.lastT, 1 / 1000);
    this.lastT = t;

    const ad = alphaFor(this.dCutoff, dt);
    const vx = this.dx.filter((px - prevX) / dt, ad);
    const vy = this.dy.filter((py - prevY) / dt, ad);
    const speed = Math.hypot(vx, vy);
    const cutoff = this.minCutoff + this.beta * speed;
    const a = alphaFor(cutoff, dt);
    return { x: this.x.filter(px, a), y: this.y.filter(py, a) };
  }
}

export function createLiveFilter(level: SmoothingLevel): OneEuroFilter2D | null {
  const p = PRESETS[level];
  return p ? new OneEuroFilter2D(p.minCutoff, p.beta) : null;
}

// ---------- ייפוי בהרמת העט ----------

type Triple = [number, number, number];

function toTriples(flat: readonly number[]): Triple[] {
  const out: Triple[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
  return out;
}

function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la === 0 || lb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
  return Math.acos(cos);
}

/**
 * מסיר "וו" בקצה הקו: תנועה קצרה בתחילת/סוף הקו שהכיוון שלה שונה בחדות
 * מהכיוון של שאר הקו (קורה כשהעט נוחת או מורם).
 */
function trimHook(pts: Triple[], maxLen: number): Triple[] {
  if (pts.length < 6) return pts;
  const seg = (i: number) => Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
  // מוצאים את הנקודה האחרונה בתוך "אזור הוו"
  let len = 0;
  let k = 0;
  while (k + 1 < pts.length && len < maxLen) {
    len += seg(k);
    k++;
  }
  if (k < 1 || k + 2 >= pts.length) return pts;
  // קו קצר ביחס לוו (סימנים קטנים כמו √ או 7) – לא נוגעים: הוו הוא חלק מהצורה
  let total = len;
  for (let i = k; i + 1 < pts.length; i++) total += seg(i);
  if (total < maxLen * HOOK_MIN_RATIO) return pts;
  // הכיוון של הוו מול הכיוון של המשך הקו (בערך כפול מאורכו)
  const hookDx = pts[k]![0] - pts[0]![0];
  const hookDy = pts[k]![1] - pts[0]![1];
  let m = k;
  let len2 = 0;
  while (m + 1 < pts.length && len2 < maxLen * 2) {
    len2 += seg(m);
    m++;
  }
  const mainDx = pts[m]![0] - pts[k]![0];
  const mainDy = pts[m]![1] - pts[k]![1];
  // רק "חזרה לאחור" ממש (וו של נחיתה/הרמה) – לא זווית חדה רגילה של אות
  return angleBetween(hookDx, hookDy, mainDx, mainDy) > HOOK_MIN_ANGLE ? pts.slice(k) : pts;
}

/** וו נחתך רק בקו שארוך ממנו לפחות פי 5 */
const HOOK_MIN_RATIO = 5;
/** וו = תנועה כמעט הפוכה לכיוון הקו (יותר מ-120°) */
const HOOK_MIN_ANGLE = (2 * Math.PI) / 3;

/** ממוצע משוקלל (גאוסיאני) של כל נקודה עם שכנותיה; הקצוות נשארים במקום. */
function smoothPositions(pts: Triple[], window: number): Triple[] {
  if (window <= 0 || pts.length < 3) return pts;
  const n = pts.length;
  const sigma = window / 2;
  const weights: number[] = [];
  for (let d = 0; d <= window; d++) weights.push(Math.exp(-(d * d) / (2 * sigma * sigma)));
  const out: Triple[] = pts.map((p) => [p[0], p[1], p[2]]);
  for (let i = 1; i < n - 1; i++) {
    // ליד הקצוות החלון מצטמצם, כדי שהקצה לא "יימשך" פנימה
    const w = Math.min(window, i, n - 1 - i);
    let sx = 0,
      sy = 0,
      sw = 0;
    for (let d = -w; d <= w; d++) {
      const wt = weights[Math.abs(d)]!;
      sx += pts[i + d]![0] * wt;
      sy += pts[i + d]![1] * wt;
      sw += wt;
    }
    out[i]![0] = sx / sw;
    out[i]![1] = sy / sw;
  }
  return out;
}

function smoothPressure(pts: Triple[], window: number): Triple[] {
  if (window <= 0 || pts.length < 3) return pts;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = Math.max(0, i - window);
    const b = Math.min(n - 1, i + window);
    let s = 0;
    for (let k = a; k <= b; k++) s += pts[k]![2];
    return [p[0], p[1], s / (b - a + 1)] as Triple;
  });
}

/**
 * ייפוי קו שהסתיים. מקבל ומחזיר רשימה שטוחה [x, y, לחץ, ...] בקואורדינטות לוח.
 * scale = קנה המידה של התצוגה (כדי שאורך "וו" יימדד בפיקסלים של המסך).
 */
export function beautifyStroke(
  flat: readonly number[],
  level: SmoothingLevel,
  scale = 1,
): number[] {
  const p = PRESETS[level];
  if (!p || flat.length < 9) return flat.slice();
  let pts = toTriples(flat);
  const hook = p.hookLength / scale;
  pts = trimHook(pts, hook);
  pts = trimHook(pts.slice().reverse(), hook).reverse();
  pts = smoothPositions(pts, p.window);
  pts = smoothPressure(pts, p.pressureWindow);
  return pts.flat();
}

/** רדיוס הקו לפי לחץ – אותה נוסחה כמו בציור הסופי (perfect-freehand). */
export function radiusForPressure(width: number, thinning: number, pressure: number): number {
  return Math.max(0.25, width * (0.5 - thinning * (0.5 - pressure)));
}
