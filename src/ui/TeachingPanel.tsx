import { Crosshair, Eye, Maximize2, Square, Timer, Watch } from 'lucide-react';
import { useApp, useBoard, useRuntime, useTeaching } from '../app/StoreContext';
import { SPOTLIGHT_LIMITS, type CoverSide } from '../features/teaching/teachingStore';
import { t } from '../i18n';
import { SidePanel } from './SidePanel';
import { LayersSection } from './LayersSection';

const SIDES: CoverSide[] = ['top', 'bottom', 'right', 'left'];

/** כלי הוראה: לייזר, זרקור, כיסוי וחשיפה, טיימר, שעון עצר ומצב הצגה. */
export function TeachingPanel() {
  const rt = useRuntime();
  const tool = useBoard((s) => s.tool);
  const spotlight = useTeaching((s) => s.spotlight);
  const cover = useTeaching((s) => s.cover);
  const clock = useTeaching((s) => s.clock);
  const setFocusMode = useApp((s) => s.setFocusMode);
  const teach = rt.teaching.getState();

  return (
    <SidePanel title={t('category.teaching')}>
      <div className="tb-button-column">
        <button
          type="button"
          className="tb-btn tb-btn-tool"
          aria-pressed={tool === 'laser'}
          onClick={() => rt.board.getState().setTool(tool === 'laser' ? 'pen' : 'laser')}
        >
          <Crosshair size={18} aria-hidden="true" />
          {t('teaching.laser')}
        </button>
        <p className="tb-help">{t('teaching.laserHelp')}</p>

        <button
          type="button"
          className="tb-btn tb-btn-tool"
          aria-pressed={spotlight.on}
          onClick={() => teach.toggleSpotlight()}
        >
          <Eye size={18} aria-hidden="true" />
          {t('teaching.spotlight')}
        </button>
        {spotlight.on && (
          <label className="tb-select-inline">
            {t('teaching.spotlightSize')}
            <input
              type="range"
              min={SPOTLIGHT_LIMITS.min}
              max={SPOTLIGHT_LIMITS.max}
              step={10}
              value={spotlight.radius}
              onChange={(e) => teach.setSpotlightRadius(Number(e.target.value))}
            />
          </label>
        )}
        <p className="tb-help">{t('teaching.spotlightHelp')}</p>

        <button
          type="button"
          className="tb-btn tb-btn-tool"
          aria-pressed={cover.on}
          onClick={() => teach.toggleCover()}
        >
          <Square size={18} aria-hidden="true" />
          {t('teaching.cover')}
        </button>
        <fieldset className="tb-field">
          <legend>{t('teaching.coverFrom')}</legend>
          <div className="tb-segmented tb-segmented-4" role="radiogroup">
            {SIDES.map((side) => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={cover.side === side}
                onClick={() => teach.setCoverSide(side)}
              >
                {t(`teaching.side.${side}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="tb-help">{t('teaching.coverHelp')}</p>

        <button
          type="button"
          className="tb-btn tb-btn-tool"
          aria-pressed={clock?.mode === 'timer'}
          onClick={() => (clock?.mode === 'timer' ? teach.closeClock() : teach.openClock('timer'))}
        >
          <Timer size={18} aria-hidden="true" />
          {t('teaching.timer')}
        </button>
        {clock?.mode === 'timer' && (
          <label className="tb-select-inline">
            {t('teaching.customMinutes')}
            <input
              className="tb-input tb-input-small"
              type="number"
              min={1}
              max={180}
              step={1}
              data-testid="timer-minutes"
              key={clock.durationMs}
              defaultValue={Math.round(clock.durationMs / 60_000)}
              onBlur={(e) => {
                const m = Number(e.target.value);
                if (m > 0) teach.setDuration(m * 60_000);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </label>
        )}
        <button
          type="button"
          className="tb-btn tb-btn-tool"
          aria-pressed={clock?.mode === 'stopwatch'}
          onClick={() =>
            clock?.mode === 'stopwatch' ? teach.closeClock() : teach.openClock('stopwatch')
          }
        >
          <Watch size={18} aria-hidden="true" />
          {t('teaching.stopwatch')}
        </button>

        <button type="button" className="tb-btn tb-btn-tool" onClick={() => setFocusMode(true)}>
          <Maximize2 size={18} aria-hidden="true" />
          {t('teaching.present')}
        </button>
        <p className="tb-help">{t('teaching.presentHelp')}</p>
      </div>
      <LayersSection />
    </SidePanel>
  );
}
