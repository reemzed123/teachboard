import { describe, expect, it } from 'vitest';
import { commit, emptyHistory, redo, undo, type DocState } from '../../src/core/document/history';
import { applyOp, invertOps, applyOps } from '../../src/core/document/ops';
import {
  DEFAULT_BACKGROUND,
  DEFAULT_PAGE_SIZE,
  DOCUMENT_VERSION,
  IDENTITY_TRANSFORM,
  type Page,
  type BoardDocument,
  type InkObject,
} from '../../src/core/document/types';

function ink(id: string, x = 0): InkObject {
  return {
    id,
    type: 'ink',
    transform: { ...IDENTITY_TRANSFORM, x },
    style: { kind: 'pen', color: '#000000', width: 4, opacity: 1 },
    points: [0, 0, 0.5, 10, 0, 0.5],
    pressure: false,
  };
}

function page(id: string, objects: InkObject[] = []): Page {
  return {
    id,
    layout: 'bounded',
    size: { ...DEFAULT_PAGE_SIZE },
    background: { ...DEFAULT_BACKGROUND },
    objects,
  };
}

function doc(...objs: InkObject[]): BoardDocument {
  return { version: DOCUMENT_VERSION, pages: [page('p1', objs)] };
}

const ids = (d: BoardDocument) => d.pages[0]!.objects.map((o) => o.id);

describe('ops', () => {
  it('adds, removes and replaces without mutating the original', () => {
    const d0 = doc(ink('a'));
    const d1 = applyOp(d0, { type: 'add', pageId: 'p1', objects: [ink('b')] });
    expect(ids(d0)).toEqual(['a']);
    expect(ids(d1)).toEqual(['a', 'b']);
    const d2 = applyOp(d1, { type: 'remove', pageId: 'p1', ids: ['a'] });
    expect(ids(d2)).toEqual(['b']);
    const d3 = applyOp(d2, { type: 'replace', pageId: 'p1', objects: [ink('b', 50)] });
    expect(d3.pages[0]!.objects[0]!.transform.x).toBe(50);
  });

  it('inverse of remove restores layer order exactly', () => {
    const d0 = doc(ink('a'), ink('b'), ink('c'), ink('d'));
    const ops = [{ type: 'remove' as const, pageId: 'p1', ids: ['b', 'd'] }];
    const inv = invertOps(d0, ops);
    expect(ids(applyOps(applyOps(d0, ops), inv))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('inverse works for a mixed sequence (erase = remove + add pieces)', () => {
    const d0 = doc(ink('a'), ink('b'));
    const ops = [
      { type: 'remove' as const, pageId: 'p1', ids: ['a'] },
      { type: 'add' as const, pageId: 'p1', objects: [ink('a1'), ink('a2')], index: 0 },
      { type: 'replace' as const, pageId: 'p1', objects: [ink('b', 9)] },
    ];
    const d1 = applyOps(d0, ops);
    expect(ids(d1)).toEqual(['a1', 'a2', 'b']);
    expect(applyOps(d1, invertOps(d0, ops))).toEqual(d0);
  });

  it('throws on unknown page', () => {
    expect(() => applyOp(doc(), { type: 'remove', pageId: 'nope', ids: [] })).toThrow();
  });
});

describe('history', () => {
  const start = (): DocState => ({ doc: doc(), history: emptyHistory() });

  it('undo and redo walk back and forth', () => {
    let s = start();
    s = commit(s, 'draw', [{ type: 'add', pageId: 'p1', objects: [ink('a')] }]);
    s = commit(s, 'draw', [{ type: 'add', pageId: 'p1', objects: [ink('b')] }]);
    expect(ids(s.doc)).toEqual(['a', 'b']);
    s = undo(s);
    expect(ids(s.doc)).toEqual(['a']);
    s = undo(s);
    expect(ids(s.doc)).toEqual([]);
    s = undo(s); // אין מה לבטל – לא קורס
    expect(ids(s.doc)).toEqual([]);
    s = redo(s);
    s = redo(s);
    expect(ids(s.doc)).toEqual(['a', 'b']);
  });

  it('a new action clears redo', () => {
    let s = start();
    s = commit(s, 'draw', [{ type: 'add', pageId: 'p1', objects: [ink('a')] }]);
    s = undo(s);
    s = commit(s, 'draw', [{ type: 'add', pageId: 'p1', objects: [ink('b')] }]);
    expect(s.history.future).toHaveLength(0);
    expect(ids(redo(s).doc)).toEqual(['b']);
  });

  it('empty commit does nothing', () => {
    const s = start();
    expect(commit(s, 'nothing', [])).toBe(s);
  });
});

describe('page ops', () => {
  const pages = (d: BoardDocument) => d.pages.map((p) => p.id);
  const three = (): BoardDocument => ({
    version: DOCUMENT_VERSION,
    pages: [page('p1', [ink('a')]), page('p2'), page('p3')],
  });

  it('add, move and remove pages; each is undoable exactly', () => {
    const d0 = three();
    const cases = [
      [{ type: 'addPage' as const, page: page('p4'), index: 1 }],
      [{ type: 'movePage' as const, pageId: 'p1', index: 2 }],
      [{ type: 'removePage' as const, pageId: 'p1' }],
      [
        {
          type: 'setPageProps' as const,
          pageId: 'p2',
          props: {
            layout: 'infinite' as const,
            background: { ...DEFAULT_BACKGROUND, pattern: 'grid' as const },
          },
        },
      ],
    ];
    expect(pages(applyOps(d0, cases[0]!))).toEqual(['p1', 'p4', 'p2', 'p3']);
    expect(pages(applyOps(d0, cases[1]!))).toEqual(['p2', 'p3', 'p1']);
    expect(pages(applyOps(d0, cases[2]!))).toEqual(['p2', 'p3']);
    for (const ops of cases) {
      expect(applyOps(applyOps(d0, ops), invertOps(d0, ops))).toEqual(d0);
    }
  });

  it('removing a page keeps its drawings for undo', () => {
    let s: DocState = { doc: three(), history: emptyHistory() };
    s = commit(s, 'removePage', [{ type: 'removePage', pageId: 'p1' }]);
    s = undo(s);
    expect(s.doc.pages[0]!.objects.map((o) => o.id)).toEqual(['a']);
  });

  it('never removes the last page', () => {
    expect(() => applyOp(doc(), { type: 'removePage', pageId: 'p1' })).toThrow();
  });
});
