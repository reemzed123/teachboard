import { describe, expect, it } from 'vitest';
import {
  findRoots,
  MAX_ROOTS,
  formatNumber,
  intersections,
  niceStep,
  valueTable,
} from '../../src/core/math/numeric';
import { compileExpression } from '../../src/core/math/parse';

const f = (s: string) => compileExpression(s);
const close = (a: number[], b: number[]) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
};

describe('roots and intersections', () => {
  it('quadratic with two roots', () => close(findRoots(f('x^2-3x+2'), -10, 10), [1, 2]));
  it('double root (touches the axis)', () => close(findRoots(f('(x-1)^2'), -10, 10), [1]));
  it('no roots', () => expect(findRoots(f('x^2+1'), -10, 10)).toEqual([]));
  it('sine roots in [-4, 4]', () => close(findRoots(f('\\sin x'), -4, 4), [-Math.PI, 0, Math.PI]));
  it('ignores asymptote jumps (tan)', () => close(findRoots(f('\\tan x'), -2, 2), [0]));
  it('log root', () => close(findRoots(f('\\ln x'), 0.01, 5), [1]));
  it('line and parabola', () => {
    const pts = intersections(f('x^2'), f('x+2'), -10, 10);
    close(
      pts.map((p) => p.x),
      [-1, 2],
    );
    close(
      pts.map((p) => p.y),
      [1, 4],
    );
  });
});

describe('formatting and tables', () => {
  it('formats numbers for display', () => {
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(1.23456)).toBe('1.23');
    expect(formatNumber(-0.0001)).toBe('0');
    expect(formatNumber(NaN)).toBe('—');
  });
  it('value table', () => {
    expect(valueTable(f('2x'), -1, 0.5, 5).map((r) => r.y)).toEqual([-2, -1, 0, 1, 2]);
  });
  it('nice tick steps', () => {
    expect(niceStep(20)).toBe(2);
    expect(niceStep(100)).toBe(10);
    expect(niceStep(3)).toBe(0.5);
  });
});

describe('root finding – edge cases', () => {
  it('identical functions have no intersection points (not thousands)', () => {
    expect(
      intersections(
        (x) => x,
        (x) => x,
        -10,
        10,
      ),
    ).toEqual([]);
    // חופפות רק בחלק מהתחום: אין נקודות בחלק החופף, אבל יש חיתוך אמיתי במקום אחר
    const f = (x: number) => (x < 0 ? 0 : x * x - 4);
    const roots = findRoots(f, -10, 10);
    expect(roots.map((r) => Math.round(r * 1000) / 1000)).toEqual([2]);
  });

  it('no false roots at vertical asymptotes', () => {
    expect(findRoots((x) => 1 / (x - Math.PI), -10, 10)).toEqual([]);
    const tanRoots = findRoots(Math.tan, -4, 4).map((r) => Math.round(r * 1000) / 1000);
    expect(tanRoots).toEqual([-3.142, 0, 3.142]);
  });

  it('fast oscillation returns at most MAX_ROOTS points', () => {
    expect(findRoots((x) => Math.sin(40 * x), -10, 10, 4000).length).toBe(MAX_ROOTS);
  });
});
