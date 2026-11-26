import { useBoard, useRuntime } from '../app/StoreContext';
import type { GeoElement, GeometryObject } from '../core/document/types';
import { toWorld } from '../core/geometry/transform';
import { geoLabelBoxes } from '../engine/render/drawGeometry';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';

/** האלמנט שהטקסט שלו נערך: אורך של קטע נערך על הקטע עצמו */
export function labelEditTarget(elements: readonly GeoElement[], el: GeoElement): GeoElement {
  if (el.kind === 'measure' && (el.params?.what ?? 'length') === 'length') {
    const parent = elements.find((e) => e.id === el.parents[0]);
    if (parent?.kind === 'segment') return parent;
  }
  return el;
}

/** תיבת עריכה קטנה במקום התווית (לחיצה כפולה): שם נקודה, או ביטוי כמו x+3 */
export function GeoLabelEditor() {
  const rt = useRuntime();
  const edit = useBoard((s) => s.geoLabelEdit);
  const view = useBoard((s) => s.view);
  const obj = useBoard((s) =>
    edit
      ? (currentPage(s).objects.find((o) => o.id === edit.objectId && o.type === 'geometry') as
          GeometryObject | undefined)
      : undefined,
  );
  if (!edit || !obj) return null;
  const el = obj.elements.find((e) => e.id === edit.elementId);
  const box = geoLabelBoxes
    .get(obj.id)
    ?.find((b) => b.id === edit.elementId && b.kind === edit.kind);
  const center = box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : edit.at;
  if (!el || !center) return null;
  const target = edit.kind === 'letter' ? el : labelEditTarget(obj.elements, el);
  const initial = edit.kind === 'letter' ? (el.style.label ?? '') : (target.style.text ?? '');
  const w = toWorld(obj.transform, center.x, center.y);
  const sx = w.x * view.scale + view.x;
  const sy = w.y * view.scale + view.y;

  const close = () => rt.board.getState().setGeoLabelEdit(null);
  const save = (raw: string) => {
    const value = raw.trim();
    const s = rt.board.getState();
    const current = currentPage(s).objects.find((o) => o.id === obj.id) as
      GeometryObject | undefined;
    close();
    if (!current || value === initial) return;
    s.commit('geoText', [
      {
        type: 'replace',
        pageId: s.pageId,
        objects: [
          {
            ...current,
            elements: current.elements.map((e) => {
              if (e.id !== target.id) return e;
              const style = { ...e.style };
              if (edit.kind === 'letter') {
                if (value) style.label = value.slice(0, 8);
                else delete style.label;
              } else if (value) style.text = value.slice(0, 40);
              else delete style.text;
              return { ...e, style };
            }),
          },
        ],
      },
    ]);
  };

  return (
    <input
      // נוצר מחדש לכל תווית
      key={`${edit.elementId}-${edit.kind}`}
      className="tb-input tb-geo-label-editor"
      data-testid="geo-label-editor"
      aria-label={edit.kind === 'letter' ? t('geo.name') : t('geo.text')}
      dir="ltr"
      autoFocus
      maxLength={edit.kind === 'letter' ? 8 : 40}
      defaultValue={initial}
      placeholder={edit.kind === 'letter' ? 'A' : 'x+3'}
      style={{ left: sx, top: sy }}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') close();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
