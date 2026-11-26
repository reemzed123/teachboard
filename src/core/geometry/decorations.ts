import { newId } from '../document/ids';
import type { GeoElement, GeoKind, GeoStyle } from '../document/types';
import { nextPointLabel } from './construction';

// "תוספות" למצולע קיים: אלכסונים, תיכונים, חוצי זוויות, גבהים, זוויות ואורכי צלעות.
// כל מה שנוצר מסומן ב-tag "<id המצולע>:<סוג>", כדי שאפשר יהיה להסיר אותו בלחיצה.

export type Decoration = 'diagonals' | 'medians' | 'bisectors' | 'altitudes' | 'angles' | 'sides';

export const DECORATIONS: readonly Decoration[] = [
  'diagonals',
  'medians',
  'bisectors',
  'altitudes',
  'angles',
  'sides',
];

export function decorationTag(polygonId: string, d: Decoration): string {
  return `${polygonId}:${d}`;
}

/** אילו תוספות מתאימות למצולע עם n קודקודים */
export function decorationsFor(n: number): Decoration[] {
  return DECORATIONS.filter((d) => {
    if (d === 'diagonals') return n >= 4;
    if (d === 'medians' || d === 'bisectors' || d === 'altitudes') return n === 3;
    return true;
  });
}

export function hasDecoration(
  elements: readonly GeoElement[],
  polygonId: string,
  d: Decoration,
): boolean {
  const tag = decorationTag(polygonId, d);
  return elements.some((e) => e.style.tag === tag);
}

/** המזהים של כל מה שנוצר עבור התוספת (להסרה) */
export function decorationIds(
  elements: readonly GeoElement[],
  polygonId: string,
  d: Decoration,
): string[] {
  const tag = decorationTag(polygonId, d);
  return elements.filter((e) => e.style.tag === tag).map((e) => e.id);
}

/** בונה את האלמנטים של התוספת (מתווספים לסוף הבנייה) */
export function buildDecoration(
  elements: readonly GeoElement[],
  polygonId: string,
  d: Decoration,
): GeoElement[] {
  const poly = elements.find((e) => e.id === polygonId && e.kind === 'polygon');
  if (!poly) return [];
  const pts = poly.parents;
  const n = pts.length;
  const tag = decorationTag(polygonId, d);
  const base: GeoStyle = { color: poly.style.color, width: 1.8, tag };
  const out: GeoElement[] = [];
  const all = () => [...elements, ...out];
  const mk = (
    kind: GeoKind,
    parents: string[],
    style: Partial<GeoStyle> = {},
    params?: GeoElement['params'],
  ) => {
    const e: GeoElement = { id: newId('e'), kind, parents, style: { ...base, ...style } };
    if (params) e.params = params;
    out.push(e);
    return e;
  };
  const point = (kind: GeoKind, parents: string[], params?: GeoElement['params']) =>
    mk(kind, parents, { label: nextPointLabel(all()) }, params);
  /** הצלע בין שתי נקודות (קיימת, או חדשה ומוסתרת) */
  const side = (p: string, q: string) =>
    all().find(
      (e) =>
        e.kind === 'segment' &&
        ((e.parents[0] === p && e.parents[1] === q) || (e.parents[0] === q && e.parents[1] === p)),
    ) ?? mk('segment', [p, q], { hidden: true });
  const at = (i: number) => pts[((i % n) + n) % n]!;

  switch (d) {
    case 'diagonals':
      for (let i = 0; i < n; i++)
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue; // צלע, לא אלכסון
          mk('segment', [at(i), at(j)], { dash: 'dashed' });
        }
      break;
    case 'medians':
      for (let i = 0; i < 3; i++) {
        const m = point('midpoint', [at(i + 1), at(i + 2)]);
        mk('segment', [at(i), m.id], { dash: 'dashed' });
      }
      break;
    case 'bisectors':
      for (let i = 0; i < 3; i++) {
        const line = mk('angleBisector', [at(i - 1), at(i), at(i + 1)], { hidden: true });
        const s = side(at(i + 1), at(i + 2));
        const x = point('intersection', [line.id, s.id], { index: 0 });
        mk('segment', [at(i), x.id], { dash: 'dashed' });
      }
      break;
    case 'altitudes':
      for (let i = 0; i < 3; i++) {
        const s = side(at(i + 1), at(i + 2));
        const foot = point('foot', [at(i), s.id]);
        mk('segment', [at(i), foot.id], { dash: 'dashed' });
        mk('angle', [at(i), foot.id, at(i + 1)], { showLabel: false, width: 1.5 });
      }
      break;
    case 'angles':
      for (let i = 0; i < n; i++) mk('angle', [at(i - 1), at(i), at(i + 1)], { width: 1.5 });
      break;
    case 'sides':
      for (let i = 0; i < n; i++)
        mk('measure', [side(at(i), at(i + 1)).id], {}, { what: 'length' });
      break;
  }
  return out;
}
