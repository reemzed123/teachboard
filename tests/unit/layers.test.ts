import { describe, expect, it } from 'vitest';
import { createBoardStore, currentPage } from '../../src/features/board/boardStore';
import { visibleObjects } from '../../src/core/document/layers';
import { validateDocument } from '../../src/core/format/validate';
import { zoneLines } from '../../src/core/background/pattern';
import type { InkObject } from '../../src/core/document/types';
import { memoryStorage } from './helpers';

const ink = (id: string): InkObject => ({
  id,
  type: 'ink',
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  style: { kind: 'pen', color: '#000000', width: 3, opacity: 1 },
  points: [0, 0, 0.5, 10, 10, 0.5],
  pressure: false,
});

function setup() {
  const store = createBoardStore(memoryStorage());
  const add = (id: string) =>
    store
      .getState()
      .commit('ink', [{ type: 'add', pageId: store.getState().pageId, objects: [ink(id)] }]);
  return { store, add, page: () => currentPage(store.getState()) };
}

describe('layers', () => {
  it('new content goes to the active layer; hiding a layer hides only its content', () => {
    const { store, add, page } = setup();
    add('a');
    store.getState().addLayer('תשובות');
    const layerId = page().layers![0]!.id;
    expect(store.getState().activeLayer).toBe(layerId);
    add('b');
    expect(page().objects.find((o) => o.id === 'b')!.layer).toBe(layerId);
    expect(page().objects.find((o) => o.id === 'a')!.layer).toBeUndefined();

    store.getState().setSelection(['a', 'b']);
    store.getState().setLayerHidden(layerId, true);
    expect(visibleObjects(page()).map((o) => o.id)).toEqual(['a']);
    expect(store.getState().selection).toEqual(['a']);
    // לא כותבים לשכבה מוסתרת
    expect(store.getState().activeLayer).toBeNull();
    add('c');
    expect(page().objects.find((o) => o.id === 'c')!.layer).toBeUndefined();
    // ניקוי עמוד לא נוגע בשכבה המוסתרת
    store.getState().clearPage();
    expect(page().objects.map((o) => o.id)).toEqual(['b']);
    // ביטול מחזיר
    store.getState().undo();
    store.getState().undo();
    store.getState().undo();
    expect(page().layers![0]!.hidden).toBeUndefined();
  });

  it('deleting a layer keeps its content (moves it to the main layer); undo restores', () => {
    const { store, add, page } = setup();
    store.getState().addLayer('L');
    add('x');
    const id = page().layers![0]!.id;
    store.getState().deleteLayer(id);
    expect(page().layers).toBeUndefined();
    expect(page().objects[0]!.layer).toBeUndefined();
    store.getState().undo();
    expect(page().layers).toHaveLength(1);
    expect(page().objects[0]!.layer).toBe(id);
  });

  it('move selected objects between layers; rename', () => {
    const { store, add, page } = setup();
    add('a');
    store.getState().addLayer('L');
    const id = page().layers![0]!.id;
    store.getState().setSelection(['a']);
    store.getState().moveSelectionToLayer(id);
    expect(page().objects[0]!.layer).toBe(id);
    store.getState().moveSelectionToLayer(null);
    expect(page().objects[0]!.layer).toBeUndefined();
    store.getState().renameLayer(id, '  סיכום  ');
    expect(page().layers![0]!.name).toBe('סיכום');
  });

  it('validation: unknown layer → main layer; zones only 1–4', () => {
    const doc = validateDocument({
      version: 1,
      pages: [
        {
          id: 'p1',
          layout: 'bounded',
          size: { width: 400, height: 300 },
          background: {
            pattern: 'none',
            color: '#ffffff',
            spacing: 32,
            zones: { cols: 9, rows: 2 },
          },
          layers: [
            { id: 'l1', name: 'A', hidden: true },
            { id: 'bad id!', name: 'x' },
          ],
          objects: [
            { ...ink('o1'), layer: 'l1' },
            { ...ink('o2'), layer: 'nope' },
          ],
        },
      ],
    });
    const p = doc.pages[0]!;
    expect(p.layers).toEqual([{ id: 'l1', name: 'A', hidden: true }]);
    expect(p.objects.map((o) => o.layer)).toEqual(['l1', undefined]);
    // ערך מחוץ לטווח נדחה (עמודה אחת)
    expect(p.background.zones).toEqual({ cols: 1, rows: 2 });
    expect(zoneLines(p)).toHaveLength(1);
    expect(zoneLines({ ...p, layout: 'infinite' })).toHaveLength(0);
  });
});
