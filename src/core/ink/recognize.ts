// זיהוי צורה מקו יד (Hold-to-Shape): קו ישר, משולש, מלבן/מרובע, מעגל או אליפסה.
// מחזיר את הצורה הנקייה כרשימת נקודות (x, y) – או null אם הקו לא דומה מספיק לצורה.

export type ShapeKind = 'line' | 'triangle' | 'rectangle' | 'quad' | 'circle' | 'ellipse';

export interface RecognizedShape {
  kind: ShapeKind;
  /** נקודות הצורה (x, y לסירוגין); צורה סגורה – הנקודה הראשונה חוזרת בסוף */
  points: number[];
}

type P = { x: number; y: number };

const dist = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);

function segDist(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker: מפשט רצף נקודות לפינות העיקריות */
function rdp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [pts[0]!, pts[pts.length - 1]!];
  const left = rdp(pts.slice(0, idx + 1), eps);
  return [...left.slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

/** פינות של קו סגור */
function closedCorners(pts: P[], eps: number, mergeDist: number): P[] {
  // מפצלים בנקודה הרחוקה ביותר מההתחלה – ומפשטים כל חצי
  let far = 0;
  for (let i = 1; i < pts.length; i++)
    if (dist(pts[i]!, pts[0]!) > dist(pts[far]!, pts[0]!)) far = i;
  const a = rdp(pts.slice(0, far + 1), eps);
  const b = rdp([...pts.slice(far), pts[0]!], eps);
  let corners = [...a.slice(0, -1), ...b.slice(0, -1)];
  // מאחדים פינות קרובות (כולל הסגירה)
  const merged: P[] = [];
  for (const c of corners) {
    if (!merged.length || dist(merged[merged.length - 1]!, c) > mergeDist) merged.push(c);
  }
  if (merged.length > 1 && dist(merged[0]!, merged[merged.length - 1]!) <= mergeDist) merged.pop();
  corners = merged;
  // מסירים פינה "שטוחה" (כמעט על קו ישר בין שכנותיה)
  let changed = true;
  while (changed && corners.length > 3) {
    changed = false;
    for (let i = 0; i < corners.length; i++) {
      const prev = corners[(i - 1 + corners.length) % corners.length]!;
      const next = corners[(i + 1) % corners.length]!;
      if (segDist(corners[i]!, prev, next) < eps * 0.8) {
        corners.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return corners;
}

/** ממוצע המרחק של הנקודות מהמצולע (כמה טוב המצולע מתאר את הקו) */
function polygonFit(pts: P[], poly: P[]): number {
  let sum = 0;
  for (const p of pts) {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++)
      best = Math.min(best, segDist(p, poly[i]!, poly[(i + 1) % poly.length]!));
    sum += best;
  }
  return sum / pts.length;
}

const angleDeg = (a: P, b: P) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

function flat(points: P[], close: boolean): number[] {
  const out = points.flatMap((p) => [round(p.x), round(p.y)]);
  if (close) out.push(round(points[0]!.x), round(points[0]!.y));
  return out;
}
const round = (v: number) => Math.round(v * 100) / 100;

function ellipsePoints(cx: number, cy: number, rx: number, ry: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    out.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return out;
}

/**
 * מזהה צורה בקו (נקודות x, y, לחץ). minSize – גודל מינימלי (יחידות לוח) כדי לא לזהות כתב יד קטן.
 */
export function recognizeShape(
  triples: readonly number[],
  minSize: number,
): RecognizedShape | null {
  const pts: P[] = [];
  for (let i = 0; i + 1 < triples.length; i += 3) pts.push({ x: triples[i]!, y: triples[i + 1]! });
  if (pts.length < 6) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let length = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    if (i) length += dist(pts[i - 1]!, p);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < minSize) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const gap = dist(first, last);

  // קו פתוח: ישר?
  if (gap > length * 0.3) {
    const chord = dist(first, last);
    let maxDev = 0;
    for (const p of pts) maxDev = Math.max(maxDev, segDist(p, first, last));
    if (chord > 0 && maxDev < chord * 0.07 && length < chord * 1.15)
      return { kind: 'line', points: flat([first, last], false) };
    return null;
  }

  // קו סגור: משולש / מרובע
  const eps = diag * 0.07;
  const corners = closedCorners(pts, eps, diag * 0.15);
  if ((corners.length === 3 || corners.length === 4) && polygonFit(pts, corners) < diag * 0.045) {
    if (corners.length === 3) return { kind: 'triangle', points: flat(corners, true) };
    // מלבן: כל הצלעות כמעט אופקיות/אנכיות
    const aligned = corners.every((c, i) => {
      const a = Math.abs(angleDeg(c, corners[(i + 1) % 4]!)) % 90;
      return a < 12 || a > 78;
    });
    if (aligned) {
      const rect = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      return { kind: 'rectangle', points: flat(rect, true) };
    }
    return { kind: 'quad', points: flat(corners, true) };
  }

  // מעגל / אליפסה
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = w / 2;
  const ry = h / 2;
  if (rx < 1 || ry < 1) return null;
  let err = 0;
  for (const p of pts) err += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
  err /= pts.length;
  if (err > 0.09) return null;
  const ratio = Math.max(rx, ry) / Math.min(rx, ry);
  if (ratio < 1.2) {
    const r = (rx + ry) / 2;
    return { kind: 'circle', points: flat(ellipsePoints(cx, cy, r, r), true) };
  }
  return { kind: 'ellipse', points: flat(ellipsePoints(cx, cy, rx, ry), true) };
}
