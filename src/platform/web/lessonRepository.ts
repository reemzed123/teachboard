import Dexie, { type Table } from 'dexie';
import { newId } from '../../core/document/ids';
import type { BoardDocument } from '../../core/document/types';
import type {
  LessonMeta,
  LessonRecord,
  LessonRepository,
  StoredAsset,
  VersionMeta,
} from '../types';

/** כמה גרסאות קודמות שומרים לכל שיעור */
export const MAX_VERSIONS = 30;

interface DocRow {
  id: string;
  doc: BoardDocument;
  view: LessonRecord['view'];
}

interface VersionRow extends Omit<VersionMeta, 'id'> {
  id?: number;
  doc: BoardDocument;
}

class TeachBoardDB extends Dexie {
  lessons!: Table<LessonMeta, string>;
  docs!: Table<DocRow, string>;
  versions!: Table<VersionRow, number>;
  assets!: Table<StoredAsset, string>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor(name: string) {
    super(name);
    // שינוי מבנה בעתיד: מוסיפים this.version(2) עם שדרוג – לא משנים את גרסה 1.
    this.version(1).stores({
      lessons: 'id, updatedAt',
      docs: 'id',
      versions: '++id, lessonId, savedAt',
      assets: 'id',
      kv: 'key',
    });
  }
}

/**
 * אחסון השיעורים בדפדפן (IndexedDB).
 * לכל פרופיל מסד נתונים נפרד – מוכן לעתיד שבו כמה מורים עובדים על אותו מחשב.
 */
export function createWebLessonRepository(profileId = 'default'): LessonRepository {
  const db = new TeachBoardDB(`teachboard-${profileId}`);

  return {
    async list() {
      return db.lessons.orderBy('updatedAt').reverse().toArray();
    },

    async load(id) {
      return db.transaction('r', db.lessons, db.docs, async () => {
        const meta = await db.lessons.get(id);
        const row = await db.docs.get(id);
        if (!meta || !row) return null;
        return { meta, doc: row.doc, view: row.view };
      });
    },

    async save(record) {
      // טרנזקציה אחת: התיאור והתוכן נשמרים יחד, או שלא נשמר דבר.
      await db.transaction('rw', db.lessons, db.docs, async () => {
        await db.lessons.put(record.meta);
        await db.docs.put({ id: record.meta.id, doc: record.doc, view: record.view });
      });
    },

    async rename(id, title) {
      await db.lessons.update(id, { title, updatedAt: Date.now() });
    },

    async duplicate(id, title) {
      return db.transaction('rw', db.lessons, db.docs, async () => {
        const meta = await db.lessons.get(id);
        const row = await db.docs.get(id);
        if (!meta || !row) throw new Error('Lesson not found');
        const now = Date.now();
        const copy: LessonMeta = { ...meta, id: newId('l'), title, createdAt: now, updatedAt: now };
        await db.lessons.put(copy);
        await db.docs.put({ ...row, id: copy.id });
        return copy;
      });
    },

    async remove(id) {
      await db.transaction('rw', db.lessons, db.docs, db.versions, async () => {
        await db.lessons.delete(id);
        await db.docs.delete(id);
        await db.versions.where('lessonId').equals(id).delete();
      });
    },

    async saveVersion(lessonId, doc, reason) {
      await db.transaction('rw', db.versions, async () => {
        await db.versions.add({
          lessonId,
          savedAt: Date.now(),
          pageCount: doc.pages.length,
          reason,
          doc,
        });
        // שומרים רק את הגרסאות האחרונות
        const all = await db.versions.where('lessonId').equals(lessonId).sortBy('savedAt');
        const extra = all.length - MAX_VERSIONS;
        if (extra > 0) await db.versions.bulkDelete(all.slice(0, extra).map((v) => v.id!));
      });
    },

    async listVersions(lessonId) {
      const rows = await db.versions.where('lessonId').equals(lessonId).sortBy('savedAt');
      return rows.reverse().map((r): VersionMeta => ({
        id: r.id!,
        lessonId: r.lessonId,
        savedAt: r.savedAt,
        pageCount: r.pageCount,
        reason: r.reason,
      }));
    },

    async loadVersion(versionId) {
      return (await db.versions.get(versionId))?.doc ?? null;
    },

    async putAsset(asset) {
      await db.assets.put(asset);
    },

    async getAsset(id) {
      return (await db.assets.get(id)) ?? null;
    },

    async getValue(key) {
      return (await db.kv.get(key))?.value;
    },

    async setValue(key, value) {
      await db.kv.put({ key, value });
    },
  };
}
