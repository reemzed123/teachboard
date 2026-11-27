import type { GraphFunction, GraphParam } from '../document/types';
import { findParams } from './parse';

// פרמטרים של גרף (a, b…): נוצרים אוטומטית כשכותבים אותם בפונקציה.

export const MAX_PARAMS = 8;

export const DEFAULT_PARAM: GraphParam = { value: 1, min: -10, max: 10, step: 0.1 };

/** הפרמטרים לפי הפונקציות: קיימים נשמרים, חדשים מקבלים ברירת מחדל, שאינם בשימוש – נמחקים */
export function syncParams(
  functions: readonly Pick<GraphFunction, 'latex'>[],
  current: Readonly<Record<string, GraphParam>> | undefined,
): Record<string, GraphParam> | undefined {
  const names = [...new Set(functions.flatMap((f) => findParams(f.latex)))]
    .sort()
    .slice(0, MAX_PARAMS);
  if (!names.length) return undefined;
  const out: Record<string, GraphParam> = {};
  for (const n of names) out[n] = current?.[n] ?? { ...DEFAULT_PARAM };
  return out;
}

/** ערך בתוך הטווח ומעוגל לצעד */
export function snapParam(p: GraphParam, v: number): number {
  const clamped = Math.min(p.max, Math.max(p.min, v));
  const steps = Math.round((clamped - p.min) / p.step);
  return Math.round((p.min + steps * p.step) * 1e9) / 1e9;
}
