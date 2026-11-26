import { createStore } from 'zustand/vanilla';
import { newId } from '../../core/document/ids';
import type { BoardDocument } from '../../core/document/types';
import { validateDocument } from '../../core/format/validate';
import type {
  FolderMeta,
  LessonMeta,
  LessonRecord,
  LessonRepository,
  VersionMeta,
} from '../../platform/types';
import { createEmptyDocument, type BoardStore } from '../board/boardStore';

// ניהול השיעור הפתוח: פתיחה, שמירה אוטומטית, גרסאות קודמות.
// העיקרון: המורה לא צריך ללחוץ "שמירה" – כל שינוי נשמר תוך שנייה בערך.

export type SaveStatus = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';

/** שמירה אחרי שקט של... */
const SAVE_IDLE_MS = 800;
/** ...אבל לא יותר מ- (גם בזמן כתיבה רצופה) */
const SAVE_MAX_WAIT_MS = 4000;
/** גרסה קודמת אוטומטית לכל היותר פעם ב- */
const VERSION_EVERY_MS = 10 * 60 * 1000;
/** עדכון תמונה ממוזערת לכל היותר פעם ב- */
const THUMB_EVERY_MS = 20 * 1000;

const LAST_OPENED_KEY = 'lastOpenedLesson';

export interface LessonState {
  status: SaveStatus;
  error: string | null;
  lessonId: string | null;
  title: string;
  lessons: LessonMeta[];
  folders: FolderMeta[];

  init(): Promise<void>;
  /** שיעור חדש (בתיקייה שנבחרה, אם יש) */
  newLesson(folderId?: string | null): Promise<void>;
  createFolder(name: string, parentId: string | null): Promise<FolderMeta>;
  renameFolder(id: string, name: string): Promise<void>;
  /** מעביר תיקייה לתיקייה אחרת. מחזיר false אם זה ייצור לולאה (תיקייה בתוך עצמה). */
  moveFolder(id: string, parentId: string | null): Promise<boolean>;
  deleteFolder(id: string): Promise<void>;
  moveLesson(lessonId: string, folderId: string | null): Promise<void>;
  openLesson(id: string): Promise<void>;
  renameCurrent(title: string): Promise<void>;
  renameLesson(id: string, title: string): Promise<void>;
  duplicateLesson(id: string): Promise<void>;
  deleteLesson(id: string): Promise<void>;
  listVersions(): Promise<VersionMeta[]>;
  restoreVersion(versionId: number): Promise<void>;
  /** פותח מסמך שיובא מקובץ כשיעור חדש */
  importLesson(doc: BoardDocument, title: string): Promise<void>;
  /** שמירה מיידית (למשל לפני סגירת החלון) */
  flush(): Promise<void>;
  refreshList(): Promise<void>;
}

export interface LessonControllerDeps {
  repo: LessonRepository;
  board: BoardStore;
  /** יוצר תמונה ממוזערת לעמוד הראשון (לא חובה – למשל בבדיקות) */
  thumbnail?: (doc: BoardDocument) => Promise<string | undefined>;
  defaultTitle: string;
  defaultFolderName: string;
  copyTitle: (title: string) => string;
  now?: () => number;
}

export type LessonStore = ReturnType<typeof createLessonController>;

export function createLessonController(deps: LessonControllerDeps) {
  const { repo, board } = deps;
  const now = deps.now ?? Date.now;

  let meta: LessonMeta | null = null;
  let loading = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let firstDirtyAt = 0;
  let savingPromise: Promise<void> | null = null;
  let pendingAgain = false;
  let lastVersionAt = 0;
  let lastThumbAt = 0;
  let docDirty = false;

  const store = createStore<LessonState>()((set, get) => {
    const currentRecord = (): LessonRecord | null => {
      if (!meta) return null;
      const s = board.getState();
      return {
        meta: { ...meta, pageCount: s.doc.pages.length },
        doc: s.doc,
        view: { pageId: s.pageId, pageViews: { ...s.pageViews, [s.pageId]: s.view } },
      };
    };

    const doSave = async (): Promise<void> => {
      const record = currentRecord();
      if (!record) return;
      const contentChanged = docDirty;
      docDirty = false;
      if (contentChanged) {
        record.meta.updatedAt = now();
        set({ status: 'saving' });
      }
      try {
        if (contentChanged && deps.thumbnail && now() - lastThumbAt > THUMB_EVERY_MS) {
          lastThumbAt = now();
          record.meta.thumbnail = (await deps.thumbnail(record.doc)) ?? record.meta.thumbnail;
        }
        await repo.save(record);
        meta = record.meta;
        if (contentChanged && now() - lastVersionAt > VERSION_EVERY_MS) {
          lastVersionAt = now();
          await repo.saveVersion(record.meta.id, record.doc, 'auto');
        }
        set({ status: docDirty ? 'dirty' : 'saved', error: null });
      } catch (err) {
        docDirty = docDirty || contentChanged;
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    };

    /** שמירה אחת בכל פעם; אם התבקשה שמירה בזמן שמירה – מבצעים עוד אחת אחריה. */
    const runSave = async (): Promise<void> => {
      clearTimeout(idleTimer);
      idleTimer = undefined;
      firstDirtyAt = 0;
      if (savingPromise) {
        pendingAgain = true;
        return savingPromise;
      }
      savingPromise = (async () => {
        do {
          pendingAgain = false;
          await doSave();
        } while (pendingAgain);
      })();
      try {
        await savingPromise;
      } finally {
        savingPromise = null;
      }
    };

    const schedule = () => {
      const t = now();
      if (!firstDirtyAt) firstDirtyAt = t;
      clearTimeout(idleTimer);
      const wait = Math.min(SAVE_IDLE_MS, Math.max(0, firstDirtyAt + SAVE_MAX_WAIT_MS - t));
      idleTimer = setTimeout(() => void runSave(), wait);
    };

    const loadRecord = async (record: LessonRecord) => {
      loading = true;
      try {
        const doc = validateDocument(record.doc);
        meta = record.meta;
        board.getState().loadDocument(doc, record.view);
        docDirty = false;
        lastVersionAt = now();
        lastThumbAt = 0;
        set({ lessonId: meta.id, title: meta.title, status: 'saved', error: null });
        await repo.setValue(LAST_OPENED_KEY, meta.id);
      } finally {
        loading = false;
      }
    };

    const createLesson = async (
      doc: BoardDocument,
      title: string,
      folderId: string | null = null,
    ) => {
      const t = now();
      const record: LessonRecord = {
        meta: {
          id: newId('l'),
          title,
          createdAt: t,
          updatedAt: t,
          pageCount: doc.pages.length,
          ...(folderId ? { folderId } : {}),
        },
        doc,
        view: { pageId: doc.pages[0]!.id, pageViews: {} },
      };
      await repo.save(record);
      await loadRecord(record);
      // גרסה ראשונה של שיעור חדש/מיובא – כדי שתמיד אפשר יהיה לחזור להתחלה
      await repo.saveVersion(record.meta.id, doc, 'auto');
      await get().refreshList();
    };

    // מעקב אחרי שינויים בלוח
    board.subscribe((s, prev) => {
      if (loading || !meta) return;
      if (s.doc !== prev.doc && s.docEpoch === prev.docEpoch) {
        docDirty = true;
        set({ status: 'dirty' });
        schedule();
      } else if (s.pageId !== prev.pageId || s.view !== prev.view) {
        // מיקום התצוגה נשמר בשקט, בלי לסמן "לא נשמר"
        if (!idleTimer) idleTimer = setTimeout(() => void runSave(), 2000);
      }
    });

    return {
      status: 'loading',
      error: null,
      lessonId: null,
      title: '',
      lessons: [],
      folders: [],

      async init() {
        try {
          const lastId = (await repo.getValue(LAST_OPENED_KEY)) as string | undefined;
          const lessons = await repo.list();
          set({ lessons });
          const target = (lastId && lessons.find((l) => l.id === lastId)) || lessons[0];
          const record = target ? await repo.load(target.id) : null;
          if (!record) {
            await createLesson(board.getState().doc, deps.defaultTitle);
            return;
          }
          try {
            await loadRecord(record);
          } catch {
            // השיעור האחרון פגום: לא נוגעים בו (אולי אפשר לשחזר גרסה),
            // ופותחים שיעור חדש כדי שהמורה יוכל לעבוד מיד – ושום דבר לא יאבד.
            await createLesson(createEmptyDocument(), deps.defaultTitle);
            set({ error: `corrupted:${record.meta.title}` });
          }
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      },

      async newLesson(folderId = null) {
        await get().flush();
        await createLesson(createEmptyDocument(), deps.defaultTitle, folderId);
      },

      async createFolder(name, parentId) {
        const folder: FolderMeta = {
          id: newId('d'),
          name: name.trim() || deps.defaultFolderName,
          parentId,
          createdAt: now(),
        };
        await repo.saveFolder(folder);
        await get().refreshList();
        return folder;
      },

      async renameFolder(id, name) {
        const folder = get().folders.find((f) => f.id === id);
        if (!folder) return;
        await repo.saveFolder({ ...folder, name: name.trim() || folder.name });
        await get().refreshList();
      },

      async moveFolder(id, parentId) {
        const folders = get().folders;
        // אסור להכניס תיקייה לתוך עצמה או לתוך אחת מתתי-התיקיות שלה
        for (let p = parentId; p; p = folders.find((f) => f.id === p)?.parentId ?? null) {
          if (p === id) return false;
        }
        const folder = folders.find((f) => f.id === id);
        if (!folder || folder.parentId === parentId) return true;
        await repo.saveFolder({ ...folder, parentId });
        await get().refreshList();
        return true;
      },

      async deleteFolder(id) {
        await repo.removeFolder(id);
        await get().refreshList();
      },

      async moveLesson(lessonId, folderId) {
        await repo.moveLesson(lessonId, folderId);
        if (meta?.id === lessonId) meta = { ...meta, folderId };
        await get().refreshList();
      },

      async openLesson(id) {
        if (id === meta?.id) return;
        await get().flush();
        const record = await repo.load(id);
        if (!record) throw new Error('Lesson not found');
        await loadRecord(record);
      },

      async renameCurrent(title) {
        if (!meta) return;
        await get().renameLesson(meta.id, title);
      },

      async renameLesson(id, title) {
        const clean = title.trim() || deps.defaultTitle;
        await repo.rename(id, clean);
        if (meta && meta.id === id) {
          meta = { ...meta, title: clean };
          set({ title: clean });
        }
        await get().refreshList();
      },

      async duplicateLesson(id) {
        await get().flush();
        const source = get().lessons.find((l) => l.id === id);
        await repo.duplicate(id, deps.copyTitle(source?.title ?? deps.defaultTitle));
        await get().refreshList();
      },

      async deleteLesson(id) {
        if (meta?.id === id) {
          clearTimeout(idleTimer);
          idleTimer = undefined;
          docDirty = false;
        }
        await repo.remove(id);
        const lessons = await repo.list();
        set({ lessons });
        if (meta?.id === id) {
          meta = null;
          const next = lessons[0] ? await repo.load(lessons[0].id) : null;
          if (next) await loadRecord(next);
          else await createLesson(createEmptyDocument(), deps.defaultTitle);
        }
      },

      async listVersions() {
        if (!meta) return [];
        return repo.listVersions(meta.id);
      },

      async restoreVersion(versionId) {
        if (!meta) return;
        const doc = await repo.loadVersion(versionId);
        if (!doc) throw new Error('Version not found');
        await get().flush();
        // שומרים את המצב הנוכחי כגרסה, כדי שאפשר יהיה לחזור גם מהשחזור.
        await repo.saveVersion(meta.id, board.getState().doc, 'beforeRestore');
        loading = true;
        try {
          board.getState().loadDocument(validateDocument(doc));
        } finally {
          loading = false;
        }
        docDirty = true;
        await runSave();
        await get().refreshList();
      },

      async importLesson(doc, title) {
        await get().flush();
        await createLesson(doc, title);
      },

      async flush() {
        if (!meta) return;
        if (idleTimer || docDirty || savingPromise) await runSave();
      },

      async refreshList() {
        set({ lessons: await repo.list(), folders: await repo.listFolders() });
      },
    };
  });

  return store;
}
