import { describe, expect, it } from 'vitest';
import type { GeoElement } from '../../src/core/document/types';
import {
  buildDecoration,
  decorationIds,
  decorationsFor,
  hasDecoration,
} from '../../src/core/geometry/decorations';
import { buildStep } from '../../src/core/geometry/tools';
import { removeElements } from '../../src/core/geometry/construction';

const style = { color: '#000000', width: 2 };
const pt = (id: string, x: number, y: number, label: string): GeoElement => ({
  id,
  kind: 'point',
  parents: [],
  params: { x, y },
  style: { ...style, label },
});

function polygon(n: number) {
  const pts = Array.from({ length: n }, (_, i) =>
    pt(`p${i}`, Math.cos(i) * 100, Math.sin(i) * 100, 'ABCDEFG'[i]!),
  );
  const ids = pts.map((p) => p.id);
  const edges: GeoElement[] = ids.map((id, i) => ({
    id: `s${i}`,
    kind: 'segment',
    parents: [id, ids[(i + 1) % n]!],
    style,
  }));
  const poly: GeoElement = { id: 'poly', kind: 'polygon', parents: ids, style };
  return [...pts, ...edges, poly];
}

describe('polygon decorations', () => {
  it('offers medians/altitudes/bisectors only for triangles, diagonals from 4 vertices', () => {
    expect(decorationsFor(3)).toEqual(['medians', 'bisectors', 'altitudes', 'angles', 'sides']);
    expect(decorationsFor(4)).toEqual(['diagonals', 'angles', 'sides']);
  });

  it('builds the right number of elements, reusing existing sides', () => {
    const quad = polygon(4);
    expect(
      buildDecoration(quad, 'poly', 'diagonals').filter((e) => e.kind === 'segment'),
    ).toHaveLength(2);
    expect(buildDecoration(polygon(6), 'poly', 'diagonals')).toHaveLength(9);
    const tri = polygon(3);
    const med = buildDecoration(tri, 'poly', 'medians');
    expect(med.filter((e) => e.kind === 'midpoint')).toHaveLength(3);
    const alt = buildDecoration(tri, 'poly', 'altitudes');
    expect(alt.filter((e) => e.kind === 'foot').map((e) => e.parents[1])).toEqual([
      's1',
      's2',
      's0',
    ]);
    expect(buildDecoration(tri, 'poly', 'sides').map((e) => e.parents[0])).toEqual([
      's0',
      's1',
      's2',
    ]);
    // נקודות חדשות מקבלות שמות פנויים
    expect(med.map((e) => e.style.label).filter(Boolean)).toEqual(['D', 'E', 'F']);
  });

  it('is tagged so it can be turned off again', () => {
    const tri = polygon(3);
    const withAngles = [...tri, ...buildDecoration(tri, 'poly', 'angles')];
    expect(hasDecoration(withAngles, 'poly', 'angles')).toBe(true);
    const off = removeElements(withAngles, decorationIds(withAngles, 'poly', 'angles'));
    expect(off).toEqual(tri);
  });
});

describe('circle tools and shapes', () => {
  const ctx = (elements: GeoElement[]) => {
    const byId = new Map(elements.map((e) => [e.id, e]));
    return {
      elements,
      style,
      n: 5,
      r: 50,
      kindOf: (id: string) => byId.get(id)?.kind,
      parentsOf: (id: string) => byId.get(id)?.parents ?? [],
    };
  };
  const circle: GeoElement[] = [
    pt('o', 0, 0, 'O'),
    pt('q', 50, 0, 'Q'),
    { id: 'c', kind: 'circle', parents: ['o', 'q'], style },
    pt('a', 0, 50, 'A'),
    pt('b', -50, 0, 'B'),
    pt('v', 0, -50, 'V'),
  ];

  it('central angle uses the circle center, inscribed angle the chosen vertex', () => {
    const central = buildStep('centralAngle', ['c', 'a', 'b'], ctx(circle));
    expect(central.find((e) => e.kind === 'angle')?.parents).toEqual(['a', 'o', 'b']);
    const inscribed = buildStep('inscribedAngle', ['c', 'v', 'a', 'b'], ctx(circle));
    expect(inscribed.find((e) => e.kind === 'angle')?.parents).toEqual(['a', 'v', 'b']);
    expect(buildStep('chord', ['c', 'a', 'b'], ctx(circle))[0]?.parents).toEqual(['a', 'b']);
    expect(buildStep('radius', ['c', 'a'], ctx(circle))[0]?.parents).toEqual(['o', 'a']);
  });

  it('circle through 3 points gets a hidden center for radius', () => {
    const els: GeoElement[] = [
      ...circle,
      { id: 'c3', kind: 'circle3', parents: ['a', 'b', 'v'], style },
    ];
    const out = buildStep('radius', ['c3', 'q'], ctx(els));
    expect(out.filter((e) => e.kind === 'perpBisector').every((e) => e.style.hidden)).toBe(true);
    expect(out.at(-1)?.kind).toBe('segment');
  });

  it('known shape: fixed size uses a hidden ring, vertices named in polygon order', () => {
    const els = [pt('a', 10, 20, 'A')];
    const out = buildStep('shape', ['a'], {
      ...ctx(els),
      shape: { id: 'kite', dims: { a: 3, b: 5, c: 1, h: 1, angle: 80 }, fixed: true },
      unitsPerCm: 10,
      posOf: () => ({ x: 10, y: 20 }),
    });
    expect(out.find((e) => e.kind === 'circleR')?.style.hidden).toBe(true);
    const poly = out.find((e) => e.kind === 'polygon')!;
    const byId = new Map([...els, ...out].map((e) => [e.id, e]));
    expect(poly.parents.map((id) => byId.get(id)?.style.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(byId.get(poly.parents[2]!)?.kind).toBe('glider');

    const free = buildStep('shape', ['a'], {
      ...ctx(els),
      shape: { id: 'square', dims: { a: 3, b: 1, c: 1, h: 1, angle: 60 }, fixed: false },
      unitsPerCm: 10,
      posOf: () => ({ x: 10, y: 20 }),
    });
    expect(free.some((e) => e.kind === 'circleR')).toBe(false);
    expect(free.find((e) => e.kind === 'point')?.params).toEqual({ x: 40, y: 20 });
  });
});

describe('equality marks on known shapes', () => {
  const ctxFor = (els: GeoElement[]) => {
    const byId = new Map(els.map((e) => [e.id, e]));
    return {
      elements: els,
      style,
      n: 5,
      r: 50,
      kindOf: (id: string) => byId.get(id)?.kind,
      parentsOf: (id: string) => byId.get(id)?.parents ?? [],
      unitsPerCm: 10,
      posOf: () => ({ x: 0, y: 0 }),
    };
  };
  const build = (id: 'parallelogram' | 'isosceles' | 'kite' | 'rectangle', marks = true) =>
    buildStep('shape', ['a'], {
      ...ctxFor([pt('a', 0, 0, 'A')]),
      shape: { id, dims: { a: 5, b: 4, c: 6, h: 3, angle: 60 }, fixed: false, marks },
    });

  it('parallelogram: opposite sides equal and parallel (arrows point the same way), opposite angles equal', () => {
    const out = build('parallelogram');
    const segs = out.filter((e) => e.kind === 'segment');
    expect(segs.map((e) => e.style.ticks)).toEqual([1, 2, 1, 2]);
    expect(segs.map((e) => e.style.arrows)).toEqual([1, 2, 1, 2]);
    // CD הפוך ל-DC, כדי שיהיה באותו כיוון כמו AB
    const poly = out.find((e) => e.kind === 'polygon')!;
    const [A, B, C, D] = poly.parents;
    expect(segs[0]!.parents).toEqual([A, B]);
    expect(segs[2]!.parents).toEqual([D, C]);
    const angles = out.filter((e) => e.kind === 'angle');
    expect(angles.map((e) => e.style.arcs)).toEqual([1, 2, 1, 2]);
    expect(angles.every((e) => e.style.showLabel === false)).toBe(true);
  });

  it('isosceles: equal legs and base angles; kite: two pairs of equal sides', () => {
    const iso = build('isosceles');
    expect(iso.filter((e) => e.kind === 'segment').map((e) => e.style.ticks)).toEqual([
      undefined,
      1,
      1,
    ]);
    expect(iso.filter((e) => e.kind === 'angle')).toHaveLength(2);
    const kite = build('kite');
    expect(kite.filter((e) => e.kind === 'segment').map((e) => e.style.ticks)).toEqual([
      1, 2, 2, 1,
    ]);
  });

  it('marks can be turned off', () => {
    const out = build('rectangle', false);
    expect(out.some((e) => e.kind === 'angle' || e.style.ticks)).toBe(false);
  });
});
