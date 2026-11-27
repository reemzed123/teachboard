import { describe, expect, it } from 'vitest';
import { compileExpression, findParams, isValidExpression } from '../../src/core/math/parse';
import { snapParam, syncParams, DEFAULT_PARAM } from '../../src/core/math/params';
import { validateDocument } from '../../src/core/format/validate';

describe('graph parameters', () => {
  it('letters become parameters; values come from the sliders', () => {
    expect(findParams('ax^2+bx+c')).toEqual(['a', 'b', 'c']);
    expect(findParams('\\sin(kx)')).toEqual(['k']);
    expect(findParams('x^2+e^x')).toEqual([]);
    expect(compileExpression('ax^2+b', { a: 2, b: 1 })(3)).toBe(19);
    expect(isValidExpression('ax^2')).toBe(true);
    // בלי ערך – לא ניתן לחשב
    expect(() => compileExpression('ax^2')(1)).toThrow();
  });

  it('parameters appear and disappear with the functions; ranges are kept', () => {
    const p1 = syncParams([{ latex: 'ax^2' }], undefined)!;
    expect(p1).toEqual({ a: DEFAULT_PARAM });
    const kept = { a: { value: 3, min: 0, max: 5, step: 1 } };
    expect(syncParams([{ latex: 'ax+b' }], kept)).toEqual({ a: kept.a, b: DEFAULT_PARAM });
    expect(syncParams([{ latex: 'x^2' }], kept)).toBeUndefined();
  });

  it('slider values snap to the step and stay in range', () => {
    const p = { value: 0, min: -2, max: 2, step: 0.5 };
    expect(snapParam(p, 0.7)).toBe(0.5);
    expect(snapParam(p, 9)).toBe(2);
  });

  it('saved parameters are validated', () => {
    const doc = validateDocument({
      version: 1,
      pages: [
        {
          id: 'p',
          layout: 'bounded',
          size: { width: 800, height: 600 },
          background: { pattern: 'none', color: '#ffffff', spacing: 32 },
          objects: [
            {
              id: 'g',
              type: 'graph',
              transform: { x: 0, y: 0, rotation: 0, scale: 1 },
              width: 400,
              height: 300,
              range: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
              grid: true,
              showIntercepts: true,
              showIntersections: true,
              functions: [{ id: 'f', latex: 'ax', color: '#000000', width: 2, visible: true }],
              params: {
                a: { value: 99, min: -1, max: 1, step: 0.1 },
                bad: { value: 1, min: 0, max: 1, step: 0.1 },
                c: { value: 1, min: 5, max: 1, step: 0.1 },
              },
            },
          ],
        },
      ],
    });
    expect((doc.pages[0]!.objects[0] as { params: unknown }).params).toEqual({
      a: { value: 1, min: -1, max: 1, step: 0.1 },
    });
  });
});
