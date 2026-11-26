import type { BoardDocument } from '../core/document/types';

// הממשק שכל פלטפורמה (דפדפן, Windows) צריכה לממש.
// שאר הקוד מדבר רק עם הממשק הזה, ולכן לא תלוי בפלטפורמה.

export interface SettingsStorage {
  /** מחזיר את המידע השמור, או null אם אין / לא ניתן לקרוא. לעולם לא זורק. */
  load(): unknown;
  /** שומר. מחזיר false אם השמירה נכשלה (למשל אחסון חסום). לעולם לא זורק. */
  save(data: unknown): boolean;
}

// ---------- שיעורים ----------

export interface ViewSnapshot {
  x: number;
  y: number;
  scale: number;
}

export interface LessonMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  /** תמונה ממוזערת של העמוד הראשון (data URL קטן) */
  thumbnail?: string;
  /** התיקייה שבה השיעור נמצא (null / חסר = בראשי) */
  folderId?: string | null;
}

export interface FolderMeta {
  id: string;
  name: string;
  /** תיקיית האב (null = בראשי) */
  parentId: string | null;
  createdAt: number;
}

export interface LessonRecord {
  meta: LessonMeta;
  doc: BoardDocument;
  /** איפה המורה עמד: עמוד נוכחי ותצוגה לכל עמוד */
  view: { pageId: string; pageViews: Record<string, ViewSnapshot> };
}

export interface VersionMeta {
  id: number;
  lessonId: string;
  savedAt: number;
  pageCount: number;
  /** למה נשמרה הגרסה (אוטומטי, לפני שחזור, לפני ייבוא) */
  reason: 'auto' | 'beforeRestore' | 'manual';
}

export interface StoredAsset {
  id: string;
  type: string;
  blob: Blob;
}

/** אחסון שיעורים מקומי. כל פעולה אטומית: או שהיא מצליחה כולה, או שלא משתנה דבר. */
export interface LessonRepository {
  list(): Promise<LessonMeta[]>;
  load(id: string): Promise<LessonRecord | null>;
  save(record: LessonRecord): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  duplicate(id: string, title: string): Promise<LessonMeta>;
  remove(id: string): Promise<void>;

  saveVersion(lessonId: string, doc: BoardDocument, reason: VersionMeta['reason']): Promise<void>;
  listVersions(lessonId: string): Promise<VersionMeta[]>;
  loadVersion(versionId: number): Promise<BoardDocument | null>;

  putAsset(asset: StoredAsset): Promise<void>;
  getAsset(id: string): Promise<StoredAsset | null>;

  listFolders(): Promise<FolderMeta[]>;
  saveFolder(folder: FolderMeta): Promise<void>;
  /** מוחק תיקייה; השיעורים ותתי-התיקיות שבה עוברים לתיקיית האב */
  removeFolder(id: string): Promise<void>;
  moveLesson(lessonId: string, folderId: string | null): Promise<void>;

  getValue(key: string): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
}
