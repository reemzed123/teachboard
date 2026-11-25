import { useBoard, useRuntime } from '../app/StoreContext';
import { t } from '../i18n';
import { ActionButton } from './ActionButton';

export function ZoomControls() {
  const rt = useRuntime();
  const scale = useBoard((s) => s.view.scale);
  const percent = Math.round(scale * 100);

  return (
    <div className="tb-zoom" role="toolbar" aria-label={t('zoom.label')}>
      <ActionButton id="view.zoomOut" tooltipSide="above" />
      <button
        type="button"
        className="tb-zoom-value"
        aria-label={t('zoom.reset', { percent })}
        data-tooltip={t('zoom.reset', { percent })}
        onClick={() => rt.engine?.zoomTo(1)}
        data-testid="zoom-value"
      >
        {percent}%
      </button>
      <ActionButton id="view.zoomIn" tooltipSide="above" />
      <ActionButton id="view.zoomFit" tooltipSide="above" />
    </div>
  );
}
