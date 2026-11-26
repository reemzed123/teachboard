import { describe, expect, it } from 'vitest';
import { extrema, verticalAsymptotes } from '../../src/core/math/analysis';
import { compileExpression } from '../../src/core/math/parse';

const r2 = (v: number) => Math.round(v * 100) / 100;

describe('function analysis', () => {
  it('finds maximum and minimum points', () => {
    // x^3 - 3x: max ב-(-1, 2), min ב-(1, -2)
    const ex = extrema(compileExpression('x^3-3x'), -5, 5);
    expect(ex.map((e) => [e.kind, r2(e.x), r2(e.y)])).toEqual([
      ['max', -1, 2],
      ['min', 1, -2],
    ]);
    expect(extrema(compileExpression('x^2'), -5, 5).map((e) => e.kind)).toEqual(['min']);
  });

  it('no extremum at an inflection point (x^3) or at an asymptote (1/x^2)', () => {
    expect(extrema(compileExpression('x^3'), -5, 5)).toEqual([]);
    expect(extrema(compileExpression('\\frac{1}{x^2}'), -5, 5)).toEqual([]);
  });

  it('finds vertical asymptotes, but not removable gaps or ordinary roots', () => {
    expect(verticalAsymptotes(compileExpression('\\frac{1}{x-2}'), -5, 5).map(r2)).toEqual([2]);
    expect(verticalAsymptotes(compileExpression('\\frac{1}{x^2}'), -5, 5).map(r2)).toEqual([0]);
    expect(verticalAsymptotes(compileExpression('\\tan x'), -4, 4).map(r2)).toEqual([-1.57, 1.57]);
    expect(verticalAsymptotes(compileExpression('\\frac{\\sin x}{x}'), -5, 5)).toEqual([]);
    expect(verticalAsymptotes(compileExpression('x^2-4'), -5, 5)).toEqual([]);
  });
});
