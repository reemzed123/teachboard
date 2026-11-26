import { describe, expect, it } from 'vitest';
import type { GeoElement } from '../../src/core/document/types';
import {
  angleAt,
  nextPointLabel,
  polygonArea,
  polygonPerimeter,
  removeElements,
  withDependents,
} from '../../src/core/geometry/construction';

const el = (
  id: string,
  kind: GeoElement['kind'],
  parents: string[] = [],
  label?: string,
): GeoElement => ({
  id,
  kind,
  parents,
  style: { color: '#000000', width: 2, label },
});

describe('construction helpers', () => {
  it('gives the next free point name', () => {
    expect(nextPointLabel([el('a', 'point', [], 'A'), el('b', 'point', [], 'B')])).toBe('C');
    expect(nextPointLabel([el('a', 'point', [], 'B')])).toBe('A');
  });

  it('deleting a point deletes everything built on it', () => {
    const els = [
      el('A', 'point'),
      el('B', 'point'),
      el('C', 'point'),
      el('s', 'segment', ['A', 'B']),
      el('m', 'midpoint', ['A', 'B']),
      el('p', 'perpendicular', ['s', 'C']),
      el('x', 'intersection', ['p', 's']),
    ];
    expect([...withDependents(els, ['A'])].sort()).toEqual(['A', 'm', 'p', 's', 'x']);
    expect(removeElements(els, ['A']).map((e) => e.id)).toEqual(['B', 'C']);
  });

  it('area, perimeter and angles', () => {
    const square = [0, 0, 2, 0, 2, 2, 0, 2];
    expect(polygonArea(square)).toBe(4);
    expect(polygonPerimeter(square)).toBe(8);
    expect(angleAt(1, 0, 0, 0, 0, 1).deg).toBeCloseTo(90);
    expect(angleAt(1, 0, 0, 0, -1, 0.0001).deg).toBeCloseTo(180, 1);
  });
});

import {
  distanceTo,
  freeAncestors,
  hitElement,
  type Solution,
} from '../../src/core/geometry/construction';

describe('hit testing', () => {
  const els = [
    el('A', 'point'),
    el('B', 'point'),
    el('s', 'segment', ['A', 'B']),
    el('c', 'circle', ['A', 'B']),
  ];
  const sol: Solution = new Map([
    ['A', { t: 'pt', x: 0, y: 0 }],
    ['B', { t: 'pt', x: 100, y: 0 }],
    ['s', { t: 'ln', x1: 0, y1: 0, x2: 100, y2: 0, mode: 'segment' }],
    ['c', { t: 'circ', cx: 0, cy: 0, r: 100 }],
  ]);
  it('prefers points, then finds lines and circles', () => {
    expect(hitElement(els, sol, 2, 3, 8, 'any')!.id).toBe('A');
    expect(hitElement(els, sol, 50, 4, 8, 'any')!.id).toBe('s');
    expect(hitElement(els, sol, 0, 98, 8, 'circle')!.id).toBe('c');
    expect(hitElement(els, sol, 50, 40, 8, 'any')).toBeNull();
  });
  it('segment distance is clamped; line is not', () => {
    expect(distanceTo({ t: 'ln', x1: 0, y1: 0, x2: 10, y2: 0, mode: 'segment' }, 20, 0)).toBe(10);
    expect(distanceTo({ t: 'ln', x1: 0, y1: 0, x2: 10, y2: 0, mode: 'line' }, 20, 0)).toBe(0);
  });
  it('free ancestors of a polygon are its free points', () => {
    const e2 = [...els, el('m', 'midpoint', ['A', 'B']), el('poly', 'polygon', ['A', 'B', 'm'])];
    expect(freeAncestors(e2, 'poly').sort()).toEqual(['A', 'B']);
  });
});

describe('clicking inside nested polygons', () => {
  it('selects the inner (smaller) polygon, the outer one around it', () => {
    const els = [el('big', 'polygon'), el('small', 'polygon')];
    const sol: Solution = new Map([
      ['big', { t: 'poly', pts: [0, 0, 400, 0, 400, 400, 0, 400] }],
      ['small', { t: 'poly', pts: [100, 100, 200, 100, 150, 200] }],
    ]);
    expect(hitElement(els, sol, 150, 130, 8, 'any')!.id).toBe('small');
    expect(hitElement(els, sol, 300, 300, 8, 'any')!.id).toBe('big');
    // גם כשהקטן נוצר קודם ברשימה
    expect(hitElement([...els].reverse(), sol, 150, 130, 8, 'any')!.id).toBe('small');
  });
});
