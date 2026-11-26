// צורות ידועות (משולשים ומרובעים) שנבנות לפי מידות שהמשתמש בוחר.
// כל קודקוד מחושב יחסית לבסיס (שתי נקודות), ולכן הצורה שומרת על החוקים שלה גם בגרירה:
// מלבן נשאר מלבן, מעוין נשאר מעוין וכו'.

export type ShapeId =
  | 'triSSS'
  | 'triSAS'
  | 'isosceles'
  | 'equilateral'
  | 'right'
  | 'rightIsosceles'
  | 'square'
  | 'rectangle'
  | 'rhombus'
  | 'parallelogram'
  | 'kite'
  | 'trapezoid'
  | 'isoTrapezoid'
  | 'rightTrapezoid';

export type DimKey = 'a' | 'b' | 'c' | 'h' | 'angle';

export type ShapeDims = Record<DimKey, number>;

export const TRIANGLES: readonly ShapeId[] = [
  'triSSS',
  'triSAS',
  'isosceles',
  'equilateral',
  'right',
  'rightIsosceles',
];
export const QUADRILATERALS: readonly ShapeId[] = [
  'square',
  'rectangle',
  'rhombus',
  'parallelogram',
  'kite',
  'trapezoid',
  'isoTrapezoid',
  'rightTrapezoid',
];
export const SHAPE_IDS: readonly ShapeId[] = [...TRIANGLES, ...QUADRILATERALS];

/** קודקוד בצורה: A (הנקודה שנלחצה), B (נקודת הבסיס השנייה), או נקודה יחסית [u, v] */
export type Vertex = 'A' | 'B' | readonly [number, number];

export interface ShapePlan {
  /** אורך הבסיס AB (באותן יחידות של המידות) */
  base: number;
  /** הקודקודים לפי סדר המצולע */
  vertices: Vertex[];
}

/** המידות שכל צורה מבקשת (לפי הסדר בטופס) */
export const SHAPE_DIMS: Record<ShapeId, DimKey[]> = {
  triSSS: ['c', 'a', 'b'],
  triSAS: ['c', 'b', 'angle'],
  isosceles: ['c', 'b'],
  equilateral: ['a'],
  right: ['a', 'b'],
  rightIsosceles: ['a'],
  square: ['a'],
  rectangle: ['a', 'b'],
  rhombus: ['a', 'angle'],
  parallelogram: ['a', 'b', 'angle'],
  kite: ['a', 'b', 'angle'],
  trapezoid: ['a', 'c', 'h', 'angle'],
  isoTrapezoid: ['a', 'c', 'h'],
  rightTrapezoid: ['a', 'c', 'h'],
};

export const DEFAULT_DIMS: ShapeDims = { a: 5, b: 4, c: 6, h: 3, angle: 60 };

export type ShapeError =
  'positive' | 'angleRange' | 'triangleInequality' | 'legTooShort' | 'kiteSides';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** בדיקת המידות: null אם תקין, אחרת סוג השגיאה */
export function shapeError(id: ShapeId, d: ShapeDims): ShapeError | null {
  for (const k of SHAPE_DIMS[id]) {
    const v = d[k];
    if (!Number.isFinite(v) || v <= 0) return 'positive';
    if (k === 'angle' && v >= 180) return 'angleRange';
  }
  switch (id) {
    case 'triSSS':
      if (d.a + d.b <= d.c || d.a + d.c <= d.b || d.b + d.c <= d.a) return 'triangleInequality';
      return null;
    case 'isosceles':
      return d.b * 2 <= d.c ? 'legTooShort' : null;
    case 'kite':
      return d.b <= d.a * Math.sin(rad(d.angle) / 2) ? 'kiteSides' : null;
    default:
      return null;
  }
}

/** תכנון הצורה: אורך הבסיס, והקודקודים יחסית לבסיס (מנורמלים לאורך הבסיס) */
export function planShape(id: ShapeId, d: ShapeDims): ShapePlan | null {
  if (shapeError(id, d)) return null;
  const tri = (base: number, x: number, y: number): ShapePlan => ({
    base,
    vertices: ['A', 'B', [x / base, y / base]],
  });
  const quad = (base: number, cx: number, cy: number, dx: number, dy: number): ShapePlan => ({
    base,
    vertices: ['A', 'B', [cx / base, cy / base], [dx / base, dy / base]],
  });
  const al = rad(d.angle);
  switch (id) {
    case 'triSSS': {
      // AB = c, BC = a, CA = b
      const x = (d.b ** 2 + d.c ** 2 - d.a ** 2) / (2 * d.c);
      return tri(d.c, x, Math.sqrt(Math.max(0, d.b ** 2 - x ** 2)));
    }
    case 'triSAS':
      // AB = c, AC = b, והזווית ביניהן ב-A
      return tri(d.c, d.b * Math.cos(al), d.b * Math.sin(al));
    case 'isosceles':
      // בסיס AB = c, שוקיים AC = BC = b
      return tri(d.c, d.c / 2, Math.sqrt(d.b ** 2 - d.c ** 2 / 4));
    case 'equilateral':
      return tri(d.a, d.a / 2, (d.a * Math.sqrt(3)) / 2);
    case 'right':
      // ניצבים AB = a, AC = b, זווית ישרה ב-A
      return tri(d.a, 0, d.b);
    case 'rightIsosceles':
      return tri(d.a, 0, d.a);
    case 'square':
      return quad(d.a, d.a, d.a, 0, d.a);
    case 'rectangle':
      return quad(d.a, d.a, d.b, 0, d.b);
    case 'rhombus':
      return quad(
        d.a,
        d.a + d.a * Math.cos(al),
        d.a * Math.sin(al),
        d.a * Math.cos(al),
        d.a * Math.sin(al),
      );
    case 'parallelogram':
      return quad(
        d.a,
        d.a + d.b * Math.cos(al),
        d.b * Math.sin(al),
        d.b * Math.cos(al),
        d.b * Math.sin(al),
      );
    case 'kite': {
      // AB = AD = a, CB = CD = b, הזווית ב-A; האלכסון AC הוא ציר הסימטריה (הבסיס)
      const half = al / 2;
      const s = d.a * Math.sin(half);
      const p = d.a * Math.cos(half) + Math.sqrt(d.b ** 2 - s ** 2);
      const x = d.a * Math.cos(half);
      return { base: p, vertices: ['A', [x / p, s / p], 'B', [x / p, -s / p]] };
    }
    case 'trapezoid': {
      // בסיסים AB = a, DC = c, גובה h, זווית הבסיס ב-A
      const off = d.h / Math.tan(al);
      return quad(d.a, off + d.c, d.h, off, d.h);
    }
    case 'isoTrapezoid': {
      const off = (d.a - d.c) / 2;
      return quad(d.a, off + d.c, d.h, off, d.h);
    }
    case 'rightTrapezoid':
      return quad(d.a, d.c, d.h, 0, d.h);
  }
}

/** מיקום קודקוד יחסי, כשהבסיס הוא A→B (כמו בגרעין: v כלפי "מעלה" במסך) */
export function relPosition(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  u: number,
  v: number,
): { x: number; y: number } {
  return {
    x: ax + u * (bx - ax) + v * (by - ay),
    y: ay + u * (by - ay) - v * (bx - ax),
  };
}
