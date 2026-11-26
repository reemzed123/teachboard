import { describe, expect, it } from 'vitest';
import type { GraphObject } from '../../src/core/document/types';
import { graphPoints, placeLabel, type LabelRect } from '../../src/engine/render/drawGraph';

const graph = (latex: string[], extra: Partial<GraphObject> = {}): GraphObject =>
  ({
    id: 'g',
    type: 'graph',
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    width: 400,
    height: 300,
    range: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    functions: latex.map((l, i) => ({ id: `f${i}`, latex: l, color: '#2563eb', visible: true })),
    showIntercepts: true,
    showIntersections: true,
    ...extra,
  }) as GraphObject;

describe('graph points', () => {
  it('are computed once per graph version (not on every redraw)', () => {
    const g = graph(['x^2-1']);
    const a = graphPoints(g);
    expect(graphPoints(g)).toBe(a);
    // שינוי בגרף = אובייקט חדש = חישוב חדש
    const changed = graphPoints({ ...g, functions: [{ ...g.functions[0]!, latex: 'x-2' }] });
    expect(changed).not.toBe(a);
    expect(changed.map((p) => p.x)).toContain(2);
  });

  it('two identical functions do not flood the graph with points', () => {
    const pts = graphPoints(graph(['x', 'x'], { showIntercepts: false }));
    expect(pts).toEqual([]);
  });
});

describe('point labels', () => {
  it('a label that would overlap another moves below / to the other side', () => {
    const placed: LabelRect[] = [];
    const a = placeLabel(placed, 100, 100, 60, 14);
    const b = placeLabel(placed, 104, 102, 60, 14);
    expect(a).toEqual({ x: 106, y: 96 });
    expect(b.y).toBeGreaterThan(102); // מתחת לנקודה
    const c = placeLabel(placed, 300, 100, 60, 14);
    expect(c).toEqual({ x: 306, y: 96 }); // רחוק – במקום הרגיל
  });
});
