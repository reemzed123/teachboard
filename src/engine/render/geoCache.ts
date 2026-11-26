import type { GeometryObject } from '../../core/document/types';
import type { Solution } from '../../core/geometry/construction';

// פתרונות בנייה גיאומטרית: מחשבים פעם אחת לכל גרסה של האובייקט.
// מנוע החישוב (JSXGraph) נטען רק בפעם הראשונה שצריך אותו.

type Kernel = typeof import('../../features/geometry/kernel');

let kernel: Kernel | null = null;
let loading: Promise<Kernel> | null = null;
const listeners = new Set<() => void>();
const memo = new WeakMap<GeometryObject, Solution>();

export function loadGeometryKernel(): Promise<Kernel> {
  loading ??= import('../../features/geometry/kernel').then((k) => {
    kernel = k;
    for (const l of listeners) l();
    return k;
  });
  return loading;
}

/** הפתרון (אם המנוע כבר נטען). אחרת מתחיל לטעון ומחזיר null – וקורא למאזינים כשמוכן. */
export function getSolution(obj: GeometryObject): Solution | null {
  if (!kernel) {
    void loadGeometryKernel();
    return null;
  }
  let s = memo.get(obj);
  if (!s) {
    s = kernel.solve(obj);
    memo.set(obj, s);
  }
  return s;
}

export async function solveNow(obj: GeometryObject): Promise<Solution> {
  await loadGeometryKernel();
  return getSolution(obj)!;
}

export function onGeometryReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
