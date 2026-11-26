import { useBoard } from '../app/StoreContext';
import {
  QUADRILATERALS,
  SHAPE_DIMS,
  shapeError,
  TRIANGLES,
  type DimKey,
  type ShapeId,
} from '../core/geometry/shapes';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';

/** בחירת צורה ידועה, המידות שלה, וגודל קבוע/משתנה */
export function GeoShapeOptions() {
  const shape = useBoard((s) => s.prefs.geo.shape);
  const updatePrefs = useBoard((s) => s.updatePrefs);
  const set = (patch: Partial<typeof shape>) =>
    updatePrefs((p) => ({ ...p, geo: { ...p.geo, shape: { ...p.geo.shape, ...patch } } }));
  const setDim = (k: DimKey, v: number) => set({ dims: { ...shape.dims, [k]: v } });
  const error = shapeError(shape.id, shape.dims);

  return (
    <fieldset className="tb-field tb-geo-options" data-testid="geo-shape-options">
      <legend>{t('geo.tool.shape')}</legend>
      <label className="tb-select-inline">
        {t('geo.shapeKind')}
        <select
          value={shape.id}
          onChange={(e) => set({ id: e.target.value as ShapeId })}
          data-testid="geo-shape-select"
        >
          <optgroup label={t('geo.shapes.triangles')}>
            {TRIANGLES.map((id) => (
              <option key={id} value={id}>
                {t(`geo.shape.${id}` as MessageKey)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('geo.shapes.quadrilaterals')}>
            {QUADRILATERALS.map((id) => (
              <option key={id} value={id}>
                {t(`geo.shape.${id}` as MessageKey)}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {SHAPE_DIMS[shape.id].map((k) => (
        <label key={`${shape.id}-${k}`} className="tb-select-inline tb-geo-dim">
          {t(`geo.dim.${shape.id}.${k}` as MessageKey)}
          <input
            className="tb-input tb-input-small"
            type="number"
            min={0.1}
            max={k === 'angle' ? 179 : 100}
            step={k === 'angle' ? 5 : 0.5}
            value={shape.dims[k]}
            data-dim={k}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setDim(k, v);
            }}
          />
        </label>
      ))}
      <div role="radiogroup" aria-label={t('geo.shapeSize')}>
        {[true, false].map((fixed) => (
          <label key={String(fixed)} className="tb-check">
            <input
              type="radio"
              name="geo-shape-size"
              checked={shape.fixed === fixed}
              onChange={() => set({ fixed })}
            />
            {fixed ? t('geo.shapeFixed') : t('geo.shapeFree')}
          </label>
        ))}
      </div>
      {error && (
        <p className="tb-help tb-geo-error" role="alert" data-testid="geo-shape-error">
          {t(`geo.shapeError.${error}` as MessageKey)}
        </p>
      )}
    </fieldset>
  );
}
