import { useRuntime } from '../app/StoreContext';
import type { GeoElement, GeometryObject } from '../core/document/types';
import { removeElements } from '../core/geometry/construction';
import {
  buildDecoration,
  decorationIds,
  decorationsFor,
  hasDecoration,
  type Decoration,
} from '../core/geometry/decorations';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';

/** הצגת אלכסונים, תיכונים, חוצי זוויות, גבהים, זוויות ואורכי צלעות במצולע שנבחר */
export function GeoPolygonDecorations({ obj, poly }: { obj: GeometryObject; poly: GeoElement }) {
  const rt = useRuntime();
  const toggle = (d: Decoration, on: boolean) => {
    const s = rt.board.getState();
    const current = currentPage(s).objects.find((o) => o.id === obj.id) as
      GeometryObject | undefined;
    if (!current) return;
    const elements = on
      ? [...current.elements, ...buildDecoration(current.elements, poly.id, d)]
      : removeElements(current.elements, decorationIds(current.elements, poly.id, d));
    s.commit('geoDecoration', [
      { type: 'replace', pageId: s.pageId, objects: [{ ...current, elements }] },
    ]);
  };
  return (
    <fieldset className="tb-field" data-testid="geo-decorations">
      <legend>{t('geo.show')}</legend>
      {decorationsFor(poly.parents.length).map((d) => (
        <label key={d} className="tb-check">
          <input
            type="checkbox"
            data-deco={d}
            checked={hasDecoration(obj.elements, poly.id, d)}
            onChange={(e) => toggle(d, e.target.checked)}
          />
          {t(`geo.deco.${d}` as MessageKey)}
        </label>
      ))}
    </fieldset>
  );
}
