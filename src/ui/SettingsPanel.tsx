import { useId } from 'react';
import { ACTIONS } from '../app/actions';
import { QUICK_ACTION_IDS } from '../app/actionIds';
import { useApp } from '../app/StoreContext';
import type { ThemePreference } from '../core/settings/settings';
import { t } from '../i18n';
import { SidePanel } from './SidePanel';
import { AppInstallSection } from './AppInstallSection';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsPanel() {
  const settings = useApp((s) => s.settings);
  const saveFailed = useApp((s) => s.settingsSaveFailed);
  const setTheme = useApp((s) => s.setTheme);
  const setQuickAccess = useApp((s) => s.setQuickAccess);
  const setAutoClosePanel = useApp((s) => s.setAutoClosePanel);
  const baseId = useId();

  return (
    <SidePanel title={t('settings.title')}>
      {saveFailed && (
        <p className="tb-warning" role="alert">
          {t('settings.saveFailed')}
        </p>
      )}

      <fieldset className="tb-field">
        <legend>{t('settings.theme')}</legend>
        {THEMES.map((theme) => (
          <label key={theme} className="tb-radio">
            <input
              type="radio"
              name={`${baseId}-theme`}
              value={theme}
              checked={settings.theme === theme}
              onChange={() => setTheme(theme)}
            />
            {t(`settings.theme.${theme}`)}
          </label>
        ))}
      </fieldset>

      <AppInstallSection />

      <fieldset className="tb-field">
        <legend>{t('settings.behavior')}</legend>
        <label className="tb-check">
          <input
            type="checkbox"
            checked={settings.autoClosePanel}
            onChange={(e) => setAutoClosePanel(e.target.checked)}
          />
          {t('settings.autoClosePanel')}
        </label>
      </fieldset>

      <fieldset className="tb-field">
        <legend>{t('settings.quickAccess')}</legend>
        <p className="tb-help">{t('settings.quickAccess.help')}</p>
        {settings.quickAccess.map((value, index) => {
          const id = `${baseId}-slot-${index}`;
          return (
            <div key={index} className="tb-select-row">
              <label htmlFor={id}>{t('settings.quickAccess.slot', { n: index + 1 })}</label>
              <select
                id={id}
                value={value ?? ''}
                onChange={(e) => setQuickAccess(index, e.target.value || null)}
              >
                <option value="">{t('settings.quickAccess.empty')}</option>
                {QUICK_ACTION_IDS.map((actionId) => (
                  <option key={actionId} value={actionId}>
                    {t(ACTIONS[actionId].labelKey)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </fieldset>
    </SidePanel>
  );
}
