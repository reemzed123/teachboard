import { describe, expect, it } from 'vitest';
import { FormatError, validateDocument } from '../../src/core/format/validate';
import { createEmptyDocument } from '../../src/features/board/boardStore';
import type { ValidationReport } from '../../src/core/format/validate';

const inkRaw = (id: string) => ({
  id,
  type: 'ink',
  transform: { x: 1, y: 2, rotation: 0, scale: 1 },
  style: { kind: 'pen', color: '#AABBCC', width: 4, opacity: 1 },
  points: [0, 0, 0.5, 10, 10, 0.5],
  pressure: true,
});

function docWith(objects: unknown[]) {
  const d = createEmptyDocument() as unknown as { pages: { objects: unknown[] }[] };
  d.pages[0]!.objects = objects;
  return d;
}

describe('validateDocument', () => {
  it('accepts a valid document and normalizes colors', () => {
    const out = validateDocument(docWith([inkRaw('a')]));
    expect((out.pages[0]!.objects[0] as { style: { color: string } }).style.color).toBe('#aabbcc');
  });

  it('rejects things that are not documents', () => {
    for (const raw of [null, 5, 'x', [], {}, { pages: 'x' }, { version: 1, pages: [] }]) {
      expect(() => validateDocument(raw)).toThrow(FormatError);
    }
  });

  it('refuses documents from a newer version with a clear code', () => {
    try {
      validateDocument({ version: 999, pages: [{}] });
      expect.unreachable();
    } catch (e) {
      expect((e as FormatError).code).toBe('newerVersion');
    }
  });

  it('skips broken or unknown objects instead of crashing', () => {
    const report: ValidationReport = { skippedObjects: 0 };
    const out = validateDocument(
      docWith([
        inkRaw('a'),
        { type: 'script', code: 'alert(1)' },
        { ...inkRaw('b'), points: [0, 0] },
        { ...inkRaw('c'), points: [0, 'x', 0.5] },
        {
          ...inkRaw('d'),
          style: { kind: 'pen', color: 'javascript:alert(1)', width: 4, opacity: 1 },
        },
      ]),
      report,
    );
    expect(out.pages[0]!.objects.map((o) => o.id)).toEqual(['a']);
    expect(report.skippedObjects).toBe(4);
  });

  it('drops unknown fields (nothing unexpected gets through)', () => {
    const raw = docWith([{ ...inkRaw('a'), onload: 'evil()', html: '<script>' }]);
    const obj = validateDocument(raw).pages[0]!.objects[0] as unknown as Record<string, unknown>;
    expect(obj.onload).toBeUndefined();
    expect(obj.html).toBeUndefined();
  });

  it('is not affected by __proto__ tricks', () => {
    const raw = JSON.parse(
      '{"version":1,"pages":[{"id":"p1","__proto__":{"polluted":true},"objects":[]}]}',
    );
    validateDocument(raw);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('fixes duplicate and malformed ids', () => {
    const out = validateDocument(docWith([inkRaw('a'), inkRaw('a'), inkRaw('../../etc')]));
    const ids = out.pages[0]!.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id))).toBe(true);
  });

  it('clamps out-of-range page settings', () => {
    const raw = createEmptyDocument() as unknown as { pages: Record<string, unknown>[] };
    raw.pages[0]!.background = {
      pattern: 'evil',
      color: 'red',
      spacing: 99999,
      imageAssetId: '../x',
    };
    raw.pages[0]!.size = { width: -5, height: 'big' };
    const p = validateDocument(raw).pages[0]!;
    expect(p.background.pattern).toBe('none');
    expect(p.background.color).toBe('#ffffff');
    expect(p.background.spacing).toBe(80);
    expect(p.background.imageAssetId).toBeUndefined();
    expect(p.size).toEqual({ width: 1123, height: 794 });
  });
});

describe('validate shapes and text', () => {
  it('keeps valid lines, arrows and text with groups and locks', () => {
    const out = validateDocument(
      docWith([
        {
          id: 's1',
          type: 'shape',
          kind: 'arrow',
          transform: { x: 1, y: 2, rotation: 30, scale: 2 },
          dx: 10,
          dy: 5,
          style: { color: '#FF0000', width: 3, opacity: 1, dash: 'dashed' },
          arrowStart: true,
          groupId: 'g1',
          locked: true,
        },
        {
          id: 't1',
          type: 'text',
          transform: { x: 0, y: 0, rotation: 0, scale: 1 },
          text: 'שלום\nעולם',
          fontSize: 24,
          color: '#000000',
          dir: 'rtl',
          width: 80,
          height: 62,
          bold: true,
          groupId: 'g1',
        },
      ]),
    );
    const [s, t] = out.pages[0]!.objects as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(s).toMatchObject({ kind: 'arrow', arrowStart: true, groupId: 'g1', locked: true });
    expect((s.style as { dash: string }).dash).toBe('dashed');
    expect(t).toMatchObject({ text: 'שלום\nעולם', bold: true, dir: 'rtl' });
  });

  it('rejects bad shapes/text and strips control characters', () => {
    const report = { skippedObjects: 0 };
    const out = validateDocument(
      docWith([
        {
          id: 'a',
          type: 'shape',
          kind: 'circle',
          dx: 1,
          dy: 1,
          style: { color: '#000000', width: 1, opacity: 1 },
        },
        { id: 'b', type: 'text', text: '', fontSize: 20, color: '#000000', width: 1, height: 1 },
        {
          id: 'c',
          type: 'text',
          text: 'a\u0000b\u0007c',
          fontSize: 20,
          color: '#000000',
          width: 1,
          height: 1,
          groupId: '../x',
        },
      ]),
      report,
    );
    expect(report.skippedObjects).toBe(2);
    const t = out.pages[0]!.objects[0] as { text: string; groupId?: string };
    expect(t.text).toBe('abc');
    expect(t.groupId).toBeUndefined();
  });
});

describe('validate math, graph and table', () => {
  it('keeps valid objects and sanitizes them', () => {
    const report = { skippedObjects: 0 };
    const out = validateDocument(
      docWith([
        {
          id: 'm',
          type: 'math',
          latex: '\\frac{1}{2}',
          color: '#000000',
          fontSize: 32,
          width: 20,
          height: 40,
        },
        {
          id: 'g',
          type: 'graph',
          width: 400,
          height: 300,
          range: { xMin: -5, xMax: 5, yMin: -4, yMax: 4 },
          grid: true,
          showIntercepts: true,
          functions: [
            { id: 'f1', latex: 'x^2', color: '#2563eb', width: 2, visible: true },
            { id: 'f2', latex: 42, color: '#2563eb' },
          ],
        },
        {
          id: 't',
          type: 'table',
          rows: [
            ['x', 'y'],
            ['1', '2'],
          ],
          fontSize: 16,
          color: '#000000',
          cellWidth: 60,
          cellHeight: 30,
        },
        {
          id: 'bad',
          type: 'graph',
          width: 400,
          height: 300,
          range: { xMin: 5, xMax: -5, yMin: 0, yMax: 1 },
        },
      ]),
      report,
    );
    const [m, g, t] = out.pages[0]!.objects as unknown as Record<string, unknown>[];
    expect(m).toMatchObject({ type: 'math', latex: '\\frac{1}{2}' });
    expect((g!.functions as unknown[]).length).toBe(1);
    expect(g).toMatchObject({ showIntercepts: true, showIntersections: false });
    expect(t).toMatchObject({
      rows: [
        ['x', 'y'],
        ['1', '2'],
      ],
    });
    expect(report.skippedObjects).toBe(1);
  });
});

describe('validate geometry constructions', () => {
  it('keeps valid steps and drops steps that refer to missing or later elements', () => {
    const out = validateDocument(
      docWith([
        {
          id: 'g',
          type: 'geometry',
          extent: { x: 0, y: 0, width: 100, height: 100 },
          elements: [
            {
              id: 'A',
              kind: 'point',
              parents: [],
              params: { x: 0, y: 0 },
              style: { color: '#000000', width: 2, label: 'A' },
            },
            {
              id: 'B',
              kind: 'point',
              parents: [],
              params: { x: 10, y: 0 },
              style: { color: '#000000', width: 2 },
            },
            {
              id: 's',
              kind: 'segment',
              parents: ['A', 'B'],
              style: { color: '#000000', width: 2, ticks: 2 },
            },
            { id: 'bad', kind: 'segment', parents: ['A', 'Z'], style: {} },
            { id: 'later', kind: 'midpoint', parents: ['A', 'C'], style: {} },
            { id: 'C', kind: 'point', parents: [], params: { x: 5, y: 5 }, style: {} },
            { id: 'evil', kind: 'script', parents: [], style: {} },
          ],
        },
      ]),
    );
    const g = out.pages[0]!.objects[0] as unknown as {
      elements: { id: string; style: { ticks?: number } }[];
    };
    expect(g.elements.map((e) => e.id)).toEqual(['A', 'B', 's', 'C']);
    expect(g.elements[2]!.style.ticks).toBe(2);
  });
});
