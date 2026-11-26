import { Download, ShieldCheck } from 'lucide-react';
import { useStore } from 'zustand';
import { pwa, promptInstall, requestPersistence } from '../platform/web/pwa';
import { t } from '../i18n';
import { useRuntime } from '../app/StoreContext';
import { APP_VERSION, isDesktopApp } from '../platform/desktop';

/** גודל קריא: מגה-בייט, או ג'יגה-בייט כשגדול */
export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return t('app.gb', { n: (mb / 1024).toFixed(mb >= 10 * 1024 ? 0 : 1) });
  return t('app.mb', { n: mb.toFixed(mb < 10 ? 1 : 0) });
}

/** הגדרות: התקנה כאפליקציה במחשב, ומצב האחסון של השיעורים. */
export function AppInstallSection() {
  const rt = useRuntime();
  const { canInstall, installed, persisted, usage, quota } = useStore(pwa);
  return (
    <fieldset className="tb-field" data-testid="app-section">
      <legend>{t('app.section')}</legend>
      {isDesktopApp() ? (
        <p className="tb-help">{t('app.desktop')}</p>
      ) : installed ? (
        <p className="tb-help">{t('app.installed')}</p>
      ) : canInstall ? (
        <>
          <button type="button" className="tb-btn tb-btn-tool" onClick={() => void promptInstall()}>
            <Download size={18} aria-hidden="true" />
            {t('app.install')}
          </button>
          <p className="tb-help">{t('app.installHelp')}</p>
        </>
      ) : (
        <p className="tb-help">{t('app.installManual')}</p>
      )}

      <p className="tb-help" data-testid="app-version">
        {t('app.version', { v: APP_VERSION })}
      </p>
      <p className="tb-help" data-testid="storage-status">
        {usage !== null
          ? t('app.storageUsage', {
              used: formatSize(usage),
              free: quota !== null ? formatSize(Math.max(0, quota - usage)) : '?',
            })
          : t('app.storageLocal')}
      </p>
      {persisted ? (
        <p className="tb-help tb-ok">
          <ShieldCheck size={16} aria-hidden="true" /> {t('app.persisted')}
        </p>
      ) : (
        persisted === false && (
          <>
            <button
              type="button"
              className="tb-btn"
              onClick={() =>
                void requestPersistence().then((ok) =>
                  rt.app
                    .getState()
                    .notify(
                      ok ? 'info' : 'error',
                      ok ? t('app.persisted') : t('app.persistDenied'),
                    ),
                )
              }
            >
              {t('app.persist')}
            </button>
            <p className="tb-help">{t('app.persistHelp')}</p>
          </>
        )
      )}
    </fieldset>
  );
}
