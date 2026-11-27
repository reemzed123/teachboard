import { describe, expect, it } from 'vitest';
import { validateDocument } from '../../src/core/format/validate';
import { numberLineLabelEvery } from '../../src/engine/render/drawProps';
import type { NumberLineObject } from '../../src/core/document/types';

const page = (objects: unknown[]) => ({
  version: 1,
  pages: [
    {
      id: 'p',
      layout: 'bounded',
      size: { width: 800, height: 600 },
      background: { pattern: 'none', color: '#ffffff', spacing: 32 },
      objects,
    },
  ],
});
const T = { x: 0, y: 0, rotation: 0, scale: 1 };

describe('math props', () => {
  it('number line and fraction bars are validated', () => {
    const ok = validateDocument(
      page([
        {
          id: 'n',
          type: 'numberline',
          transform: T,
          from: -5,
          to: 5,
          step: 1,
          width: 500,
          height: 70,
          color: '#000000',
        },
        {
          id: 'f',
          type: 'fractions',
          transform: T,
          denominators: [1, 2, 99, 3.5, 4],
          width: 400,
          rowHeight: 40,
          color: '#000000',
        },
        {
          id: 't',
          type: 'table',
          transform: T,
          rows: [['1', '2']],
          fontSize: 20,
          color: '#000000',
          cellWidth: 40,
          cellHeight: 40,
          header: false,
          dir: 'ltr',
        },
      ]),
    ).pages[0]!.objects;
    expect(ok.map((o) => o.type)).toEqual(['numberline', 'fractions', 'table']);
    expect((ok[1] as { denominators: number[] }).denominators).toEqual([1, 2, 4]);
    expect(ok[2]).toMatchObject({ header: false, dir: 'ltr' });
    // ציר הפוך או עם יותר מדי שנתות – נדחה
    const bad = validateDocument(
      page([
        {
          id: 'a',
          type: 'numberline',
          transform: T,
          from: 5,
          to: -5,
          step: 1,
          width: 500,
          height: 70,
          color: '#000000',
        },
        {
          id: 'b',
          type: 'numberline',
          transform: T,
          from: 0,
          to: 1e5,
          step: 1,
          width: 500,
          height: 70,
          color: '#000000',
        },
      ]),
    ).pages[0]!.objects;
    expect(bad).toEqual([]);
  });

  it('number line labels do not crowd: only every n-th tick is numbered when dense', () => {
    const nl = (to: number, width: number) => ({ from: 0, to, step: 1, width }) as NumberLineObject;
    expect(numberLineLabelEvery(nl(20, 720))).toBe(1);
    expect(numberLineLabelEvery(nl(100, 720))).toBeGreaterThanOrEqual(4);
  });
});
