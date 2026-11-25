import { describe, expect, it } from 'vitest';
import { applyOps, invertOps } from '../../src/core/document/ops';
import {
  DOCUMENT_VERSION,
  IDENTITY_TRANSFORM,
  type BoardDocument,
  type BoardObject,
  type Page,
} from '../../src/core/document/types';
import {
  cloneObjects,
  duplicateOps,
  expandGroups,
  groupOps,
  lockOps,
  reorderOps,
  ungroupOps,
  unlockAllOps,
} from '../../src/core/objects/edit';
import { createPage } from '../../src/features/board/boardStore';

const line = (id: string, extra: Partial<BoardObject> = {}): BoardObject =>
  ({
    id,
    type: 'shape',
    kind: 'line',
    transform: { ...IDENTITY_TRANSFORM },
    dx: 10,
    dy: 0,
    style: { color: '#000000', width: 2, opacity: 1, dash: 'solid' },
    ...extra,
  }) as BoardObject;

function setup(objs: BoardObject[]): { doc: BoardDocument; page: Page } {
  const page = { ...createPage(), id: 'p1', objects: objs };
  return { doc: { version: DOCUMENT_VERSION, pages: [page] }, page };
}

const ids = (d: BoardDocument) => d.pages[0]!.objects.map((o) => o.id);

describe('object editing ops', () => {
  it('reorders: front, back, forward, backward – all undoable', () => {
    const { doc, page } = setup(['a', 'b', 'c', 'd'].map((x) => line(x)));
    const run = (sel: string[], move: 'front' | 'back' | 'forward' | 'backward') => {
      const ops = reorderOps(page, sel, move);
      const after = applyOps(doc, ops);
      expect(applyOps(after, invertOps(doc, ops))).toEqual(doc);
      return ids(after);
    };
    expect(run(['a', 'c'], 'front')).toEqual(['b', 'd', 'a', 'c']);
    expect(run(['b', 'd'], 'back')).toEqual(['b', 'd', 'a', 'c']);
    expect(run(['b'], 'forward')).toEqual(['a', 'c', 'b', 'd']);
    expect(run(['c'], 'backward')).toEqual(['a', 'c', 'b', 'd']);
    expect(reorderOps(page, ['d'], 'front')).toEqual([]);
  });

  it('groups: selecting one member selects the whole group; ungroup', () => {
    const { doc, page } = setup(['a', 'b', 'c'].map((x) => line(x)));
    const grouped = applyOps(doc, groupOps(page, ['a', 'c']));
    const gp = grouped.pages[0]!;
    expect(expandGroups(gp.objects, ['a'])).toEqual(['a', 'c']);
    expect(expandGroups(gp.objects, ['b'])).toEqual(['b']);
    const un = applyOps(grouped, ungroupOps(gp, ['a', 'c']));
    expect(un.pages[0]!.objects.every((o) => !o.groupId)).toBe(true);
  });

  it('duplicate makes new ids, offsets, and keeps groups separate from the originals', () => {
    const { doc, page } = setup([line('a', { groupId: 'g1' }), line('b', { groupId: 'g1' })]);
    const { ops, newIds } = duplicateOps(page, ['a', 'b']);
    const after = applyOps(doc, ops);
    const copies = after.pages[0]!.objects.filter((o) => newIds.includes(o.id));
    expect(copies).toHaveLength(2);
    expect(copies[0]!.transform.x).toBe(24);
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe('g1');
  });

  it('lock and unlock all', () => {
    const { doc, page } = setup([line('a'), line('b')]);
    const locked = applyOps(doc, lockOps(page, ['a']));
    expect(locked.pages[0]!.objects[0]!.locked).toBe(true);
    const unlocked = applyOps(locked, unlockAllOps(locked.pages[0]!));
    expect(unlocked.pages[0]!.objects.some((o) => o.locked)).toBe(false);
  });

  it('pasted copies are never locked', () => {
    expect(cloneObjects([line('a', { locked: true })], 0, 0)[0]!.locked).toBeUndefined();
  });
});
