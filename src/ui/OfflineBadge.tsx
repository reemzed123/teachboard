import { WifiOff } from 'lucide-react';
import { useStore } from 'zustand';
import { pwa } from '../platform/web/pwa';
import { t } from '../i18n';

/** תג קטן בסרגל העליון כשאין אינטרנט – להרגעה: הכול ממשיך לעבוד ונשמר במחשב. */
export function OfflineBadge() {
  const online = useStore(pwa, (s) => s.online);
  if (online) return null;
  return (
    <span
      className="tb-offline-badge"
      role="status"
      data-testid="offline-badge"
      title={t('app.offlineHelp')}
    >
      <WifiOff size={14} aria-hidden="true" />
      {t('app.offline')}
    </span>
  );
}
