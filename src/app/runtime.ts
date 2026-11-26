import type { BoardEngine } from '../engine/BoardEngine';
import type { BoardStore } from '../features/board/boardStore';
import type { AssetCache } from '../features/lessons/assetCache';
import type { LessonStore } from '../features/lessons/lessonController';
import type { TeachingStore } from '../features/teaching/teachingStore';
import type { LessonRepository } from '../platform/types';
import type { AppStore } from './store';

/** כל מה שפעולה (לחצן או קיצור מקלדת) צריכה כדי לפעול. */
export interface AppRuntime {
  app: AppStore;
  board: BoardStore;
  lessons: LessonStore;
  repo: LessonRepository;
  assets: AssetCache;
  /** כלי הוראה בזמן השיעור (זרקור, כיסוי, טיימר) */
  teaching: TeachingStore;
  /** המנוע קיים רק כשהלוח מוצג */
  engine: BoardEngine | null;
}

/** מחבר/מנתק את מנוע הלוח מהפעולות (נקרא כשהלוח מוצג או מוסר). */
export function attachEngine(rt: AppRuntime, engine: BoardEngine | null): void {
  rt.engine = engine;
}
