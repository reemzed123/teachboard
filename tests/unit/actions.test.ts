import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../src/app/actions';
import { QUICK_ACTION_IDS } from '../../src/app/actionIds';
import { createAppStore } from '../../src/app/store';
import { DEFAULT_QUICK_ACCESS } from '../../src/core/settings/settings';
import { he } from '../../src/i18n/he';
import type { SettingsStorage } from '../../src/platform/types';

function memoryStorage(initial: unknown = null): SettingsStorage & { data: unknown } {
  return {
    data: initial,
    load() {
      return this.data;
    },
    save(d) {
      this.data = d;
      return true;
    },
  };
}

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
    const store = createAppStore(storage);
    ACTIONS['view.toggleTheme'].run(store);
    expect(store.getState().settings.theme).toBe('dark');
    expect((storage.data as { theme: string }).theme).toBe('dark');
  });

  it('focus mode closes the open panel', () => {
    const store = createAppStore(memoryStorage());
    store.getState().togglePanel('math');
    ACTIONS['view.focusMode'].run(store);
    expect(store.getState().focusMode).toBe(true);
    expect(store.getState().openPanel).toBeNull();
  });

  it('reports when settings cannot be saved', () => {
    const store = createAppStore({ load: () => null, save: () => false });
    store.getState().setTheme('dark');
    expect(store.getState().settingsSaveFailed).toBe(true);
    expect(store.getState().settings.theme).toBe('dark');
  });
});
