import { Home, Settings as SettingsIcon } from 'lucide-react';
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
  const setStartScreen = useApp((s) => s.setStartScreen);

  return (
    <header className="tb-topbar" aria-label={t('topbar.label')}>
      {/* שם התוכנה = כפתור "מסך הפתיחה" */}
      <button
        type="button"
        className="tb-brand"
        aria-label={t('action.home')}
        data-tooltip={t('action.home')}
        data-tooltip-side="below"
        data-action="home"
        onClick={() => setStartScreen(true)}
      >
        <Home size={18} aria-hidden="true" />
        <span className="tb-brand-name">{t('app.name')}</span>
      </button>
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
