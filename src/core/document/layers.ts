import type { BoardObject, Page, PageLayer } from './types';

// שכבות בעמוד: השכבה הראשית (בלי מזהה) ושכבות נוספות שאפשר להסתיר.
// שכבה מוסתרת: לא מצוירת, לא נבחרת ולא נמחקת במחק, ולא מיוצאת.

export const MAX_LAYERS = 12;

export function hiddenLayerIds(page: Page): Set<string> {
  return new Set((page.layers ?? []).filter((l) => l.hidden).map((l) => l.id));
}

export function isObjectVisible(o: BoardObject, hidden: ReadonlySet<string>): boolean {
  return !o.layer || !hidden.has(o.layer);
}

/** האובייקטים שנראים בעמוד (בלי שכבות מוסתרות). מחזיר את אותו מערך אם אין הסתרה. */
export function visibleObjects(page: Page): BoardObject[] {
  const hidden = hiddenLayerIds(page);
  if (hidden.size === 0) return page.objects;
  return page.objects.filter((o) => isObjectVisible(o, hidden));
}

/** שכבה פעילה תקפה: קיימת ולא מוסתרת; אחרת – הראשית (null) */
export function effectiveLayer(page: Page, layerId: string | null): string | null {
  if (!layerId) return null;
  const l = page.layers?.find((x) => x.id === layerId);
  return l && !l.hidden ? l.id : null;
}

/** שם ברירת מחדל לשכבה חדשה: "שכבה 2", "שכבה 3"… */
export function nextLayerName(page: Page, base: (n: number) => string): string {
  const names = new Set((page.layers ?? []).map((l) => l.name));
  for (let n = 2; n < 100; n++) if (!names.has(base(n))) return base(n);
  return base((page.layers?.length ?? 0) + 2);
}

export function withLayer(layers: readonly PageLayer[] | undefined, layer: PageLayer): PageLayer[] {
  return [...(layers ?? []), layer];
}
