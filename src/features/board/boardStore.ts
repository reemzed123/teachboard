import { createStore } from 'zustand/vanilla';
import { commit, emptyHistory, redo, undo, type DocState } from '../../core/document/history';
import { newId } from '../../core/document/ids';
import type { Op } from '../../core/document/ops';
import {
  DEFAULT_BACKGROUND,
  DEFAULT_PAGE_SIZE,
  DOCUMENT_VERSION,
  type BoardDocument,
  type BoardObject,
  type ObjectId,
  type Page,
  type PageProps,
  type PageBackground,
  type PageLayer,
} from '../../core/document/types';
import { effectiveLayer, MAX_LAYERS, visibleObjects, withLayer } from '../../core/document/layers';
import type { SettingsStorage } from '../../platform/types';
import { parseToolPrefs, type ToolId, type ToolPrefs } from './toolPrefs';
import {
  cloneObjects,
  duplicateOps,
  groupOps,
  lockOps,
  pick,
  reorderOps,
  ungroupOps,
  unlockAllOps,
  type OrderMove,
} from '../../core/objects/edit';

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

  /** השכבה שאליה נכנס תוכן חדש בעמוד הנוכחי (null = הראשית). לא נשמר בשיעור. */
  activeLayer: string | null;
  setActiveLayer(id: string | null): void;
  addLayer(name: string): void;
  renameLayer(id: string, name: string): void;
  setLayerHidden(id: string, hidden: boolean): void;
  /** מחיקת שכבה: התוכן שלה עובר לשכבה הראשית (לא נמחק) */
  deleteLayer(id: string): void;
  moveSelectionToLayer(id: string | null): void;

  /** עולה בכל טעינת שיעור (כדי שהמנוע יידע לאפס תצוגה) */
  docEpoch: number;
  /** התצוגה האחרונה בכל עמוד (כדי לחזור לאותו מקום) */
  pageViews: Record<string, ViewState>;
  goToPage(pageId: string): void;
  addPage(): void;
  duplicatePage(pageId: string): void;
  deletePage(pageId: string): void;
  movePage(pageId: string, index: number): void;
  setPageProps(props: Partial<PageProps>): void;
  /** עריכת טקסט פעילה: אובייקט קיים (id) או חדש במיקום (x, y) */
  textEdit: { id: string | null; x: number; y: number } | null;
  startTextEdit(edit: { id: string | null; x: number; y: number }): void;
  endTextEdit(): void;

  /** אלמנטים נבחרים בתוך בנייה גיאומטרית (לעריכת מאפיינים) */
  geoSelection: { objectId: string; ids: string[] } | null;
  setGeoSelection(sel: { objectId: string; ids: string[] } | null): void;
  /** קלט ראשון שכבר נבחר לכלי הגיאומטריה (למשל מעגל מהסרגל הקופץ) */
  geoPrefill: string | null;
  setGeoPrefill(id: string | null): void;

  /** עורך הנוסחאות: נוסחה קיימת (id) או חדשה (null) */
  formulaEdit: { id: string | null } | null;
  openFormula(id: string | null): void;
  closeFormula(): void;
  /** בקשה מהלוח לפתוח חלונית (למשל לחיצה כפולה על גרף) */
  panelRequest: string | null;
  requestPanel(panel: string | null): void;

  /** לוח העתקה פנימי (גם בין עמודים) */
  clipboard: BoardObject[] | null;
  pasteCount: number;
  copySelection(): void;
  cutSelection(): void;
  paste(): void;
  duplicateSelection(): void;
  reorderSelection(move: OrderMove): void;
  groupSelection(): void;
  ungroupSelection(): void;
  lockSelection(): void;
  unlockSelection(): void;
  unlockAll(): void;
  /** מחיקת הבחירה (אובייקטים נעולים לא נמחקים) */
  deleteSelection(): void;

  /** טוען שיעור (מחליף את המסמך ומאפס את ההיסטוריה) */
  loadDocument(
    doc: BoardDocument,
    opts?: { pageId?: string; pageViews?: Record<string, ViewState> },
  ): void;
}

export function createPage(base?: Partial<PageProps>): Page {
  return {
    id: newId('p'),
    layout: base?.layout ?? 'bounded',
    size: base?.size ?? { ...DEFAULT_PAGE_SIZE },
    background: base?.background ?? { ...DEFAULT_BACKGROUND },
    objects: [],
  };
}

/** פעולות שבהן אובייקט חדש שייך לשכבה שלו (לא לשכבה הפעילה) */
const KEEP_LAYER_LABELS = new Set(['erase', 'duplicate', 'duplicatePage', 'debug']);

/** אובייקטים חדשים נכנסים לשכבה הפעילה (הדבקה – תמיד לשכבה הפעילה) */
function withActiveLayer(s: BoardState, label: string, ops: Op[]): Op[] {
  if (KEEP_LAYER_LABELS.has(label)) return ops;
  const page = currentPage(s);
  const layer = effectiveLayer(page, s.activeLayer);
  return ops.map((op) => {
    if (op.type !== 'add' || op.pageId !== page.id) return op;
    return {
      ...op,
      objects: op.objects.map((o) => {
        if (label !== 'paste' && o.layer !== undefined) return o;
        const copy = { ...o };
        if (layer) copy.layer = layer;
        else delete copy.layer;
        return copy;
      }),
    };
  });
}

/** רקע לעמוד חדש "כמו הנוכחי" – בלי עמוד ה-PDF (עמוד חדש הוא דף ריק) */
function blankBackground(bg: PageBackground): PageBackground {
  const copy = structuredClone(bg);
  delete copy.pdf;
  return copy;
}

export function createEmptyDocument(): BoardDocument {
  return { version: DOCUMENT_VERSION, pages: [createPage()] };
}

/** אם העמוד הנוכחי כבר לא קיים (למשל אחרי ביטול) – עוברים לעמוד קיים. */
function validPageId(doc: BoardDocument, pageId: string, fallbackIndex = 0): string {
  if (doc.pages.some((p) => p.id === pageId)) return pageId;
  return doc.pages[Math.min(fallbackIndex, doc.pages.length - 1)]!.id;
}

/** עותק של עמוד עם מזהים חדשים לעמוד ולכל האובייקטים. */
export function clonePage(page: Page): Page {
  return {
    ...structuredClone(page),
    id: newId('p'),
    objects: page.objects.map((o) => ({ ...structuredClone(o), id: newId() })),
  };
}

function keepExisting(selection: ObjectId[], state: DocState, pageId: string): ObjectId[] {
  if (selection.length === 0) return selection;
  const page = state.doc.pages.find((p) => p.id === pageId);
  const ids = new Set(page?.objects.map((o) => o.id));
  return selection.filter((id) => ids.has(id));
}

export function createBoardStore(prefsStorage: SettingsStorage) {
  const doc = createEmptyDocument();
  return createStore<BoardState>()((set, get) => {
    const apply = (next: DocState) => {
      const s = get();
      const index = s.doc.pages.findIndex((p) => p.id === s.pageId);
      const pageId = validPageId(next.doc, s.pageId, Math.max(0, index));
      set({
        ...next,
        pageId,
        selection: pageId === s.pageId ? keepExisting(s.selection, next, pageId) : [],
      });
    };
    return {
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
        apply(commit(get(), label, withActiveLayer(get(), label, ops)));
      },
      undo() {
        apply(undo(get()));
      },
      redo() {
        apply(redo(get()));
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
        // רק מה שגלוי – שכבות מוסתרות לא נמחקות
        const ids = page ? visibleObjects(page).map((o) => o.id) : [];
        if (ids.length === 0) return;
        s.commit('clearPage', [{ type: 'remove', pageId: s.pageId, ids }]);
      },

      activeLayer: null,
      setActiveLayer(id) {
        set({ activeLayer: effectiveLayer(currentPage(get()), id) });
      },
      addLayer(name) {
        const s = get();
        const page = currentPage(s);
        if ((page.layers?.length ?? 0) >= MAX_LAYERS) return;
        const layer: PageLayer = { id: newId('l'), name: name.slice(0, 40) };
        s.commit('addLayer', [
          {
            type: 'setPageProps',
            pageId: s.pageId,
            props: { layers: withLayer(page.layers, layer) },
          },
        ]);
        set({ activeLayer: layer.id });
      },
      renameLayer(id, name) {
        const s = get();
        const page = currentPage(s);
        const clean = name.trim().slice(0, 40);
        if (!clean || !page.layers?.some((l) => l.id === id)) return;
        s.commit('renameLayer', [
          {
            type: 'setPageProps',
            pageId: s.pageId,
            props: { layers: page.layers.map((l) => (l.id === id ? { ...l, name: clean } : l)) },
          },
        ]);
      },
      setLayerHidden(id, hidden) {
        const s = get();
        const page = currentPage(s);
        if (!page.layers?.some((l) => l.id === id)) return;
        s.commit('layerVisibility', [
          {
            type: 'setPageProps',
            pageId: s.pageId,
            props: {
              layers: page.layers.map((l) => {
                if (l.id !== id) return l;
                const next = { ...l };
                if (hidden) next.hidden = true;
                else delete next.hidden;
                return next;
              }),
            },
          },
        ]);
        const after = get();
        // שכבה שהוסתרה: לא כותבים אליה, ומה שנבחר בה – יוצא מהבחירה
        const hiddenIds = new Set(
          currentPage(after)
            .objects.filter((o) => o.layer === id)
            .map((o) => o.id),
        );
        set({
          activeLayer: effectiveLayer(currentPage(after), after.activeLayer),
          selection: hidden ? after.selection.filter((x) => !hiddenIds.has(x)) : after.selection,
        });
      },
      deleteLayer(id) {
        const s = get();
        const page = currentPage(s);
        if (!page.layers?.some((l) => l.id === id)) return;
        const moved = page.objects
          .filter((o) => o.layer === id)
          .map((o) => {
            const copy = { ...o };
            delete copy.layer;
            return copy;
          });
        const layers = page.layers.filter((l) => l.id !== id);
        s.commit('deleteLayer', [
          ...(moved.length ? [{ type: 'replace' as const, pageId: s.pageId, objects: moved }] : []),
          {
            type: 'setPageProps',
            pageId: s.pageId,
            props: { layers: layers.length ? layers : undefined },
          },
        ]);
        if (get().activeLayer === id) set({ activeLayer: null });
      },
      moveSelectionToLayer(id) {
        const s = get();
        const page = currentPage(s);
        const target = id && page.layers?.some((l) => l.id === id) ? id : null;
        const ids = new Set(s.selection);
        const changed = page.objects
          .filter((o) => ids.has(o.id) && (o.layer ?? null) !== target)
          .map((o) => {
            const copy = { ...o };
            if (target) copy.layer = target;
            else delete copy.layer;
            return copy;
          });
        if (changed.length)
          s.commit('moveToLayer', [{ type: 'replace', pageId: s.pageId, objects: changed }]);
        if (target && page.layers?.find((l) => l.id === target)?.hidden) set({ selection: [] });
      },

      pageViews: {},
      docEpoch: 0,

      textEdit: null,
      startTextEdit(edit) {
        set({ textEdit: edit, selection: [] });
      },
      endTextEdit() {
        set({ textEdit: null });
      },

      geoPrefill: null,
      setGeoPrefill(id) {
        set({ geoPrefill: id });
      },
      geoSelection: null,
      setGeoSelection(sel) {
        set({ geoSelection: sel });
      },

      formulaEdit: null,
      openFormula(id) {
        set({ formulaEdit: { id } });
      },
      closeFormula() {
        set({ formulaEdit: null });
      },
      panelRequest: null,
      requestPanel(panel) {
        set({ panelRequest: panel });
      },

      clipboard: null,
      pasteCount: 0,
      copySelection() {
        const s = get();
        const objs = pick(currentPage(s), s.selection);
        if (objs.length) set({ clipboard: structuredClone(objs), pasteCount: 0 });
      },
      cutSelection() {
        const s = get();
        const ids = new Set(s.selection);
        const removable = currentPage(s)
          .objects.filter((o) => ids.has(o.id) && !o.locked)
          .map((o) => o.id);
        if (removable.length === 0) return;
        s.copySelection();
        s.commit('cut', [{ type: 'remove', pageId: s.pageId, ids: removable }]);
      },
      paste() {
        const s = get();
        if (!s.clipboard?.length) return;
        // באותו עמוד – כל הדבקה מוזזת עוד קצת כדי שיראו את העותק; בעמוד אחר – באותו מקום.
        const samePage = currentPage(s).objects.some((o) =>
          s.clipboard!.some((c) => c.id === o.id),
        );
        const n = s.pasteCount + 1;
        const offset = samePage ? 24 * n : 0;
        const copies = cloneObjects(s.clipboard, offset, offset);
        s.commit('paste', [{ type: 'add', pageId: s.pageId, objects: copies }]);
        set({ pasteCount: n, tool: 'select', selection: copies.map((c) => c.id) });
      },
      duplicateSelection() {
        const s = get();
        const { ops, newIds } = duplicateOps(currentPage(s), s.selection);
        if (!ops.length) return;
        s.commit('duplicate', ops);
        set({ selection: newIds });
      },
      reorderSelection(move) {
        const s = get();
        const ops = reorderOps(currentPage(s), s.selection, move);
        if (ops.length) s.commit('reorder', ops);
      },
      groupSelection() {
        const s = get();
        const ops = groupOps(currentPage(s), s.selection);
        if (ops.length) s.commit('group', ops);
      },
      ungroupSelection() {
        const s = get();
        const ops = ungroupOps(currentPage(s), s.selection);
        if (ops.length) s.commit('ungroup', ops);
      },
      lockSelection() {
        const s = get();
        const ops = lockOps(currentPage(s), s.selection);
        if (!ops.length) return;
        s.commit('lock', ops);
        set({ selection: [] });
      },
      unlockSelection() {
        const s = get();
        const ids = new Set(s.selection);
        const objs = currentPage(s).objects.filter((o) => ids.has(o.id) && o.locked);
        if (!objs.length) return;
        s.commit('unlock', [
          {
            type: 'replace',
            pageId: s.pageId,
            objects: objs.map((o) => {
              const copy = { ...o };
              delete copy.locked;
              return copy;
            }),
          },
        ]);
      },
      deleteSelection() {
        const s = get();
        const ids = new Set(s.selection);
        const removable = currentPage(s)
          .objects.filter((o) => ids.has(o.id) && !o.locked)
          .map((o) => o.id);
        if (removable.length)
          s.commit('delete', [{ type: 'remove', pageId: s.pageId, ids: removable }]);
      },
      unlockAll() {
        const s = get();
        const ops = unlockAllOps(currentPage(s));
        if (ops.length) s.commit('unlock', ops);
      },
      goToPage(pageId) {
        const s = get();
        if (pageId === s.pageId || !s.doc.pages.some((p) => p.id === pageId)) return;
        set({
          pageId,
          selection: [],
          activeLayer: null,
          pageViews: { ...s.pageViews, [s.pageId]: s.view },
        });
      },
      addPage() {
        const s = get();
        const current = currentPage(s);
        // עמוד חדש מקבל את אותו סוג ורקע כמו העמוד הנוכחי.
        const page = createPage({
          layout: current.layout,
          size: current.size,
          background: blankBackground(current.background),
        });
        const index = s.doc.pages.indexOf(current) + 1;
        s.commit('addPage', [{ type: 'addPage', page, index }]);
        get().goToPage(page.id);
      },
      duplicatePage(pageId) {
        const s = get();
        const index = s.doc.pages.findIndex((p) => p.id === pageId);
        if (index < 0) return;
        const copy = clonePage(s.doc.pages[index]!);
        s.commit('duplicatePage', [{ type: 'addPage', page: copy, index: index + 1 }]);
        get().goToPage(copy.id);
      },
      deletePage(pageId) {
        const s = get();
        if (s.doc.pages.length <= 1) return;
        const index = s.doc.pages.findIndex((p) => p.id === pageId);
        if (index < 0) return;
        if (pageId === s.pageId) {
          const neighbor = s.doc.pages[index + 1] ?? s.doc.pages[index - 1]!;
          s.goToPage(neighbor.id);
        }
        get().commit('deletePage', [{ type: 'removePage', pageId }]);
      },
      movePage(pageId, index) {
        const s = get();
        const from = s.doc.pages.findIndex((p) => p.id === pageId);
        if (from < 0 || from === index || index < 0 || index >= s.doc.pages.length) return;
        s.commit('movePage', [{ type: 'movePage', pageId, index }]);
      },
      setPageProps(props) {
        const s = get();
        s.commit('pageProps', [{ type: 'setPageProps', pageId: s.pageId, props }]);
      },
      loadDocument(doc, opts) {
        const pageId = validPageId(doc, opts?.pageId ?? doc.pages[0]!.id);
        set({
          doc,
          history: emptyHistory(),
          pageId,
          selection: [],
          activeLayer: null,
          pageViews: opts?.pageViews ?? {},
        });
      },
    };
  });
}

export type BoardStore = ReturnType<typeof createBoardStore>;

export function currentPage(s: BoardState): Page {
  return s.doc.pages.find((p) => p.id === s.pageId) ?? s.doc.pages[0]!;
}
