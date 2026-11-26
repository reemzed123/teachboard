import { useId } from 'react';
import { PATTERN_OPTIONS, SPACING_LIMITS } from '../core/background/pattern';
import type { BackgroundPattern, PageLayout } from '../core/document/types';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import { BackgroundImagePicker } from './BackgroundImagePicker';
import { SidePanel } from './SidePanel';

const PAGE_COLORS = ['#ffffff', '#fdf8e7', '#eef2f6', '#24413a', '#1c1f24'] as const;

/** רקע ותבנית לעמוד הנוכחי. כל שינוי ניתן לביטול. */
export function TemplatesPanel() {
  const rt = useRuntime();
  const page = useBoard((s) => currentPage(s));
  const id = useId();
  const bg = page.background;
  const setProps = rt.board.getState().setPageProps;

  return (
    <SidePanel title={t('category.templates')}>
      <fieldset className="tb-field">
        <legend>{t('page.layout')}</legend>
        {(['bounded', 'infinite'] as PageLayout[]).map((layout) => (
          <label key={layout} className="tb-radio">
            <input
              type="radio"
              name={`${id}-layout`}
              checked={page.layout === layout}
              onChange={() => setProps({ layout })}
            />
            {t(`page.layout.${layout}`)}
          </label>
        ))}
        <p className="tb-help">{t('page.layout.help')}</p>
      </fieldset>

      {bg.pdf && <p className="tb-help">{t('page.pdfSize')}</p>}
      {page.layout === 'bounded' && !bg.pdf && (
        <fieldset className="tb-field">
          <legend>{t('page.orientation')}</legend>
          <div
            className="tb-segmented tb-segmented-2"
            role="radiogroup"
            aria-label={t('page.orientation')}
          >
            {(['landscape', 'portrait'] as const).map((o) => {
              const portrait = page.size.height > page.size.width;
              const checked = o === 'portrait' ? portrait : !portrait;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    if (checked) return;
                    // מחליפים רוחב וגובה – התוכן לא זז ולא נמחק
                    setProps({ size: { width: page.size.height, height: page.size.width } });
                  }}
                >
                  {t(`page.orientation.${o}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="tb-field">
        <legend>{t('page.pattern')}</legend>
        <div className="tb-pattern-grid" role="radiogroup" aria-label={t('page.pattern')}>
          {PATTERN_OPTIONS.map((pattern: BackgroundPattern) => (
            <button
              key={pattern}
              type="button"
              role="radio"
              aria-checked={bg.pattern === pattern}
              className="tb-pattern-btn"
              data-pattern={pattern}
              onClick={() => setProps({ background: { ...bg, pattern } })}
            >
              <span className={`tb-pattern-preview tb-pattern-${pattern}`} aria-hidden="true" />
              <span>{t(`page.pattern.${pattern}`)}</span>
            </button>
          ))}
        </div>
        {bg.pattern !== 'none' && (
          <>
            <label className="tb-slider-label" htmlFor={`${id}-spacing`}>
              {t('page.spacing')} <output>{bg.spacing}</output>
            </label>
            <input
              id={`${id}-spacing`}
              type="range"
              min={SPACING_LIMITS.min}
              max={SPACING_LIMITS.max}
              step={2}
              value={bg.spacing}
              onChange={(e) => setProps({ background: { ...bg, spacing: Number(e.target.value) } })}
            />
          </>
        )}
      </fieldset>

      <fieldset className="tb-field">
        <legend>{t('page.color')}</legend>
        <div className="tb-swatches">
          {PAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="tb-swatch"
              style={{ background: c }}
              aria-pressed={bg.color === c}
              aria-label={t(`page.color.${c}` as 'page.color.#ffffff')}
              onClick={() => setProps({ background: { ...bg, color: c } })}
            />
          ))}
          <label
            className="tb-swatch tb-swatch-custom"
            aria-pressed={!PAGE_COLORS.includes(bg.color as (typeof PAGE_COLORS)[number])}
            htmlFor={`${id}-color`}
            title={t('drawing.customColor')}
          >
            <input
              id={`${id}-color`}
              type="color"
              value={bg.color}
              aria-label={t('drawing.customColor')}
              onChange={(e) => setProps({ background: { ...bg, color: e.target.value } })}
            />
          </label>
        </div>
      </fieldset>

      <BackgroundImagePicker />
    </SidePanel>
  );
}
