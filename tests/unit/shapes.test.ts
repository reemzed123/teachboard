import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIMS,
  planShape,
  relPosition,
  SHAPE_IDS,
  shapeError,
  type ShapeDims,
  type ShapeId,
} from '../../src/core/geometry/shapes';
import { angleAt } from '../../src/core/geometry/construction';

/** מיקומי הקודקודים כשהבסיס AB מונח אופקית מ-(0,0) באורך הבסיס */
function verts(id: ShapeId, d: Partial<ShapeDims> = {}) {
  const plan = planShape(id, { ...DEFAULT_DIMS, ...d })!;
  const A = { x: 0, y: 0 };
  const B = { x: plan.base, y: 0 };
  return plan.vertices.map((v) =>
    v === 'A' ? A : v === 'B' ? B : relPosition(A.x, A.y, B.x, B.y, v[0], v[1]),
  );
}
const len = (p: { x: number; y: number }, q: { x: number; y: number }) =>
  Math.hypot(q.x - p.x, q.y - p.y);
const ang = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  q: { x: number; y: number },
) => angleAt(p.x, p.y, v.x, v.y, q.x, q.y).deg;

describe('known shapes', () => {
  it('every shape builds with the default sizes, above the base', () => {
    for (const id of SHAPE_IDS) {
      const pts = verts(id);
      expect(pts.length, id).toBeGreaterThanOrEqual(3);
      expect(
        pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
        id,
      ).toBe(true);
    }
    // הצורה מעל הבסיס (y שלילי = למעלה במסך)
    expect(verts('rectangle')[2]!.y).toBeLessThan(0);
  });

  it('triangle by three sides', () => {
    const [A, B, C] = verts('triSSS', { a: 4, b: 5, c: 6 });
    expect(len(A!, B!)).toBeCloseTo(6);
    expect(len(B!, C!)).toBeCloseTo(4);
    expect(len(A!, C!)).toBeCloseTo(5);
  });

  it('triangle by two sides and the angle between them', () => {
    const [A, B, C] = verts('triSAS', { c: 6, b: 4, angle: 40 });
    expect(len(A!, C!)).toBeCloseTo(4);
    expect(ang(B!, A!, C!)).toBeCloseTo(40);
  });

  it('isosceles, equilateral, right and right isosceles triangles', () => {
    const [A, B, C] = verts('isosceles', { c: 6, b: 5 });
    expect(len(A!, C!)).toBeCloseTo(5);
    expect(len(B!, C!)).toBeCloseTo(5);
    const [E, F, G] = verts('equilateral', { a: 3 });
    expect(len(E!, G!)).toBeCloseTo(3);
    expect(len(F!, G!)).toBeCloseTo(3);
    const [R, S, T] = verts('right', { a: 3, b: 4 });
    expect(ang(S!, R!, T!)).toBeCloseTo(90);
    expect(len(S!, T!)).toBeCloseTo(5);
    const [I, J, K] = verts('rightIsosceles', { a: 2 });
    expect(len(I!, K!)).toBeCloseTo(len(I!, J!));
  });

  it('quadrilaterals keep their rules', () => {
    const [A, B, C, D] = verts('rectangle', { a: 5, b: 2 });
    expect(len(B!, C!)).toBeCloseTo(2);
    expect(ang(A!, B!, C!)).toBeCloseTo(90);
    expect(len(A!, C!)).toBeCloseTo(len(B!, D!));

    const sq = verts('square', { a: 3 });
    expect(len(sq[1]!, sq[2]!)).toBeCloseTo(3);
    expect(ang(sq[0]!, sq[1]!, sq[2]!)).toBeCloseTo(90);

    const rh = verts('rhombus', { a: 3, angle: 50 });
    for (let i = 0; i < 4; i++) expect(len(rh[i]!, rh[(i + 1) % 4]!)).toBeCloseTo(3);
    expect(ang(rh[1]!, rh[0]!, rh[3]!)).toBeCloseTo(50);

    const pg = verts('parallelogram', { a: 5, b: 3, angle: 70 });
    expect(len(pg[0]!, pg[3]!)).toBeCloseTo(3);
    expect(len(pg[1]!, pg[2]!)).toBeCloseTo(3);
    expect(len(pg[2]!, pg[3]!)).toBeCloseTo(5);
    expect(ang(pg[1]!, pg[0]!, pg[3]!)).toBeCloseTo(70);
  });

  it('kite: two pairs of equal adjacent sides and the chosen angle', () => {
    const [A, B, C, D] = verts('kite', { a: 3, b: 5, angle: 80 });
    expect(len(A!, B!)).toBeCloseTo(3);
    expect(len(A!, D!)).toBeCloseTo(3);
    expect(len(C!, B!)).toBeCloseTo(5);
    expect(len(C!, D!)).toBeCloseTo(5);
    expect(ang(B!, A!, D!)).toBeCloseTo(80);
  });

  it('trapezoids: parallel bases, height and their special rules', () => {
    const [A, B, C, D] = verts('trapezoid', { a: 6, c: 3, h: 2, angle: 60 });
    expect(C!.y).toBeCloseTo(D!.y);
    expect(len(D!, C!)).toBeCloseTo(3);
    expect(-D!.y).toBeCloseTo(2);
    expect(ang(B!, A!, D!)).toBeCloseTo(60);

    const iso = verts('isoTrapezoid', { a: 6, c: 2, h: 3 });
    expect(len(iso[0]!, iso[3]!)).toBeCloseTo(len(iso[1]!, iso[2]!));
    const rt = verts('rightTrapezoid', { a: 6, c: 2, h: 3 });
    expect(ang(rt[1]!, rt[0]!, rt[3]!)).toBeCloseTo(90);
  });

  it('rejects impossible sizes with a clear reason', () => {
    expect(shapeError('triSSS', { ...DEFAULT_DIMS, a: 1, b: 1, c: 5 })).toBe('triangleInequality');
    expect(shapeError('isosceles', { ...DEFAULT_DIMS, c: 6, b: 3 })).toBe('legTooShort');
    expect(shapeError('rhombus', { ...DEFAULT_DIMS, angle: 180 })).toBe('angleRange');
    expect(shapeError('square', { ...DEFAULT_DIMS, a: 0 })).toBe('positive');
    expect(shapeError('kite', { ...DEFAULT_DIMS, a: 5, b: 1, angle: 120 })).toBe('kiteSides');
    expect(planShape('triSSS', { ...DEFAULT_DIMS, a: 1, b: 1, c: 5 })).toBeNull();
    // מידה שהצורה לא משתמשת בה לא משנה
    expect(shapeError('square', { ...DEFAULT_DIMS, b: -1 })).toBeNull();
  });
});
