import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';

// כשגרסה חדשה מוכנה, לא מרעננים אוטומטית (זה עלול לקרות באמצע שיעור).
// המורה מחליט מתי לעדכן.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="tb-toast" role="status">
      <span>{t('update.available')}</span>
      <button
        type="button"
        className="tb-btn tb-btn-primary"
        onClick={() => void updateServiceWorker(true)}
      >
        {t('update.reload')}
      </button>
      <button type="button" className="tb-btn" onClick={() => setNeedRefresh(false)}>
        {t('update.later')}
      </button>
    </div>
  );
}
