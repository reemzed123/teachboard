import type { BoardDocument, BoardObject, ObjectId, Page, PageId, PageProps } from './types';

// כל שינוי במסמך הוא "פעולה" (Op) – נתון פשוט שאפשר לבצע, להפוך (לביטול)
// ובעתיד גם לשמור ביומן לשחזור אחרי קריסה.

export type ObjectOp =
  | { type: 'add'; pageId: PageId; objects: BoardObject[]; index?: number }
  | { type: 'remove'; pageId: PageId; ids: ObjectId[] }
  | { type: 'replace'; pageId: PageId; objects: BoardObject[] };

export type PageOp =
  | { type: 'addPage'; page: Page; index: number }
  | { type: 'removePage'; pageId: PageId }
  | { type: 'movePage'; pageId: PageId; index: number }
  | { type: 'setPageProps'; pageId: PageId; props: Partial<PageProps> };

export type Op = ObjectOp | PageOp;

function updatePage(doc: BoardDocument, pageId: PageId, fn: (page: Page) => Page): BoardDocument {
  let found = false;
  const pages = doc.pages.map((p) => {
    if (p.id !== pageId) return p;
    found = true;
    return fn(p);
  });
  if (!found) throw new Error(`Page not found: ${pageId}`);
  return { ...doc, pages };
}

/** מבצע פעולה ומחזיר מסמך חדש. המסמך המקורי לא משתנה. */
export function applyOp(doc: BoardDocument, op: Op): BoardDocument {
  switch (op.type) {
    case 'addPage': {
      const pages = doc.pages.slice();
      pages.splice(Math.min(Math.max(op.index, 0), pages.length), 0, op.page);
      return { ...doc, pages };
    }
    case 'removePage': {
      if (!doc.pages.some((p) => p.id === op.pageId))
        throw new Error(`Page not found: ${op.pageId}`);
      if (doc.pages.length <= 1) throw new Error('Cannot remove the last page');
      return { ...doc, pages: doc.pages.filter((p) => p.id !== op.pageId) };
    }
    case 'movePage': {
      const from = doc.pages.findIndex((p) => p.id === op.pageId);
      if (from < 0) throw new Error(`Page not found: ${op.pageId}`);
      const pages = doc.pages.slice();
      const [page] = pages.splice(from, 1);
      pages.splice(Math.min(Math.max(op.index, 0), pages.length), 0, page!);
      return { ...doc, pages };
    }
    case 'setPageProps':
      return updatePage(doc, op.pageId, (page) => ({ ...page, ...op.props }));
    case 'add':
      return updatePage(doc, op.pageId, (page) => {
        const objects = page.objects.slice();
        const index = op.index === undefined ? objects.length : Math.min(op.index, objects.length);
        objects.splice(index, 0, ...op.objects);
        return { ...page, objects };
      });
    case 'remove': {
      const ids = new Set(op.ids);
      return updatePage(doc, op.pageId, (page) => ({
        ...page,
        objects: page.objects.filter((o) => !ids.has(o.id)),
      }));
    }
    case 'replace': {
      const byId = new Map(op.objects.map((o) => [o.id, o]));
      return updatePage(doc, op.pageId, (page) => ({
        ...page,
        objects: page.objects.map((o) => byId.get(o.id) ?? o),
      }));
    }
  }
}

export function applyOps(doc: BoardDocument, ops: readonly Op[]): BoardDocument {
  return ops.reduce(applyOp, doc);
}

export function findPage(doc: BoardDocument, pageId: PageId): Page | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

/**
 * מחשב את הפעולות ההפוכות לרשימת פעולות, לפי מצב המסמך לפני הביצוע.
 * כך כל פעולה ניתנת לביטול בלי שכל כלי יצטרך לכתוב "ביטול" משלו.
 */
export function invertOps(before: BoardDocument, ops: readonly Op[]): Op[] {
  const inverse: Op[] = [];
  let doc = before;
  for (const op of ops) {
    if (op.type === 'addPage') {
      inverse.push({ type: 'removePage', pageId: op.page.id });
      doc = applyOp(doc, op);
      continue;
    }
    const page = findPage(doc, op.pageId);
    if (!page) throw new Error(`Page not found: ${op.pageId}`);
    switch (op.type) {
      case 'removePage':
        inverse.push({ type: 'addPage', page, index: doc.pages.indexOf(page) });
        break;
      case 'movePage':
        inverse.push({ type: 'movePage', pageId: op.pageId, index: doc.pages.indexOf(page) });
        break;
      case 'setPageProps': {
        const before: Partial<PageProps> = {};
        for (const key of Object.keys(op.props) as (keyof PageProps)[]) {
          (before as Record<string, unknown>)[key] = page[key];
        }
        inverse.push({ type: 'setPageProps', pageId: op.pageId, props: before });
        break;
      }
      case 'add':
        inverse.push({ type: 'remove', pageId: op.pageId, ids: op.objects.map((o) => o.id) });
        break;
      case 'remove': {
        // מחזירים כל אובייקט למקום המקורי שלו בסדר השכבות.
        const ids = new Set(op.ids);
        const restore: Op[] = [];
        page.objects.forEach((o, index) => {
          if (ids.has(o.id)) restore.push({ type: 'add', pageId: op.pageId, objects: [o], index });
        });
        inverse.push(...restore.reverse());
        break;
      }
      case 'replace': {
        const ids = new Set(op.objects.map((o) => o.id));
        inverse.push({
          type: 'replace',
          pageId: op.pageId,
          objects: page.objects.filter((o) => ids.has(o.id)),
        });
        break;
      }
    }
    doc = applyOp(doc, op);
  }
  return inverse.reverse();
}
