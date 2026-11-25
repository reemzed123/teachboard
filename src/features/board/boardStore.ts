import { createStore } from 'zustand/vanilla';
import { commit, emptyHistory, redo, undo, type DocState } from '../../core/document/history';
import { newId } from '../../core/document/ids';
import type { Op } from '../../core/document/ops';
import {
  DOCUMENT_VERSION,
  type BoardDocument,
  type ObjectId,
  type Page,
} from '../../core/document/types';
import type { SettingsStorage } from '../../platform/types';
import { parseToolPrefs, type ToolId, type ToolPrefs } from './toolPrefs';

export interface ViewState {
  /** הזזת הלוח בפיקסלים של המסך */
  x: number;
  y: number;
  /** קנה מידה (1 = 100%) */
  scale: number;
}

export const ZOOM_LIMITS = { min: 0.1, max: 8 } as const;

export interface BoardState extends DocState {
  pageId: string;
  tool: ToolId;
  prefs: ToolPrefs;
  selection: ObjectId[];
  view: ViewState;
  /** האם נקלט עט בהפעלה הנוכחית (משפיע על טיפול במגע אצבע) */
  penDetected: boolean;
  /** האם התקבל מהעט מידע לחץ אמיתי */
  pressureDetected: boolean;

  commit(label: string, ops: Op[]): void;
  undo(): void;
  redo(): void;
  setTool(tool: ToolId): void;
  updatePrefs(fn: (prefs: ToolPrefs) => ToolPrefs): void;
  setSelection(ids: ObjectId[]): void;
  setView(view: ViewState): void;
  markPen(withPressure: boolean): void;
  clearPage(): void;
}

export function createEmptyDocument(): BoardDocument {
  const page: Page = { id: newId('p'), objects: [] };
  return { version: DOCUMENT_VERSION, pages: [page] };
}

function keepExisting(selection: ObjectId[], state: DocState, pageId: string): ObjectId[] {
  if (selection.length === 0) return selection;
  const page = state.doc.pages.find((p) => p.id === pageId);
  const ids = new Set(page?.objects.map((o) => o.id));
  return selection.filter((id) => ids.has(id));
}

export function createBoardStore(prefsStorage: SettingsStorage) {
  const doc = createEmptyDocument();
  return createStore<BoardState>()((set, get) => ({
    doc,
    history: emptyHistory(),
    pageId: doc.pages[0]!.id,
    tool: 'pen',
    prefs: parseToolPrefs(prefsStorage.load()),
    selection: [],
    view: { x: 0, y: 0, scale: 1 },
    penDetected: false,
    pressureDetected: false,

    commit(label, ops) {
      const s = get();
      const next = commit(s, label, ops);
      set({ ...next, selection: keepExisting(s.selection, next, s.pageId) });
    },
    undo() {
      const s = get();
      const next = undo(s);
      set({ ...next, selection: keepExisting(s.selection, next, s.pageId) });
    },
    redo() {
      const s = get();
      const next = redo(s);
      set({ ...next, selection: keepExisting(s.selection, next, s.pageId) });
    },
    setTool(tool) {
      set({ tool, selection: tool === 'select' ? get().selection : [] });
    },
    updatePrefs(fn) {
      const prefs = fn(get().prefs);
      prefsStorage.save(prefs);
      set({ prefs });
    },
    setSelection(ids) {
      set({ selection: ids });
    },
    setView(view) {
      set({ view });
    },
    markPen(withPressure) {
      const s = get();
      if (!s.penDetected || (withPressure && !s.pressureDetected)) {
        set({ penDetected: true, pressureDetected: s.pressureDetected || withPressure });
      }
    },
    clearPage() {
      const s = get();
      const page = s.doc.pages.find((p) => p.id === s.pageId);
      if (!page || page.objects.length === 0) return;
      s.commit('clearPage', [
        { type: 'remove', pageId: s.pageId, ids: page.objects.map((o) => o.id) },
      ]);
    },
  }));
}

export type BoardStore = ReturnType<typeof createBoardStore>;

export function currentPage(s: BoardState): Page {
  return s.doc.pages.find((p) => p.id === s.pageId) ?? s.doc.pages[0]!;
}
