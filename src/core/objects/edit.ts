import { newId } from '../document/ids';
import type { Op } from '../document/ops';
import type { BoardObject, ObjectId, Page } from '../document/types';

// פעולות עריכה על אובייקטים. כל פונקציה מחזירה "פעולות" (Op) – כך הכול ניתן לביטול.

/** מרחיב בחירה כך שתכלול את כל חברי הקבוצות של האובייקטים שנבחרו. */
export function expandGroups(
  objects: readonly BoardObject[],
  ids: readonly ObjectId[],
): ObjectId[] {
  const selected = new Set(ids);
  const groups = new Set(
    objects.filter((o) => selected.has(o.id) && o.groupId).map((o) => o.groupId!),
  );
  if (groups.size === 0) return [...ids];
  return objects
    .filter((o) => selected.has(o.id) || (o.groupId && groups.has(o.groupId)))
    .map((o) => o.id);
}

/** עותקים עם מזהים חדשים (גם לקבוצות), מוזזים ב-offset. */
export function cloneObjects(
  objects: readonly BoardObject[],
  dx: number,
  dy: number,
): BoardObject[] {
  const groupMap = new Map<string, string>();
  return objects.map((o) => {
    const copy = structuredClone(o) as BoardObject;
    copy.id = newId();
    copy.transform = { ...o.transform, x: o.transform.x + dx, y: o.transform.y + dy };
    if (o.groupId) {
      if (!groupMap.has(o.groupId)) groupMap.set(o.groupId, newId('g'));
      copy.groupId = groupMap.get(o.groupId);
    }
    delete copy.locked;
    return copy;
  });
}

/** האובייקטים לפי מזהים, בסדר השכבות */
export function pick(page: Page, ids: readonly ObjectId[]): BoardObject[] {
  const set = new Set(ids);
  return page.objects.filter((o) => set.has(o.id));
}

export function duplicateOps(
  page: Page,
  ids: readonly ObjectId[],
  offset = 24,
): { ops: Op[]; newIds: ObjectId[] } {
  const copies = cloneObjects(pick(page, ids), offset, offset);
  return {
    ops: copies.length ? [{ type: 'add', pageId: page.id, objects: copies }] : [],
    newIds: copies.map((c) => c.id),
  };
}

export type OrderMove = 'front' | 'back' | 'forward' | 'backward';

/** שינוי סדר שכבות. מחזיר [] אם אין שינוי. */
export function reorderOps(page: Page, ids: readonly ObjectId[], move: OrderMove): Op[] {
  const set = new Set(ids);
  const objs = page.objects;
  const order = objs.map((o) => o.id);
  let next: ObjectId[];
  if (move === 'front' || move === 'back') {
    const sel = order.filter((id) => set.has(id));
    const rest = order.filter((id) => !set.has(id));
    next = move === 'front' ? [...rest, ...sel] : [...sel, ...rest];
  } else {
    next = order.slice();
    if (move === 'forward') {
      for (let i = next.length - 2; i >= 0; i--) {
        if (set.has(next[i]!) && !set.has(next[i + 1]!))
          [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
      }
    } else {
      for (let i = 1; i < next.length; i++) {
        if (set.has(next[i]!) && !set.has(next[i - 1]!))
          [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
      }
    }
  }
  if (next.every((id, i) => id === order[i])) return [];
  // מימוש: מסירים את הנבחרים ומוסיפים כל אחד במקומו החדש (מהנמוך לגבוה)
  const byId = new Map(objs.map((o) => [o.id, o]));
  const ops: Op[] = [
    { type: 'remove', pageId: page.id, ids: [...set].filter((id) => byId.has(id)) },
  ];
  next.forEach((id, index) => {
    if (set.has(id)) ops.push({ type: 'add', pageId: page.id, objects: [byId.get(id)!], index });
  });
  return ops;
}

function replaceWith(
  page: Page,
  ids: readonly ObjectId[],
  fn: (o: BoardObject) => BoardObject,
): Op[] {
  const objs = pick(page, ids);
  return objs.length ? [{ type: 'replace', pageId: page.id, objects: objs.map(fn) }] : [];
}

export function groupOps(page: Page, ids: readonly ObjectId[]): Op[] {
  if (ids.length < 2) return [];
  const groupId = newId('g');
  return replaceWith(page, ids, (o) => ({ ...o, groupId }));
}

export function ungroupOps(page: Page, ids: readonly ObjectId[]): Op[] {
  return replaceWith(
    page,
    pick(page, ids)
      .filter((o) => o.groupId)
      .map((o) => o.id),
    (o) => {
      const copy = { ...o };
      delete copy.groupId;
      return copy;
    },
  );
}

export function lockOps(page: Page, ids: readonly ObjectId[]): Op[] {
  return replaceWith(page, ids, (o) => ({ ...o, locked: true }));
}

export function unlockAllOps(page: Page): Op[] {
  return replaceWith(
    page,
    page.objects.filter((o) => o.locked).map((o) => o.id),
    (o) => {
      const copy = { ...o };
      delete copy.locked;
      return copy;
    },
  );
}
