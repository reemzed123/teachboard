import { describe, expect, it } from 'vitest';
import type { GeoElement } from '../../src/core/document/types';
import { buildStep, newPoint, TOOL_SLOTS, type BuildContext } from '../../src/core/geometry/tools';

function ctx(elements: GeoElement[]): BuildContext {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return {
    elements,
    style: { color: '#000000', width: 2 },
    n: 5,
    r: 50,
    kindOf: (id) => byId.get(id)?.kind,
    parentsOf: (id) => byId.get(id)?.parents ?? [],
  };
}

const pts = () => {
  const style = { color: '#000000', width: 2 };
  const A = newPoint([], 0, 0, style);
  const B = newPoint([A], 100, 0, style);
  const C = newPoint([A, B], 30, 80, style);
  return [A, B, C];
};

describe('geometry tools', () => {
  it('new points get the next free letter', () => {
    expect(pts().map((p) => p.style.label)).toEqual(['A', 'B', 'C']);
  });

  it('every tool has a defined input shape', () => {
    expect(TOOL_SLOTS.midpoint).toEqual([['S'], ['P', 'P']]);
  });

  it('midpoint from a segment uses its two endpoints', () => {
    const [A, B] = pts();
    const seg: GeoElement = {
      id: 's',
      kind: 'segment',
      parents: [A!.id, B!.id],
      style: { color: '#000', width: 2 },
    };
    const out = buildStep('midpoint', ['s'], ctx([A!, B!, seg]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'midpoint', parents: [A!.id, B!.id] });
    expect(out[0]!.style.label).toBe('C');
  });

  it('polygon creates its sides and a filled polygon', () => {
    const p = pts();
    const out = buildStep(
      'polygon',
      p.map((x) => x.id),
      ctx(p),
    );
    expect(out.filter((e) => e.kind === 'segment')).toHaveLength(3);
    expect(out.at(-1)).toMatchObject({ kind: 'polygon', style: { fill: true, width: 0 } });
  });

  it('regular pentagon adds 3 vertices and 5 sides', () => {
    const [A, B] = pts();
    const out = buildStep('regularPolygon', [A!.id, B!.id], ctx([A!, B!]));
    expect(out.filter((e) => e.kind === 'regularVertex')).toHaveLength(3);
    expect(out.filter((e) => e.kind === 'segment')).toHaveLength(5);
  });

  it('intersection of two circles gives two points; of two lines one', () => {
    const [A, B, C] = pts();
    const c1: GeoElement = {
      id: 'c1',
      kind: 'circle',
      parents: [A!.id, B!.id],
      style: { color: '#000', width: 2 },
    };
    const c2: GeoElement = {
      id: 'c2',
      kind: 'circle',
      parents: [B!.id, A!.id],
      style: { color: '#000', width: 2 },
    };
    expect(buildStep('intersection', ['c1', 'c2'], ctx([A!, B!, C!, c1, c2]))).toHaveLength(2);
    const l1: GeoElement = {
      id: 'l1',
      kind: 'line',
      parents: [A!.id, B!.id],
      style: { color: '#000', width: 2 },
    };
    const l2: GeoElement = {
      id: 'l2',
      kind: 'line',
      parents: [A!.id, C!.id],
      style: { color: '#000', width: 2 },
    };
    expect(buildStep('intersection', ['l1', 'l2'], ctx([A!, B!, C!, l1, l2]))).toHaveLength(1);
  });

  it('altitude adds a foot point, a dashed segment and a right-angle mark', () => {
    const [A, B, C] = pts();
    const ab: GeoElement = {
      id: 'ab',
      kind: 'segment',
      parents: [A!.id, B!.id],
      style: { color: '#000', width: 2 },
    };
    const out = buildStep('altitude', [C!.id, 'ab'], ctx([A!, B!, C!, ab]));
    expect(out.map((e) => e.kind)).toEqual(['foot', 'segment', 'angle']);
  });

  it('tangent at a point on the circle: one line, perpendicular to the radius', () => {
    const style = { color: '#000000', width: 2 };
    const els: GeoElement[] = [
      { id: 'o', kind: 'point', parents: [], params: { x: 0, y: 0 }, style },
      { id: 'q', kind: 'point', parents: [], params: { x: 50, y: 0 }, style },
      { id: 'c', kind: 'circle', parents: ['o', 'q'], style },
      { id: 'g', kind: 'glider', parents: ['c'], params: { x: 0, y: 50 }, style },
    ];
    // גם בסדר מעגל → נקודה (מהסרגל הקופץ)
    const out = buildStep('tangent', ['c', 'g'], ctx(els));
    expect(out.map((e) => e.kind)).toEqual(['segment', 'perpendicular']);
    expect(out[0]!.style.hidden).toBe(true);
    expect(out[1]!.parents).toEqual([out[0]!.id, 'g']);
  });

  it('tangent from an external point: two tangent lines', () => {
    const [A, B, C] = pts();
    const circ: GeoElement = {
      id: 'c',
      kind: 'circle',
      parents: [A!.id, B!.id],
      style: { color: '#000', width: 2 },
    };
    const out = buildStep('tangent', [C!.id, 'c'], ctx([A!, B!, C!, circ]));
    expect(out.filter((e) => e.kind === 'line')).toHaveLength(2);
  });
});
