import { useBoard, useRuntime } from '../app/StoreContext';
import type { GeoElement, GeometryObject, LineDash } from '../core/document/types';
import { POINT_KINDS, removeElements, withDependents } from '../core/geometry/construction';
import type { GeoToolId } from '../core/geometry/tools';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';
import { SidePanel } from './SidePanel';
import { GeoToolIcon } from './GeoToolIcon';

const GROUPS: { key: MessageKey; tools: GeoToolId[] }[] = [
  {
    key: 'geo.group.basic',
    tools: ['move', 'point', 'segment', 'line', 'ray', 'polygon', 'regularPolygon'],
  },
  { key: 'geo.group.curves', tools: ['circle', 'circleR', 'circle3', 'arc', 'ellipse'] },
  {
    key: 'geo.group.construct',
    tools: [
      'midpoint',
      'intersection',
      'perpendicular',
      'parallel',
      'perpBisector',
      'angleBisector',
      'median',
      'altitude',
      'tangent',
    ],
  },
  { key: 'geo.group.measure', tools: ['length', 'angle', 'area', 'perimeter'] },
  { key: 'geo.group.edit', tools: ['delete'] },
];

const COLORS = ['#1c2430', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c'];

/** חלונית הגיאומטריה: כלי בנייה, הסבר קצר לכלי, ועריכת מאפייני האלמנט שנבחר. */
export function GeometryPanel() {
  const rt = useRuntime();
  const tool = useBoard((s) => s.tool);
  const geo = useBoard((s) => s.prefs.geo);
  const updatePrefs = useBoard((s) => s.updatePrefs);
  const active = tool === 'geometry';

  const pick = (id: GeoToolId) => {
    updatePrefs((p) => ({ ...p, geo: { ...p.geo, tool: id } }));
    rt.board.getState().setTool('geometry');
  };

  return (
    <SidePanel title={t('category.geometry')}>
      {active && (
        <p className="tb-help tb-geo-hint" data-testid="geo-hint">
          {t(`geo.hint.${geo.tool}` as MessageKey)}
        </p>
      )}
      {GROUPS.map((g) => (
        <fieldset key={g.key} className="tb-field">
          <legend>{t(g.key)}</legend>
          <div className="tb-geo-grid" role="radiogroup" aria-label={t(g.key)}>
            {g.tools.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                className="tb-geo-btn"
                aria-checked={active && geo.tool === id}
                onClick={() => pick(id)}
                data-geo-tool={id}
              >
                <GeoToolIcon tool={id} />
                <span>{t(`geo.tool.${id}` as MessageKey)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {active && geo.tool === 'regularPolygon' && (
        <label className="tb-select-inline">
          {t('geo.sides')}
          <select
            value={geo.n}
            onChange={(e) =>
              updatePrefs((p) => ({ ...p, geo: { ...p.geo, n: Number(e.target.value) } }))
            }
          >
            {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {active && geo.tool === 'circleR' && (
        <label className="tb-select-inline">
          {t('geo.radius')}
          <input
            className="tb-input tb-input-small"
            type="number"
            min={0.1}
            step={0.5}
            value={geo.radiusCm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) updatePrefs((p) => ({ ...p, geo: { ...p.geo, radiusCm: v } }));
            }}
          />
        </label>
      )}

      <fieldset className="tb-field">
        <legend>{t('geo.newColor')}</legend>
        <div className="tb-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="tb-swatch"
              style={{ background: c }}
              aria-pressed={geo.color === c}
              aria-label={t('drawing.colorValue', { color: c })}
              onClick={() => updatePrefs((p) => ({ ...p, geo: { ...p.geo, color: c } }))}
            />
          ))}
        </div>
      </fieldset>

      <ElementInspector />
    </SidePanel>
  );
}

function ElementInspector() {
  const rt = useRuntime();
  const sel = useBoard((s) => s.geoSelection);
  const obj = useBoard((s) =>
    sel
      ? (currentPage(s).objects.find((o) => o.id === sel.objectId && o.type === 'geometry') as
          GeometryObject | undefined)
      : undefined,
  );
  const el = obj?.elements.find((e) => e.id === sel?.ids[0]);
  if (!obj || !el) return <p className="tb-help">{t('geo.selectHelp')}</p>;

  const update = (patch: Partial<GeoElement['style']>) => {
    const s = rt.board.getState();
    const current = currentPage(s).objects.find((o) => o.id === obj.id) as
      GeometryObject | undefined;
    if (!current) return;
    s.commit('geoStyle', [
      {
        type: 'replace',
        pageId: s.pageId,
        objects: [
          {
            ...current,
            elements: current.elements.map((e) =>
              e.id === el.id ? { ...e, style: { ...e.style, ...patch } } : e,
            ),
          },
        ],
      },
    ]);
  };
  const isPoint = POINT_KINDS.has(el.kind);
  const isSegment = el.kind === 'segment';
  const isLine = [
    'segment',
    'line',
    'ray',
    'parallel',
    'perpendicular',
    'perpBisector',
    'angleBisector',
  ].includes(el.kind);
  const fillable = el.kind === 'polygon' || el.kind.startsWith('circle');
  const dependents = withDependents(obj.elements, [el.id]).size - 1;

  return (
    <fieldset className="tb-field tb-inspector" data-testid="geo-inspector">
      <legend>
        {t('geo.selected')}: {t(`geo.kind.${el.kind}` as MessageKey)} {el.style.label ?? ''}
      </legend>
      {isPoint && (
        <label className="tb-select-inline">
          {t('geo.name')}
          <input
            className="tb-input tb-input-small"
            defaultValue={el.style.label ?? ''}
            maxLength={8}
            dir="ltr"
            onBlur={(e) =>
              e.target.value !== (el.style.label ?? '') &&
              update({ label: e.target.value.trim() || undefined })
            }
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      )}
      {(isPoint || el.kind === 'angle') && (
        <label className="tb-check">
          <input
            type="checkbox"
            checked={el.style.showLabel !== false}
            onChange={(e) => update({ showLabel: e.target.checked })}
          />
          {el.kind === 'angle' ? t('geo.showDegrees') : t('geo.showName')}
        </label>
      )}
      <div className="tb-swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="tb-swatch"
            style={{ background: c }}
            aria-pressed={el.style.color === c}
            aria-label={t('drawing.colorValue', { color: c })}
            onClick={() => update({ color: c })}
          />
        ))}
      </div>
      {isLine && (
        <div
          className="tb-segmented tb-segmented-3"
          role="radiogroup"
          aria-label={t('drawing.lineStyle')}
        >
          {(['solid', 'dashed', 'dotted'] as LineDash[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={(el.style.dash ?? 'solid') === d}
              onClick={() => update({ dash: d })}
            >
              {t(`drawing.lineStyle.${d}`)}
            </button>
          ))}
        </div>
      )}
      {isSegment && (
        <label className="tb-select-inline">
          {t('geo.ticks')}
          <select
            value={el.style.ticks ?? 0}
            onChange={(e) => update({ ticks: Number(e.target.value) || undefined })}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('geo.none') : '|'.repeat(n)}
              </option>
            ))}
          </select>
        </label>
      )}
      {isLine && (
        <label className="tb-select-inline">
          {t('geo.parallelMarks')}
          <select
            value={el.style.arrows ?? 0}
            onChange={(e) => update({ arrows: Number(e.target.value) || undefined })}
          >
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('geo.none') : '>'.repeat(n)}
              </option>
            ))}
          </select>
        </label>
      )}
      {el.kind === 'angle' && (
        <label className="tb-select-inline">
          {t('geo.angleArcs')}
          <select
            value={el.style.arcs ?? 1}
            onChange={(e) => update({ arcs: Number(e.target.value) })}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {fillable && (
        <label className="tb-check">
          <input
            type="checkbox"
            checked={!!el.style.fill}
            onChange={(e) => update({ fill: e.target.checked || undefined })}
          />
          {t('geo.fill')}
        </label>
      )}
      <label className="tb-check">
        <input
          type="checkbox"
          checked={!!el.style.hidden}
          onChange={(e) => update({ hidden: e.target.checked || undefined })}
        />
        {t('geo.hide')}
      </label>
      <button
        type="button"
        className="tb-btn tb-btn-danger-outline"
        onClick={() => {
          const s = rt.board.getState();
          s.commit('geoDelete', [
            {
              type: 'replace',
              pageId: s.pageId,
              objects: [{ ...obj, elements: removeElements(obj.elements, [el.id]) }],
            },
          ]);
          s.setGeoSelection(null);
        }}
      >
        {dependents > 0 ? t('geo.deleteWithDependents', { n: dependents }) : t('geo.delete')}
      </button>
    </fieldset>
  );
}
