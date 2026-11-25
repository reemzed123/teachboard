import { t } from '../i18n';

export function Workspace() {
  return (
    <main className="tb-workspace" aria-label={t('workspace.label')}>
      <p className="tb-workspace-note">{t('workspace.placeholder')}</p>
    </main>
  );
}
