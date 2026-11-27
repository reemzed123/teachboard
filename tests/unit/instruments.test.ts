import { describe, expect, it } from 'vitest';
import {
  arcPoints,
  drawingEdges,
  nearestEdge,
  projectOnEdge,
  RULER,
  unwrapAngle,
} from '../../src/core/instruments';

describe('virtual instruments', () => {
  it('ruler edge follows its rotation; points snap onto the edge', () => {
    const [edge] = drawingEdges({ ruler: { x: 100, y: 100, angle: 90 } });
    // סיבוב 90°: הקצה העליון הופך לקו אנכי מימין למרכז
    expect(edge!.a.x).toBeCloseTo(100 + RULER.width / 2);
    expect(edge!.b.x).toBeCloseTo(100 + RULER.width / 2);
    const p = projectOnEdge(edge!, { x: 140, y: 120 });
    expect(p.x).toBeCloseTo(100 + RULER.width / 2);
    expect(p.y).toBeCloseTo(120);
  });

  it('finds the nearest drawing edge only within the tolerance', () => {
    const edges = drawingEdges({ setSquare: { x: 0, y: 0, angle: 0, kind: '45' } });
    expect(edges).toHaveLength(3);
    expect(nearestEdge(edges, { x: 50, y: 3 }, 8)).toBe(edges[0]);
    expect(nearestEdge(edges, { x: 50, y: 40 }, 8)).toBeNull();
  });

  it('compass arcs: points on the circle, a full turn is closed', () => {
    const c = { cx: 0, cy: 0, r: 100, angle: 0 };
    const pts = arcPoints(c, 0, 360);
    expect(pts[0]!.x).toBeCloseTo(100);
    expect(pts.at(-1)!.x).toBeCloseTo(100);
    expect(pts.every((p) => Math.abs(Math.hypot(p.x, p.y) - 100) < 1e-6)).toBe(true);
    // סיבוב מצטבר מעבר ל-180°
    expect(unwrapAngle(170, -170)).toBe(190);
  });
});
