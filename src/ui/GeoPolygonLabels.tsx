import { useRuntime } from '../app/StoreContext';
import { newId } from '../core/document/ids';
import type { GeoElement, GeometryObject } from '../core/document/types';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';

// ביטויים אלגבריים לצלעות ולזוויות של מצולע – תיבה לכל צלע ולכל זווית.

interface Row {
  key: string;
  name: string;
  /** האלמנט הקיים (צלע/זווית), אם יש */
  el: GeoElement | undefined;
  kind: 'side' | 'angle';
  /** קודקודים: לצלע [p,q], לזווית [prev, v, next] */
  pts: string[];
}

export function polygonLabelRows(elements: readonly GeoElement[], poly: GeoElement): Row[] {
  const pts = poly.parents;
  const n = pts.length;
  const label = (id: string) => elements.find((e) => e.id === id)?.style.label ?? '?';
  const same = (a: readonly string[], b: readonly string[]) => a.every((x, i) => x === b[i]);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    rows.push({
      key: `s${i}`,
      name: label(p) + label(q),
      kind: 'side',
      pts: [p, q],
      el: elements.find(
        (e) => e.kind === 'segment' && (same(e.parents, [p, q]) || same(e.parents, [q, p])),
      ),
    });
  }
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const v = pts[i]!;
    const next = pts[(i + 1) % n]!;
    rows.push({
      key: `a${i}`,
      name: label(v),
      kind: 'angle',
      pts: [prev, v, next],
      el: elements.find(
        (e) =>
          e.kind === 'angle' &&
          (same(e.parents, [prev, v, next]) || same(e.parents, [next, v, prev])),
      ),
    });
  }
  return rows;
}

export function GeoPolygonLabels({ obj, poly }: { obj: GeometryObject; poly: GeoElement }) {
  const rt = useRuntime();
  const rows = polygonLabelRows(obj.elements, poly);

  const setText = (row: Row, raw: string) => {
    const text = raw.trim() || undefined;
    if ((row.el?.style.text ?? undefined) === text) return;
    const s = rt.board.getState();
    const current = currentPage(s).objects.find((o) => o.id === obj.id) as
      GeometryObject | undefined;
    if (!current) return;
    const fresh = polygonLabelRows(current.elements, poly).find((r) => r.key === row.key);
    let elements: GeoElement[];
    if (fresh?.el) {
      const id = fresh.el.id;
      elements = current.elements.map((e) =>
        e.id === id ? { ...e, style: { ...e.style, text } } : e,
      );
    } else if (text) {
      // אין עדיין זווית/צלע מוצגת – יוצרים אותה עם הביטוי
      elements = [
        ...current.elements,
        {
          id: newId('e'),
          kind: row.kind === 'side' ? 'segment' : 'angle',
          parents: row.pts,
          style: { color: poly.style.color, width: row.kind === 'side' ? 2 : 1.5, text },
        },
      ];
    } else return;
    s.commit('geoText', [
      { type: 'replace', pageId: s.pageId, objects: [{ ...current, elements }] },
    ]);
  };

  return (
    <fieldset className="tb-field" data-testid="geo-labels">
      <legend>{t('geo.labels')}</legend>
      <p className="tb-help">{t('geo.labelsHelp')}</p>
      {rows.map((row) => (
        <label key={row.key} className="tb-select-inline tb-geo-dim">
          {row.kind === 'side'
            ? t('geo.sideLabel', { name: row.name })
            : t('geo.angleLabel', { name: row.name })}
          <input
            key={`${poly.id}-${row.key}-${row.el?.style.text ?? ''}`}
            className="tb-input tb-input-small"
            data-label-row={row.key}
            defaultValue={row.el?.style.text ?? ''}
            maxLength={40}
            dir="ltr"
            onBlur={(e) => setText(row, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      ))}
    </fieldset>
  );
}
