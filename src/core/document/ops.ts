import type { BoardDocument, BoardObject, ObjectId, Page, PageId } from './types';

// כל שינוי במסמך הוא "פעולה" (Op) – נתון פשוט שאפשר לבצע, להפוך (לביטול)
// ובעתיד גם לשמור ביומן לשחזור אחרי קריסה.

export type Op =
  | { type: 'add'; pageId: PageId; objects: BoardObject[]; index?: number }
  | { type: 'remove'; pageId: PageId; ids: ObjectId[] }
  | { type: 'replace'; pageId: PageId; objects: BoardObject[] };

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
    const page = findPage(doc, op.pageId);
    if (!page) throw new Error(`Page not found: ${op.pageId}`);
    switch (op.type) {
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
