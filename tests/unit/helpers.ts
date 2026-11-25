import { createAppStore } from '../../src/app/store';
import type { AppRuntime } from '../../src/app/runtime';
import { createBoardStore } from '../../src/features/board/boardStore';
import type { SettingsStorage } from '../../src/platform/types';

export function memoryStorage(initial: unknown = null): SettingsStorage & { data: unknown } {
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

export function createTestRuntime(settings: unknown = null): AppRuntime {
  return {
    app: createAppStore(memoryStorage(settings)),
    board: createBoardStore(memoryStorage()),
    engine: null,
  };
}
