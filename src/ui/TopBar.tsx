import { Settings as SettingsIcon } from 'lucide-react';
import { OfflineBadge } from './OfflineBadge';
import { useApp } from '../app/StoreContext';
import { t } from '../i18n';
import { ActionButton } from './ActionButton';
import { IconButton } from './IconButton';
import { LessonHeader } from './LessonHeader';
import { QuickAccessBar } from './QuickAccessBar';

export function TopBar() {
  const openPanel = useApp((s) => s.openPanel);
  const togglePanel = useApp((s) => s.togglePanel);

  return (
    <header className="tb-topbar" aria-label={t('topbar.label')}>
      <div className="tb-brand">{t('app.name')}</div>
      <LessonHeader />
      <div className="tb-history" role="group" aria-label={t('history.label')}>
        <ActionButton id="edit.undo" />
        <ActionButton id="edit.redo" />
      </div>
      <QuickAccessBar />
      <div className="tb-topbar-end">
        <OfflineBadge />
        <IconButton
          icon={SettingsIcon}
          label={t('action.settings')}
          pressed={openPanel === 'settings'}
          onClick={() => togglePanel('settings')}
          data-action="settings"
        />
      </div>
    </header>
  );
}
