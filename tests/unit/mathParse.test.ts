import { describe, expect, it } from 'vitest';
import { compileExpression, MathParseError } from '../../src/core/math/parse';

const at = (src: string, x: number) => compileExpression(src)(x);

describe('math expression parser', () => {
  it.each([
    ['2x+1', 3, 7],
    ['x^2-3x+2', 4, 6],
    ['-x^2', 3, -9],
    ['(x+1)(x-1)', 3, 8],
    ['\\frac{1}{2}x^{2}', 4, 8],
    ['\\frac{x+1}{x-1}', 3, 2],
    ['\\frac12x', 4, 2],
    ['\\frac12', 0, 0.5],
    ['\\frac{1}{4}x', 8, 2],
    ['\\sqrt9', 0, 3],
    ['\\sqrt{x}', 9, 3],
    ['\\sqrt[3]{x}', -8, -2],
    ['x^{\\frac{1}{3}}', -27, -3],
    ['2^x', 3, 8],
    ['e^{x}', 0, 1],
    ['\\ln\\left(x\\right)', Math.E, 1],
    ['\\log x', 100, 2],
    ['\\log_{2}\\left(x\\right)', 8, 3],
    ['\\sin x', Math.PI / 2, 1],
    ['3\\sin 2x', Math.PI / 4, 3],
    ['\\sin^{2}x+\\cos^{2}x', 1.234, 1],
    ['\\left|x-5\\right|', 2, 3],
    ['\\left\\vert x\\right\\vert', -4, 4],
    ['|x|+|x-1|', 0.5, 1],
    ['2\\pi', 0, 2 * Math.PI],
    ['x\\cdot 3', 2, 6],
    ['6\\div 3x', 1, 2],
    ['y=2x', 5, 10],
    ['f(x)=x+1', 1, 2],
    ['sin(x)+sqrt(x)', 4, Math.sin(4) + 2],
    ['\\tan^{-1}x', 1, Math.PI / 4],
    ['x^-1', 4, 0.25],
  ])('%s at x=%s = %s', (src, x, expected) => {
    expect(at(src, x)).toBeCloseTo(expected, 9);
  });

  it('returns NaN outside the domain instead of crashing', () => {
    expect(at('\\sqrt{x}', -1)).toBeNaN();
    expect(at('\\ln x', -1)).toBeNaN();
  });

  it.each(['', '2+', '\\frac{1}', '(x+1', 'y', '\\alert{1}', 'x!', 'a'.repeat(3000)])(
    'rejects %s with a clear error',
    (src) => {
      expect(() => compileExpression(src)).toThrow(MathParseError);
    },
  );

  it('never runs code from the expression', () => {
    expect(() => compileExpression('constructor')).toThrow(MathParseError);
    expect(() => compileExpression('alert(1)')).toThrow(MathParseError);
  });

  it('powers are right-associative: 2^3^2 = 2^9', () => {
    expect(compileExpression('2^3^2')(0)).toBe(512);
    expect(compileExpression('x^2^3')(2)).toBe(256);
    expect(compileExpression('x^-1')(4)).toBe(0.25);
  });

  it('indexed function names on the left side are ignored: f_1(x)=, f_{12}(x)=', () => {
    expect(compileExpression('f_1(x)=x+1')(2)).toBe(3);
    expect(compileExpression('f_{12}\\left(x\\right)=2x')(3)).toBe(6);
    expect(compileExpression('g(x)=x^2')(3)).toBe(9);
  });
});
