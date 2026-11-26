import { useBoard, useRuntime } from '../app/StoreContext';
import type { GeometryObject } from '../core/document/types';
import { toWorld } from '../core/geometry/transform';
import { CIRCLE_TOOLS, type GeoToolId } from '../core/geometry/tools';
import { getSolution } from '../engine/render/geoCache';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';
import { GeoToolIcon } from './GeoToolIcon';

const CIRCLE_KINDS = new Set(['circle', 'circleR', 'circle3', 'arc']);

/**
 * סרגל שקופץ ליד מעגל שנבחר (בכלי "בחירה והזזה"):
 * רדיוס, מיתר, זווית מרכזית, זווית היקפית ומשיק – המעגל כבר נבחר, נשאר לבחור נקודות.
 */
export function GeoCircleBar() {
  const rt = useRuntime();
  const tool = useBoard((s) => s.tool);
  const geoTool = useBoard((s) => s.prefs.geo.tool);
  const sel = useBoard((s) => s.geoSelection);
  const view = useBoard((s) => s.view);
  const obj = useBoard((s) =>
    sel
      ? (currentPage(s).objects.find((o) => o.id === sel.objectId && o.type === 'geometry') as
          GeometryObject | undefined)
      : undefined,
  );
  if (tool !== 'geometry' || geoTool !== 'move' || !obj || sel?.ids.length !== 1) return null;
  const el = obj.elements.find((e) => e.id === sel.ids[0]);
  if (!el || !CIRCLE_KINDS.has(el.kind)) return null;
  const s = getSolution(obj)?.get(el.id);
  if (!s || (s.t !== 'circ' && s.t !== 'arc')) return null;

  // מעל המעגל (ואם אין מקום – מתחתיו)
  const top = toWorld(obj.transform, s.cx, s.cy - s.r);
  const bottom = toWorld(obj.transform, s.cx, s.cy + s.r);
  const sx = top.x * view.scale + view.x;
  const ty = top.y * view.scale + view.y;
  const by = bottom.y * view.scale + view.y;
  const above = ty - 64 > 8;

  const pick = (id: GeoToolId) => {
    const st = rt.board.getState();
    st.updatePrefs((p) => ({ ...p, geo: { ...p.geo, tool: id } }));
    st.setGeoPrefill(el.id);
  };

  return (
    <div
      className="tb-selection-bar tb-geo-circle-bar"
      role="toolbar"
      aria-label={t('geo.circleBar')}
      data-testid="geo-circle-bar"
      style={{ left: sx, top: above ? ty - 64 : by + 14 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {CIRCLE_TOOLS.map((id) => (
        <button
          key={id}
          type="button"
          className="tb-geo-bar-btn"
          data-circle-tool={id}
          title={t(`geo.tool.${id}` as MessageKey)}
          aria-label={t(`geo.tool.${id}` as MessageKey)}
          onClick={() => pick(id)}
        >
          <GeoToolIcon tool={id} size={26} />
          <span>{t(`geo.tool.${id}` as MessageKey)}</span>
        </button>
      ))}
    </div>
  );
}
