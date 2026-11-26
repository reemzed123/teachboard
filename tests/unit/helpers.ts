import 'fake-indexeddb/auto';
import { createAppStore } from '../../src/app/store';
import { AssetCache } from '../../src/features/lessons/assetCache';
import { createLessonController } from '../../src/features/lessons/lessonController';
import { createWebLessonRepository } from '../../src/platform/web/lessonRepository';
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

let runtimeCounter = 0;

export function createTestRuntime(settings: unknown = null): AppRuntime {
  const repo = createWebLessonRepository(`rt-${++runtimeCounter}`);
  const board = createBoardStore(memoryStorage());
  return {
    app: createAppStore(memoryStorage(settings)),
    board,
    repo,
    assets: new AssetCache(repo),
    lessons: createLessonController({
      repo,
      board,
      defaultTitle: 'שיעור ללא שם',
      defaultFolderName: 'תיקייה חדשה',
      copyTitle: (x) => `${x} (עותק)`,
    }),
    engine: null,
  };
}
