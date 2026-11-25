import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../src/app/actions';
import { QUICK_ACTION_IDS } from '../../src/app/actionIds';
import { createAppStore } from '../../src/app/store';
import { DEFAULT_QUICK_ACCESS } from '../../src/core/settings/settings';
import { IDENTITY_TRANSFORM } from '../../src/core/document/types';
import { he } from '../../src/i18n/he';
import { createTestRuntime, memoryStorage } from './helpers';

describe('actions', () => {
  it('every selectable quick action is implemented and has Hebrew text', () => {
    for (const id of QUICK_ACTION_IDS) {
      expect(ACTIONS[id]).toBeDefined();
      expect(he[ACTIONS[id].labelKey]).toBeTruthy();
    }
  });

  it('every default quick action is selectable', () => {
    for (const id of DEFAULT_QUICK_ACCESS) {
      expect(QUICK_ACTION_IDS as readonly string[]).toContain(id);
    }
  });

  it('theme toggle switches and persists', () => {
    const storage = memoryStorage({ theme: 'light' });
    const rt = { ...createTestRuntime(), app: createAppStore(storage) };
    ACTIONS['view.toggleTheme'].run(rt);
    expect(rt.app.getState().settings.theme).toBe('dark');
    expect((storage.data as { theme: string }).theme).toBe('dark');
  });

  it('focus mode closes the open panel', () => {
    const rt = createTestRuntime();
    rt.app.getState().togglePanel('math');
    ACTIONS['view.focusMode'].run(rt);
    expect(rt.app.getState().focusMode).toBe(true);
    expect(rt.app.getState().openPanel).toBeNull();
  });

  it('reports when settings cannot be saved', () => {
    const store = createAppStore({ load: () => null, save: () => false });
    store.getState().setTheme('dark');
    expect(store.getState().settingsSaveFailed).toBe(true);
    expect(store.getState().settings.theme).toBe('dark');
  });

  it('tool actions switch tools and report active state', () => {
    const rt = createTestRuntime();
    ACTIONS['tool.eraser'].run(rt);
    expect(rt.board.getState().tool).toBe('eraser');
    expect(ACTIONS['tool.eraser'].isActive!(rt)).toBe(true);
    expect(ACTIONS['tool.pen'].isActive!(rt)).toBe(false);
  });

  it('undo/redo are disabled when there is nothing to undo/redo', () => {
    const rt = createTestRuntime();
    expect(ACTIONS['edit.undo'].isEnabled!(rt)).toBe(false);
    const s = rt.board.getState();
    s.commit('draw', [
      {
        type: 'add',
        pageId: s.pageId,
        objects: [
          {
            id: 'a',
            type: 'ink',
            transform: IDENTITY_TRANSFORM,
            style: { kind: 'pen', color: '#000000', width: 4, opacity: 1 },
            points: [0, 0, 0.5],
            pressure: false,
          },
        ],
      },
    ]);
    expect(ACTIONS['edit.undo'].isEnabled!(rt)).toBe(true);
    ACTIONS['edit.undo'].run(rt);
    expect(ACTIONS['edit.redo'].isEnabled!(rt)).toBe(true);
  });

  it('delete selection removes selected objects and is undoable', () => {
    const rt = createTestRuntime();
    const s = rt.board.getState();
    const obj = {
      id: 'a',
      type: 'ink' as const,
      transform: IDENTITY_TRANSFORM,
      style: { kind: 'pen' as const, color: '#000000', width: 4, opacity: 1 },
      points: [0, 0, 0.5],
      pressure: false,
    };
    s.commit('draw', [{ type: 'add', pageId: s.pageId, objects: [obj] }]);
    rt.board.getState().setSelection(['a']);
    ACTIONS['edit.deleteSelection'].run(rt);
    const page = () => rt.board.getState().doc.pages[0]!.objects;
    expect(page()).toHaveLength(0);
    expect(rt.board.getState().selection).toEqual([]);
    rt.board.getState().undo();
    expect(page()).toHaveLength(1);
  });
});
